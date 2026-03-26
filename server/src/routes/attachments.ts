import { Router } from "express";
import { eq, and } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { attachments, issues } from "@paperclipai/db";
import type { StorageService } from "../storage/types.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";
import { isAllowedContentType, maxBytesForType } from "../attachment-types.js";
import { logActivity } from "../services/index.js";
import { logger } from "../middleware/logger.js";

const MAX_CHUNK_BYTES = 50 * 1024 * 1024; // 50 MB per chunk

function zeroPad(n: number, width = 20): string {
  return String(n).padStart(width, "0");
}

function parseContentRange(
  header: string | undefined,
): { start: number; end: number; total: number } | null {
  if (!header) return null;
  const match = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(header);
  if (!match) return null;
  const start = Number(match[1]);
  const end = Number(match[2]);
  const total = Number(match[3]);
  if (start > end || end >= total) return null;
  return { start, end, total };
}

export function attachmentRoutes(db: Db, storage: StorageService) {
  const router = Router();

  // POST /init — initialize a chunked upload
  router.post("/init", async (req, res) => {
    if (req.actor.type === "none") {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { filename, mimeType, sizeBytes, issueId, commentId } = req.body ?? {};

    if (!issueId || typeof issueId !== "string") {
      res.status(400).json({ error: "issueId is required" });
      return;
    }
    if (!filename || typeof filename !== "string") {
      res.status(400).json({ error: "filename is required" });
      return;
    }
    // Fix 9: reject dangerous filenames
    if (
      filename.includes("..") ||
      filename.includes("/") ||
      filename.includes("\\") ||
      filename.includes("\0") ||
      filename.length > 255
    ) {
      res.status(400).json({ error: "Invalid filename" });
      return;
    }
    if (!mimeType || typeof mimeType !== "string") {
      res.status(400).json({ error: "mimeType is required" });
      return;
    }
    if (typeof sizeBytes !== "number" || sizeBytes <= 0) {
      res.status(400).json({ error: "sizeBytes must be a positive number" });
      return;
    }

    if (!isAllowedContentType(mimeType)) {
      res.status(415).json({ error: "Unsupported content type: " + mimeType });
      return;
    }

    const maxBytes = maxBytesForType(mimeType);
    if (sizeBytes > maxBytes) {
      res.status(413).json({ error: "File too large. Max " + maxBytes + " bytes for " + mimeType });
      return;
    }

    // Fix 3: Derive companyId from actor context with explicit guard
    let companyId: string;
    if (req.actor.type === "agent") {
      if (!req.actor.companyId) {
        res.status(400).json({ error: "Agent token is missing company context" });
        return;
      }
      companyId = req.actor.companyId;
    } else {
      const requested = req.body.companyId as string | undefined;
      if (!requested) {
        res.status(400).json({ error: "companyId is required for board users" });
        return;
      }
      companyId = requested;
    }
    assertCompanyAccess(req, companyId);

    // Fix 2: Verify issueId belongs to the company
    const issueRows = await db
      .select({ id: issues.id, companyId: issues.companyId })
      .from(issues)
      .where(eq(issues.id, issueId));
    if (!issueRows[0] || issueRows[0].companyId !== companyId) {
      res.status(404).json({ error: "Issue not found" });
      return;
    }

    const actor = getActorInfo(req);

    const [row] = await db
      .insert(attachments)
      .values({
        companyId,
        issueId,
        commentId: commentId ?? null,
        uploaderType: actor.actorType,
        uploaderId: actor.actorId,
        filename,
        mimeType,
        sizeBytes,
        storageKey: "",
        status: "uploading",
      })
      .returning();

    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "attachment.upload_init",
      entityType: "attachment",
      entityId: row.id,
      details: { issueId, filename, mimeType, sizeBytes },
    });

    res.status(201).json({ uploadId: row.id, attachmentId: row.id });
  });

  // PUT /:attachmentId/chunk — upload one chunk
  router.put("/:attachmentId/chunk", async (req, res) => {
    if (req.actor.type === "none") {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { attachmentId } = req.params;
    const rangeHeader = req.headers["content-range"] as string | undefined;
    const range = parseContentRange(rangeHeader);
    if (!range) {
      res.status(400).json({
        error: "Invalid or missing Content-Range header. Expected: bytes start-end/total",
      });
      return;
    }

    // Fix 4: Content-Length pre-check for chunk size cap
    const contentLength = Number(req.headers["content-length"]);
    if (contentLength > MAX_CHUNK_BYTES) {
      res.status(413).json({ error: "Chunk exceeds 50 MB limit" });
      return;
    }

    const [row] = await db
      .select()
      .from(attachments)
      .where(eq(attachments.id, attachmentId));

    if (!row) {
      res.status(404).json({ error: "Attachment not found" });
      return;
    }
    assertCompanyAccess(req, row.companyId);

    if (row.status !== "uploading") {
      res.status(409).json({ error: "Upload already completed or failed" });
      return;
    }

    // Collect raw body with size tracking (Fix 4)
    const buffers: Buffer[] = [];
    let totalSize = 0;
    for await (const chunk of req) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalSize += buf.length;
      if (totalSize > MAX_CHUNK_BYTES) {
        req.destroy();
        res.status(413).json({ error: "Chunk too large" });
        return;
      }
      buffers.push(buf);
    }
    const body = Buffer.concat(buffers);

    const expectedLength = range.end - range.start + 1;
    if (body.length !== expectedLength) {
      res.status(400).json({
        error: "Chunk size mismatch: expected " + expectedLength + ", got " + body.length,
      });
      return;
    }

    // Fix 1: Store chunk at predictable key using putRawObject
    const chunkKey = row.companyId + "/uploads/" + attachmentId + "/chunk-" + zeroPad(range.start);
    await storage.putRawObject(row.companyId, chunkKey, body, "application/octet-stream");

    res.json({ received: true, bytesReceived: body.length });
  });

  // POST /:attachmentId/complete — finalize upload
  router.post("/:attachmentId/complete", async (req, res) => {
    if (req.actor.type === "none") {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { attachmentId } = req.params;

    // Fix 5: Atomic transition to prevent double-complete race
    const [updated] = await db
      .update(attachments)
      .set({ status: "assembling", updatedAt: new Date() })
      .where(and(eq(attachments.id, attachmentId), eq(attachments.status, "uploading")))
      .returning();

    if (!updated) {
      // Could be not found or already completed — check which
      const [existing] = await db
        .select()
        .from(attachments)
        .where(eq(attachments.id, attachmentId));
      if (!existing) {
        res.status(404).json({ error: "Attachment not found" });
      } else {
        res.status(409).json({ error: "Upload already completed or not found" });
      }
      return;
    }
    assertCompanyAccess(req, updated.companyId);

    // Fix 1: Assemble chunks into final file
    const chunkPrefix = updated.companyId + "/uploads/" + attachmentId + "/chunk-";
    const assembledBuffers: Buffer[] = [];
    const chunkOffsets: number[] = [];
    let offset = 0;

    while (offset < updated.sizeBytes) {
      const chunkKey = chunkPrefix + zeroPad(offset);
      const chunkData = await storage.getRawObject(updated.companyId, chunkKey);
      assembledBuffers.push(chunkData);
      chunkOffsets.push(offset);
      offset += chunkData.length;
    }

    const assembledFile = Buffer.concat(assembledBuffers);

    // Fix 7: Sanitize filename before building storage key
    const safeFilename = updated.filename
      .replace(/[/\\]/g, "_")
      .replace(/\0/g, "")
      .slice(0, 255);
    const finalKey = updated.companyId + "/files/" + attachmentId + "/" + safeFilename;

    // Write assembled file to final storage key
    await storage.putRawObject(updated.companyId, finalKey, assembledFile, updated.mimeType);

    // Delete temporary chunks (best-effort)
    for (const chunkOffset of chunkOffsets) {
      const chunkKey = chunkPrefix + zeroPad(chunkOffset);
      try {
        await storage.deleteObject(updated.companyId, chunkKey);
      } catch {
        // best-effort cleanup
      }
    }

    // Link commentId if provided
    const { commentId } = req.body ?? {};
    const updateFields: Record<string, unknown> = {
      storageKey: finalKey,
      status: "ready",
      updatedAt: new Date(),
    };
    if (commentId && typeof commentId === "string") {
      updateFields.commentId = commentId;
    }

    const needsThumbnail =
      updated.mimeType.startsWith("image/") || updated.mimeType.startsWith("video/");

    await db
      .update(attachments)
      .set(updateFields as any)
      .where(eq(attachments.id, attachmentId));

    // Thumbnail job — fire async, write thumbnailKey back to DB on success
    if (needsThumbnail) {
      const mediaWorkerUrl =
        process.env.PAPERCLIP_MEDIA_WORKER_URL ??
        process.env.MEDIA_WORKER_URL ??
        "http://media-worker:8200";
      fetch(mediaWorkerUrl + "/jobs/thumbnail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attachmentId,
          storageKey: finalKey,
          mimeType: updated.mimeType,
        }),
        signal: AbortSignal.timeout(15_000),
      })
        .then((r) => r.ok ? r.json() : null)
        .then(async (data: { thumbnailKey?: string } | null) => {
          if (data?.thumbnailKey) {
            await db.update(attachments)
              .set({ thumbnailKey: data.thumbnailKey, updatedAt: new Date() })
              .where(eq(attachments.id, attachmentId));
          }
        })
        .catch((err: Error) => {
          logger.warn(`[attachments] thumbnail generation failed for ${attachmentId}: ${err.message}`);
        });
    }

    // Office preview job — convert docx/xlsx/pptx to HTML for in-browser preview
    const officeTypes = [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/msword",
      "application/vnd.ms-excel",
      "application/vnd.ms-powerpoint",
    ];
    if (officeTypes.includes(updated.mimeType)) {
      const mediaWorkerUrl =
        process.env.PAPERCLIP_MEDIA_WORKER_URL ??
        process.env.MEDIA_WORKER_URL ??
        "http://media-worker:8200";
      fetch(mediaWorkerUrl + "/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attachmentId,
          storageKey: finalKey,
          mimeType: updated.mimeType,
        }),
        signal: AbortSignal.timeout(30_000),
      })
        .then((r) => r.ok ? r.json() : null)
        .then(async (data: { outputKey?: string } | null) => {
          if (data?.outputKey) {
            await db.update(attachments)
              .set({ htmlPreviewKey: data.outputKey, updatedAt: new Date() })
              .where(eq(attachments.id, attachmentId));
          }
        })
        .catch((err: Error) => {
          logger.warn(`[attachments] office preview generation failed for ${attachmentId}: ${err.message}`);
        });
    }

    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId: updated.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "attachment.upload_complete",
      entityType: "attachment",
      entityId: attachmentId,
      details: { filename: updated.filename, mimeType: updated.mimeType, sizeBytes: updated.sizeBytes },
    });

    res.json({
      url: "/api/attachments/" + attachmentId + "/content",
      attachmentId,
      status: "ready",
    });
  });

  // GET /issue/:issueId — list attachments for an issue
  router.get("/issue/:issueId", async (req, res) => {
    if (req.actor.type === "none") {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { issueId } = req.params;

    let companyId: string | undefined;
    if (req.actor.type === "agent") {
      if (!req.actor.companyId) {
        res.status(400).json({ error: "Agent token is missing company context" });
        return;
      }
      companyId = req.actor.companyId;
    } else {
      companyId = req.query.companyId as string | undefined;
    }

    if (!companyId) {
      res.status(400).json({ error: "companyId query parameter is required" });
      return;
    }

    assertCompanyAccess(req, companyId);

    const rows = await db
      .select()
      .from(attachments)
      .where(and(eq(attachments.issueId, issueId), eq(attachments.companyId, companyId)));

    res.json({
      attachments: rows.map((r) => ({
        id: r.id,
        issueId: r.issueId,
        commentId: r.commentId,
        uploaderType: r.uploaderType,
        uploaderId: r.uploaderId,
        filename: r.filename,
        mimeType: r.mimeType,
        sizeBytes: r.sizeBytes,
        versionOf: r.versionOf,
        versionNum: r.versionNum,
        status: r.status,
        publishUrl: r.publishUrl,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        downloadUrl: "/api/attachments/" + r.id + "/content",
        thumbnailUrl: r.thumbnailKey ? "/api/attachments/" + r.id + "/thumbnail" : null,
        htmlPreviewKey: r.htmlPreviewKey ?? null,
      })),
    });
  });

  // GET /:attachmentId/preview — stream the HTML preview file
  router.get("/:attachmentId/preview", async (req, res, next) => {
    if (req.actor.type === "none") {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { attachmentId } = req.params;

    const [row] = await db
      .select()
      .from(attachments)
      .where(eq(attachments.id, attachmentId));

    if (!row) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    assertCompanyAccess(req, row.companyId);

    if (!row.htmlPreviewKey) {
      res.status(404).json({ error: "no_preview" });
      return;
    }

    try {
      const object = await storage.getObject(row.companyId, row.htmlPreviewKey);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Cache-Control", "private, max-age=60");
      object.stream.on("error", (err) => next(err));
      object.stream.pipe(res);
    } catch (err) {
      next(err);
    }
  });

  // GET /:attachmentId/thumbnail — stream the thumbnail image
  router.get("/:attachmentId/thumbnail", async (req, res, next) => {
    if (req.actor.type === "none") {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { attachmentId } = req.params;

    const [row] = await db
      .select()
      .from(attachments)
      .where(eq(attachments.id, attachmentId));

    if (!row) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    assertCompanyAccess(req, row.companyId);

    if (!row.thumbnailKey) {
      res.status(404).json({ error: "no_thumbnail" });
      return;
    }

    try {
      const object = await storage.getObject(row.companyId, row.thumbnailKey);
      res.setHeader("Content-Type", "image/jpeg");
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.setHeader("X-Content-Type-Options", "nosniff");
      object.stream.on("error", (err) => next(err));
      object.stream.pipe(res);
    } catch (err) {
      next(err);
    }
  });

  // Fix 8: GET /:attachmentId — metadata + download URL (DTO response)
  router.get("/:attachmentId", async (req, res) => {
    if (req.actor.type === "none") {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { attachmentId } = req.params;

    const [row] = await db
      .select()
      .from(attachments)
      .where(eq(attachments.id, attachmentId));

    if (!row) {
      res.status(404).json({ error: "Attachment not found" });
      return;
    }
    assertCompanyAccess(req, row.companyId);

    res.json({
      id: row.id,
      issueId: row.issueId,
      commentId: row.commentId,
      uploaderType: row.uploaderType,
      uploaderId: row.uploaderId,
      filename: row.filename,
      mimeType: row.mimeType,
      sizeBytes: row.sizeBytes,
      versionOf: row.versionOf,
      versionNum: row.versionNum,
      status: row.status,
      publishUrl: row.publishUrl,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      downloadUrl: "/api/attachments/" + attachmentId + "/content",
      thumbnailUrl: row.thumbnailKey ? "/api/attachments/" + attachmentId + "/thumbnail" : null,
      htmlPreviewKey: row.htmlPreviewKey ?? null,
    });
  });

  // GET /:attachmentId/content — stream the file
  router.get("/:attachmentId/content", async (req, res, next) => {
    if (req.actor.type === "none") {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { attachmentId } = req.params;

    const [row] = await db
      .select()
      .from(attachments)
      .where(eq(attachments.id, attachmentId));

    if (!row) {
      res.status(404).json({ error: "Attachment not found" });
      return;
    }
    assertCompanyAccess(req, row.companyId);

    try {
      const object = await storage.getObject(row.companyId, row.storageKey);
      res.setHeader(
        "Content-Type",
        row.mimeType || object.contentType || "application/octet-stream",
      );
      if (row.sizeBytes || object.contentLength) {
        res.setHeader("Content-Length", String(row.sizeBytes || object.contentLength || 0));
      }
      res.setHeader("Cache-Control", "private, max-age=60");
      const fname = row.filename ?? "attachment";
      res.setHeader(
        "Content-Disposition",
        "inline; filename*=UTF-8''" + encodeURIComponent(fname),
      );
      object.stream.on("error", (err) => next(err));
      object.stream.pipe(res);
    } catch (err) {
      next(err);
    }
  });

  // DELETE /:attachmentId — delete (uploader or admin only)
  router.delete("/:attachmentId", async (req, res) => {
    if (req.actor.type === "none") {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { attachmentId } = req.params;

    const [row] = await db
      .select()
      .from(attachments)
      .where(eq(attachments.id, attachmentId));

    if (!row) {
      res.status(404).json({ error: "Attachment not found" });
      return;
    }
    assertCompanyAccess(req, row.companyId);

    const actor = getActorInfo(req);
    const isOwner = row.uploaderId === actor.actorId;
    const isAdmin =
      req.actor.type === "board" &&
      (req.actor.isInstanceAdmin === true || req.actor.source === "local_implicit");

    if (!isOwner && !isAdmin) {
      res.status(403).json({ error: "Only the uploader or an admin can delete this attachment" });
      return;
    }

    // Delete file from storage
    if (row.storageKey) {
      try {
        await storage.deleteObject(row.companyId, row.storageKey);
      } catch (err) {
        logger.warn({ err, attachmentId }, "Failed to delete attachment from storage");
      }
    }

    // Delete thumbnail if present
    if (row.thumbnailKey) {
      try {
        await storage.deleteObject(row.companyId, row.thumbnailKey);
      } catch (err) {
        logger.warn({ err, attachmentId }, "Failed to delete thumbnail from storage");
      }
    }

    await db.delete(attachments).where(eq(attachments.id, attachmentId));

    await logActivity(db, {
      companyId: row.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "attachment.deleted",
      entityType: "attachment",
      entityId: attachmentId,
      details: { filename: row.filename, mimeType: row.mimeType },
    });

    res.json({ ok: true });
  });

  return router;
}

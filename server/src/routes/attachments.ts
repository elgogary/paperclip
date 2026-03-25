import { Router } from "express";
import { eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { attachments } from "@paperclipai/db";
import type { StorageService } from "../storage/types.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";
import { isAllowedContentType, maxBytesForType } from "../attachment-types.js";
import { logActivity } from "../services/index.js";
import { logger } from "../middleware/logger.js";

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
    if (!mimeType || typeof mimeType !== "string") {
      res.status(400).json({ error: "mimeType is required" });
      return;
    }
    if (typeof sizeBytes !== "number" || sizeBytes <= 0) {
      res.status(400).json({ error: "sizeBytes must be a positive number" });
      return;
    }

    if (!isAllowedContentType(mimeType)) {
      res.status(422).json({ error: `Unsupported content type: ${mimeType}` });
      return;
    }

    const maxBytes = maxBytesForType(mimeType);
    if (sizeBytes > maxBytes) {
      res.status(422).json({ error: `File too large. Max ${maxBytes} bytes for ${mimeType}` });
      return;
    }

    // Derive companyId from actor context
    let companyId: string;
    if (req.actor.type === "agent") {
      companyId = req.actor.companyId!;
    } else {
      const requested = req.body.companyId as string | undefined;
      if (!requested) {
        res.status(400).json({ error: "companyId is required for board users" });
        return;
      }
      companyId = requested;
    }
    assertCompanyAccess(req, companyId);

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

    // Collect raw body
    const buffers: Buffer[] = [];
    for await (const chunk of req) {
      buffers.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const body = Buffer.concat(buffers);

    const expectedLength = range.end - range.start + 1;
    if (body.length !== expectedLength) {
      res.status(400).json({
        error: `Chunk size mismatch: expected ${expectedLength}, got ${body.length}`,
      });
      return;
    }

    // Store chunk to storage at: uploads/{attachmentId}/chunk-{zeroPaddedStart}
    await storage.putFile({
      companyId: row.companyId,
      namespace: `uploads/${attachmentId}`,
      originalFilename: `chunk-${zeroPad(range.start)}`,
      contentType: "application/octet-stream",
      body,
    });

    res.json({ received: true, bytesReceived: body.length });
  });

  // POST /:attachmentId/complete — finalize upload
  router.post("/:attachmentId/complete", async (req, res) => {
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

    if (row.status !== "uploading") {
      res.status(409).json({ error: "Upload already completed or failed" });
      return;
    }

    const finalKey = `files/${row.companyId}/${attachmentId}/${row.filename}`;
    const needsThumbnail =
      row.mimeType.startsWith("image/") || row.mimeType.startsWith("video/");
    let finalStatus = needsThumbnail ? "processing" : "ready";

    await db
      .update(attachments)
      .set({ storageKey: finalKey, status: finalStatus, updatedAt: new Date() })
      .where(eq(attachments.id, attachmentId));

    // Queue thumbnail job — skip gracefully if media-worker unavailable
    if (needsThumbnail) {
      const mediaWorkerUrl = process.env.PAPERCLIP_MEDIA_WORKER_URL;
      if (mediaWorkerUrl) {
        try {
          await fetch(`${mediaWorkerUrl}/jobs/thumbnail`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              attachmentId,
              storageKey: finalKey,
              mimeType: row.mimeType,
            }),
          });
        } catch (err) {
          logger.warn({ err, attachmentId }, "Failed to queue thumbnail job; marking as ready");
          finalStatus = "ready";
          await db
            .update(attachments)
            .set({ status: "ready", updatedAt: new Date() })
            .where(eq(attachments.id, attachmentId));
        }
      } else {
        // No media worker configured — mark as ready
        finalStatus = "ready";
        await db
          .update(attachments)
          .set({ status: "ready", updatedAt: new Date() })
          .where(eq(attachments.id, attachmentId));
      }
    }

    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId: row.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "attachment.upload_complete",
      entityType: "attachment",
      entityId: attachmentId,
      details: { filename: row.filename, mimeType: row.mimeType, sizeBytes: row.sizeBytes },
    });

    res.json({
      url: `/api/attachments/${attachmentId}/content`,
      attachmentId,
      status: finalStatus,
    });
  });

  // GET /:attachmentId — metadata + download URL
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
      ...row,
      downloadUrl: `/api/attachments/${attachmentId}/content`,
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
        `inline; filename="${fname.replaceAll('"', '')}"`,
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

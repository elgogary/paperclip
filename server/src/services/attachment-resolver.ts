import * as fs from "node:fs/promises";
import * as path from "node:path";
import { eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { attachments } from "@paperclipai/db";
import type { StorageService } from "../storage/types.js";
import { isAllowedContentType, maxBytesForType } from "../attachment-types.js";

export interface AttachToken {
  raw: string;
  path: string;
  title?: string;
}

export interface ResolvedToken extends AttachToken {
  attachmentId: string;
  filename: string;
}

export interface FailedToken extends AttachToken {
  filename: string;
  reason: string;
}

const ATTACH_PATTERN = String.raw`\[\[attach:([^\]\|]+?)(?:\s*\|\s*title="([^"]*)")?\]\]`;

export function parseAttachTokens(body: string): AttachToken[] {
  const regex = new RegExp(ATTACH_PATTERN, "g");
  const tokens: AttachToken[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(body)) !== null) {
    tokens.push({
      raw: match[0],
      path: match[1].trim(),
      title: match[2],
    });
  }
  return tokens;
}

// Note: produces Markdown link format [filename](attachment:uuid) — NOT [[attachment:uuid]].
// The [[attachment:uuid]] syntax is a separate client-side annotation handled in MarkdownBody.tsx.
// Both formats are intercepted by the MarkdownBody `a` component override via parseAttachmentHref().
export function replaceAttachTokens(
  body: string,
  resolved: ResolvedToken[],
  failed: FailedToken[] = [],
): string {
  let result = body;
  for (const token of resolved) {
    result = result.replace(token.raw, () => `[${token.filename}](attachment:${token.attachmentId})`);
  }
  for (const token of failed) {
    result = result.replace(token.raw, () => `[file unavailable: ${token.filename}]`);
  }
  return result;
}

/**
 * Static path safety check — verifies the path string resolves within the
 * workspace root using path.resolve() only.
 *
 * WARNING: Does NOT follow symlinks. This check alone is insufficient to
 * prevent path traversal via symlinks. Callers must also verify the result
 * of `fs.realpath()` starts within the workspace root.
 */
export function isSafePath(filePath: string, workspaceRoot: string): boolean {
  const normalized = path.resolve(workspaceRoot, filePath);
  const root = workspaceRoot.endsWith("/") ? workspaceRoot : `${workspaceRoot}/`;
  return normalized === workspaceRoot || normalized.startsWith(root);
}

const DEFAULT_WORKSPACE_ROOT = process.env.PAPERCLIP_WORKSPACE_ROOT ?? "/workspace";

/**
 * Resolve [[attach:path]] tokens by reading the referenced files from the
 * workspace filesystem, uploading them to storage, and creating attachment
 * DB records.
 *
 * Note: When uploaderType is "user", [[attach:]] tokens are not processed.
 * They are returned in `failed` with reason "uploader_not_allowed" so that
 * callers can surface feedback. This is by design — only agents may attach
 * files via the [[attach:]] syntax.
 */
export async function resolveAttachTokens(
  tokens: AttachToken[],
  opts: {
    companyId: string;
    issueId: string;
    agentId: string;
    db: Db;
    storage: StorageService;
    workspaceRoot?: string;
    uploaderType?: "agent" | "user";
  },
): Promise<{ resolved: ResolvedToken[]; failed: FailedToken[] }> {
  const { companyId, issueId, agentId, db, storage } = opts;
  const workspaceRoot = opts.workspaceRoot ?? DEFAULT_WORKSPACE_ROOT;
  const uploaderType = opts.uploaderType ?? "agent";
  const resolved: ResolvedToken[] = [];
  const failed: FailedToken[] = [];

  // Board-user tokens — warn and return as failed so callers can surface feedback
  if (uploaderType === "user" && tokens.length > 0) {
    console.warn(`[attach-resolver] Ignoring ${tokens.length} [[attach:]] token(s) from board user (not an agent)`);
    return {
      resolved,
      failed: tokens.map((token) => ({
        ...token,
        filename: path.basename(token.path),
        reason: "uploader_not_allowed" as const,
      })),
    };
  }

  for (const token of tokens) {
    const basename = path.basename(token.path);
    const filename = token.title ?? basename;
    let uploadedKey: string | undefined;

    try {
      // Null byte guard — reject before any fs operations
      if (token.path.includes('\0')) {
        throw new Error(`Path traversal detected: ${token.path}`);
      }

      // Pre-resolve check: reject obviously bad paths (relative traversal, absolute outside workspace)
      if (!isSafePath(token.path, workspaceRoot)) {
        throw new Error(`Path traversal detected: ${token.path}`);
      }

      // Resolve the path for fs operations
      const normalized = path.isAbsolute(token.path)
        ? path.resolve(token.path)
        : path.resolve(workspaceRoot, token.path);

      // Post-realpath check: catch symlink escapes
      let realPath: string;
      try {
        realPath = await fs.realpath(normalized);
      } catch {
        throw new Error(`File not found: ${token.path}`);
      }
      if (!realPath.startsWith(workspaceRoot + path.sep) && realPath !== workspaceRoot) {
        throw new Error(`Path traversal detected: ${token.path}`);
      }

      const ext = path.extname(realPath).toLowerCase();
      const mimeType = getMimeType(ext);

      if (!isAllowedContentType(mimeType)) {
        throw new Error(`Disallowed content type: ${mimeType}`);
      }

      // Fix 4: stat before read — check size without loading into memory
      const stat = await fs.stat(realPath);
      const maxBytes = maxBytesForType(mimeType);
      if (stat.size > maxBytes) {
        throw new Error(`File exceeds size limit (${stat.size} > ${maxBytes})`);
      }

      const fileBuffer = await fs.readFile(realPath);

      const stored = await storage.putFile({
        companyId,
        namespace: `issues/${issueId}/agent-attach`,
        originalFilename: path.basename(realPath),
        contentType: mimeType,
        body: fileBuffer,
      });
      uploadedKey = stored.objectKey;

      const [attachment] = await db
        .insert(attachments)
        .values({
          companyId,
          issueId,
          uploaderType: "agent",
          uploaderId: agentId,
          filename,
          mimeType,
          sizeBytes: fileBuffer.byteLength,
          storageKey: stored.objectKey,
          status: "processing",
        })
        .returning();

      const workerUrl = process.env.PAPERCLIP_MEDIA_WORKER_URL ?? process.env.MEDIA_WORKER_URL ?? "http://media-worker:8200";
      if (!isAllowedMediaWorkerOrigin(workerUrl)) {
        console.warn(`[attachment-resolver] Media worker URL rejected (SSRF guard): ${workerUrl}`);
      } else {
        fetch(`${workerUrl}/thumbnail`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ attachmentId: attachment.id, storageKey: stored.objectKey, mimeType }),
          signal: AbortSignal.timeout(15_000),
        })
          .then((r) => r.ok ? r.json() : null)
          .then(async (data: { thumbnailKey?: string } | null) => {
            if (data?.thumbnailKey) {
              await db.update(attachments)
                .set({ thumbnailKey: data.thumbnailKey, updatedAt: new Date() })
                .where(eq(attachments.id, attachment.id));
            }
          })
          .catch((err) => console.warn(`[attach-resolver] thumbnail failed for ${attachment.id}:`, (err as Error).message));
      }

      resolved.push({ ...token, attachmentId: attachment.id, filename });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      console.warn(`[attach-resolver] Token failed for ${token.path}: ${reason}`);
      failed.push({ ...token, filename, reason: classifyError(reason) });

      // Fix 2: clean up orphaned storage object if upload succeeded but DB insert failed
      if (uploadedKey) {
        await storage.deleteObject(companyId, uploadedKey).catch(() => {});
      }
    }
  }

  return { resolved, failed };
}

function isAllowedMediaWorkerOrigin(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return (
      hostname === "media-worker" ||
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "[::1]" ||
      hostname.endsWith(".internal") ||
      hostname.endsWith(".local")
    );
  } catch {
    return false;
  }
}

function classifyError(message: string): string {
  if (message.includes("Path traversal")) return "path_outside_workspace";
  if (message.includes("File not found")) return "file_not_found";
  if (message.includes("Disallowed content type")) return "disallowed_content_type";
  if (message.includes("exceeds size limit")) return "file_too_large";
  return "internal_error";
}

function getMimeType(ext: string): string {
  const map: Record<string, string> = {
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".doc": "application/msword",
    ".xls": "application/vnd.ms-excel",
    ".ppt": "application/vnd.ms-powerpoint",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".mov": "video/quicktime",
    ".avi": "video/avi",
    ".mkv": "video/x-matroska",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".ogg": "audio/ogg",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".txt": "text/plain",
    ".md": "text/markdown",
    ".csv": "text/csv",
    ".json": "application/json",
    ".xml": "application/xml",
    ".js": "text/javascript",
    ".ts": "text/typescript",
    ".py": "text/x-python",
  };
  return map[ext] ?? "application/octet-stream";
}

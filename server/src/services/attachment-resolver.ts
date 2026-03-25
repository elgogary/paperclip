import * as fs from "node:fs/promises";
import * as path from "node:path";
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
}

const ATTACH_REGEX = /\[\[attach:([^\]\|]+?)(?:\s*\|\s*title="([^"]*)")?\]\]/g;

export function parseAttachTokens(body: string): AttachToken[] {
  const tokens: AttachToken[] = [];
  let match: RegExpExecArray | null;
  ATTACH_REGEX.lastIndex = 0;
  while ((match = ATTACH_REGEX.exec(body)) !== null) {
    tokens.push({
      raw: match[0],
      path: match[1].trim(),
      title: match[2],
    });
  }
  return tokens;
}

export function replaceAttachTokens(body: string, resolved: ResolvedToken[]): string {
  let result = body;
  for (const token of resolved) {
    result = result.replace(token.raw, `[[attachment:${token.attachmentId}]]`);
  }
  return result;
}

export async function resolveAttachTokens(
  tokens: AttachToken[],
  opts: {
    companyId: string;
    issueId: string;
    agentId: string;
    db: Db;
    storage: StorageService;
  },
): Promise<ResolvedToken[]> {
  const { companyId, issueId, agentId, db, storage } = opts;
  const resolved: ResolvedToken[] = [];

  for (const token of tokens) {
    const normalized = path.normalize(token.path);
    if (!normalized.startsWith("/workspace/")) {
      console.warn(`[attach-resolver] Rejected path outside /workspace/: ${token.path}`);
      continue;
    }

    let fileBuffer: Buffer;
    try {
      fileBuffer = await fs.readFile(normalized);
    } catch (err) {
      console.warn(`[attach-resolver] Cannot read file ${normalized}:`, (err as Error).message);
      continue;
    }

    const filename = token.title ?? path.basename(normalized);
    const ext = path.extname(normalized).toLowerCase();
    const mimeType = getMimeType(ext);

    if (!isAllowedContentType(mimeType)) {
      console.warn(`[attach-resolver] Disallowed MIME type ${mimeType} for ${normalized}`);
      continue;
    }

    const maxBytes = maxBytesForType(mimeType);
    if (fileBuffer.byteLength > maxBytes) {
      console.warn(`[attach-resolver] File ${normalized} exceeds size limit (${fileBuffer.byteLength} > ${maxBytes})`);
      continue;
    }

    const stored = await storage.putFile({
      companyId,
      namespace: `issues/${issueId}/agent-attach`,
      originalFilename: path.basename(normalized),
      contentType: mimeType,
      body: fileBuffer,
    });

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
    fetch(`${workerUrl}/thumbnail`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attachmentId: attachment.id, storageKey: stored.objectKey, mimeType }),
    })
      .then((r) => { if (!r.ok) console.warn(`[attach-resolver] media-worker ${r.status}`); })
      .catch((err) => console.warn("[attach-resolver] media-worker unreachable:", (err as Error).message));

    resolved.push({ ...token, attachmentId: attachment.id });
  }

  return resolved;
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

/**
 * Build attachment context for agent runs.
 *
 * Queries attachments linked to a set of comment IDs, downloads content
 * from storage, and returns structured data that can be injected into
 * the agent's run context:
 *
 * - **visionBlocks** — base64-encoded images for API-based adapters
 * - **textSnippets** — extracted text from docs/code files
 * - **fileNotes** — plain-text notes for videos and unsupported types
 */
import { attachments, issueComments } from "@paperclipai/db";
import type { Db } from "@paperclipai/db";
import { eq, inArray, and, asc } from "drizzle-orm";
import type { StorageService } from "../storage/types.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ClaudeVisionBlock {
  type: "image";
  source: {
    type: "base64";
    media_type: string;
    data: string;
  };
}

export interface AttachmentContextResult {
  visionBlocks: ClaudeVisionBlock[];
  textSnippets: string[];
  fileNotes: string[];
  totalImageBytes: number;
  attachmentCount: number;
}

// ---------------------------------------------------------------------------
// Limits
// ---------------------------------------------------------------------------

const MAX_IMAGES_PER_RUN = 5;
const MAX_IMAGE_BYTES_PER_RUN = 10 * 1024 * 1024; // 10 MB
const MAX_DOC_EXTRACTS_PER_RUN = 3;
const MAX_DOC_CHARS = 2000;
const MAX_CODE_CHARS = 3000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isImageMime(mime: string): boolean {
  return mime.startsWith("image/");
}

function isVideoMime(mime: string): boolean {
  return mime.startsWith("video/");
}

function isDocMime(mime: string): boolean {
  return (
    mime === "application/pdf" ||
    mime.startsWith("application/vnd.openxmlformats-officedocument.")
  );
}

function isTextMime(mime: string): boolean {
  return mime.startsWith("text/");
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as unknown as Uint8Array));
  }
  return Buffer.concat(chunks);
}

function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

export async function buildAttachmentContext(
  commentIds: string[],
  deps: { db: Db; storage: StorageService; companyId: string },
): Promise<AttachmentContextResult> {
  const result: AttachmentContextResult = {
    visionBlocks: [],
    textSnippets: [],
    fileNotes: [],
    totalImageBytes: 0,
    attachmentCount: 0,
  };

  if (commentIds.length === 0) return result;

  // Fetch all ready attachments for the given comments, ordered by creation time (oldest first)
  let rows: Array<{
    id: string;
    commentId: string | null;
    filename: string;
    mimeType: string;
    sizeBytes: number;
    storageKey: string;
    thumbnailKey: string | null;
    htmlPreviewKey: string | null;
    status: string;
    createdAt: Date;
  }>;
  try {
    rows = await deps.db
      .select({
        id: attachments.id,
        commentId: attachments.commentId,
        filename: attachments.filename,
        mimeType: attachments.mimeType,
        sizeBytes: attachments.sizeBytes,
        storageKey: attachments.storageKey,
        thumbnailKey: attachments.thumbnailKey,
        htmlPreviewKey: attachments.htmlPreviewKey,
        status: attachments.status,
        createdAt: attachments.createdAt,
      })
      .from(attachments)
      .where(
        and(
          inArray(attachments.commentId, commentIds),
          eq(attachments.status, "ready"),
        ),
      )
      .orderBy(attachments.createdAt);
  } catch (err) {
    console.warn("[attachment-context] Failed to query attachments:", (err as Error).message);
    return result;
  }

  result.attachmentCount = rows.length;
  if (rows.length === 0) return result;

  let imageCount = 0;
  let docExtractCount = 0;

  for (const row of rows) {
    const { filename, mimeType, sizeBytes, storageKey, thumbnailKey, htmlPreviewKey } = row;
    const sizeLabel = formatSize(sizeBytes);

    // ----- Image attachments -----
    if (isImageMime(mimeType)) {
      if (imageCount >= MAX_IMAGES_PER_RUN) {
        result.fileNotes.push(`[Image skipped (limit reached): ${filename} (${sizeLabel})]`);
        continue;
      }
      if (result.totalImageBytes + sizeBytes > MAX_IMAGE_BYTES_PER_RUN) {
        result.fileNotes.push(`[Image skipped (size budget exceeded): ${filename} (${sizeLabel})]`);
        continue;
      }
      try {
        const obj = await deps.storage.getObject(deps.companyId, storageKey);
        const buf = await streamToBuffer(obj.stream);
        result.visionBlocks.push({
          type: "image",
          source: {
            type: "base64",
            media_type: mimeType,
            data: buf.toString("base64"),
          },
        });
        result.totalImageBytes += buf.length;
        imageCount++;
      } catch (err) {
        console.warn(`[attachment-context] Failed to download image ${filename}:`, (err as Error).message);
        result.fileNotes.push(`[Image unavailable: ${filename}]`);
      }
      continue;
    }

    // ----- Video attachments -----
    if (isVideoMime(mimeType)) {
      if (thumbnailKey) {
        // Use thumbnail as an image vision block (counts towards image limits)
        if (imageCount < MAX_IMAGES_PER_RUN && result.totalImageBytes < MAX_IMAGE_BYTES_PER_RUN) {
          try {
            const obj = await deps.storage.getObject(deps.companyId, thumbnailKey);
            const buf = await streamToBuffer(obj.stream);
            if (result.totalImageBytes + buf.length <= MAX_IMAGE_BYTES_PER_RUN) {
              result.visionBlocks.push({
                type: "image",
                source: {
                  type: "base64",
                  media_type: "image/png",
                  data: buf.toString("base64"),
                },
              });
              result.totalImageBytes += buf.length;
              imageCount++;
              result.fileNotes.push(`[Video thumbnail shown: ${filename} (${sizeLabel})]`);
              continue;
            }
          } catch (err) {
            console.warn(`[attachment-context] Failed to download video thumbnail for ${filename}:`, (err as Error).message);
          }
        }
      }
      result.fileNotes.push(`[Video attached: ${filename} (${sizeLabel})]`);
      continue;
    }

    // ----- Document attachments (PDF, Office) -----
    if (isDocMime(mimeType)) {
      if (htmlPreviewKey && docExtractCount < MAX_DOC_EXTRACTS_PER_RUN) {
        try {
          const obj = await deps.storage.getObject(deps.companyId, htmlPreviewKey);
          const buf = await streamToBuffer(obj.stream);
          const html = buf.toString("utf-8");
          const text = stripHtmlTags(html).slice(0, MAX_DOC_CHARS);
          result.textSnippets.push(
            `--- Document: ${filename} ---\n${text}${html.length > MAX_DOC_CHARS ? "\n[...truncated]" : ""}`,
          );
          docExtractCount++;
        } catch (err) {
          console.warn(`[attachment-context] Failed to download HTML preview for ${filename}:`, (err as Error).message);
          result.fileNotes.push(`[Document attached: ${filename} (${sizeLabel}) \u2014 text preview unavailable]`);
        }
      } else {
        result.fileNotes.push(`[Document attached: ${filename} (${sizeLabel}) \u2014 text preview unavailable]`);
      }
      continue;
    }

    // ----- Text/code attachments -----
    if (isTextMime(mimeType)) {
      try {
        const obj = await deps.storage.getObject(deps.companyId, storageKey);
        const buf = await streamToBuffer(obj.stream);
        const text = buf.toString("utf-8").slice(0, MAX_CODE_CHARS);
        result.textSnippets.push(
          `--- File: ${filename} ---\n\`\`\`\n${text}${buf.length > MAX_CODE_CHARS ? "\n... (truncated)" : ""}\n\`\`\``,
        );
      } catch (err) {
        console.warn(`[attachment-context] Failed to download text file ${filename}:`, (err as Error).message);
        result.fileNotes.push(`[File unavailable: ${filename}]`);
      }
      continue;
    }

    // ----- All other types -----
    result.fileNotes.push(`[File attached: ${filename} (${mimeType}, ${sizeLabel})]`);
  }

  return result;
}

/**
 * Build attachment context for all comments on an issue.
 * Convenience wrapper around `buildAttachmentContext`.
 */
export async function buildAttachmentContextForIssue(
  issueId: string,
  deps: { db: Db; storage: StorageService; companyId: string },
): Promise<AttachmentContextResult> {
  const comments = await deps.db
    .select({ id: issueComments.id })
    .from(issueComments)
    .where(eq(issueComments.issueId, issueId))
    .orderBy(asc(issueComments.createdAt));

  const commentIds = comments.map((c) => c.id);
  return buildAttachmentContext(commentIds, deps);
}

/**
 * Render the attachment context as a markdown string suitable for
 * injection into the agent prompt.
 */
export function renderAttachmentContextMarkdown(ctx: AttachmentContextResult): string {
  if (ctx.attachmentCount === 0) return "";

  const sections: string[] = [];

  if (ctx.visionBlocks.length > 0) {
    sections.push(`${ctx.visionBlocks.length} image(s) attached as vision blocks below.`);
  }

  if (ctx.textSnippets.length > 0) {
    sections.push(...ctx.textSnippets);
  }

  if (ctx.fileNotes.length > 0) {
    sections.push(...ctx.fileNotes);
  }

  if (sections.length === 0) return "";

  return `\n## Attachments\n\n${sections.join("\n\n")}\n`;
}

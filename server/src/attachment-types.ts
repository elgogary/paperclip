/**
 * Shared attachment content-type configuration.
 *
 * By default only image types are allowed.  Set the
 * `PAPERCLIP_ALLOWED_ATTACHMENT_TYPES` environment variable to a
 * comma-separated list of MIME types or wildcard patterns to expand the
 * allowed set.
 *
 * Examples:
 *   PAPERCLIP_ALLOWED_ATTACHMENT_TYPES=image/*,application/pdf
 *   PAPERCLIP_ALLOWED_ATTACHMENT_TYPES=image/*,application/pdf,text/*
 *
 * Supported pattern syntax:
 *   - Exact types:   "application/pdf"
 *   - Wildcards:     "image/*"  or  "application/vnd.openxmlformats-officedocument.*"
 */

export const DEFAULT_ALLOWED_TYPES: readonly string[] = [
  // Images
  "image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif",
  // Video
  "video/mp4", "video/webm", "video/quicktime", "video/avi", "video/x-matroska",
  // Audio
  "audio/mpeg", "audio/wav", "audio/ogg", "audio/webm",
  // Documents
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",  // docx
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",        // xlsx
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",// pptx
  "application/msword",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
  // Text / code
  "text/plain", "text/csv", "text/markdown",
  "application/json", "application/xml", "text/xml",
  "text/javascript", "text/typescript",
  "text/x-python", "text/x-java", "text/x-c", "text/x-csrc",
];

/**
 * Parse a comma-separated list of MIME type patterns into a normalised array.
 * Returns the default image-only list when the input is empty or undefined.
 */
export function parseAllowedTypes(raw: string | undefined): string[] {
  if (!raw) return [...DEFAULT_ALLOWED_TYPES];
  const parsed = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);
  return parsed.length > 0 ? parsed : [...DEFAULT_ALLOWED_TYPES];
}

/**
 * Check whether `contentType` matches any entry in `allowedPatterns`.
 *
 * Supports exact matches ("application/pdf") and wildcard / prefix
 * patterns ("image/*", "application/vnd.openxmlformats-officedocument.*").
 */
export function matchesContentType(contentType: string, allowedPatterns: string[]): boolean {
  const ct = contentType.toLowerCase();
  return allowedPatterns.some((pattern) => {
    if (pattern === "*") return true;
    if (pattern.endsWith("/*") || pattern.endsWith(".*")) {
      return ct.startsWith(pattern.slice(0, -1));
    }
    return ct === pattern;
  });
}

// ---------- Module-level singletons read once at startup ----------

const allowedPatterns: string[] = parseAllowedTypes(
  process.env.PAPERCLIP_ALLOWED_ATTACHMENT_TYPES,
);

/** Convenience wrapper using the process-level allowed list. */
export function isAllowedContentType(contentType: string): boolean {
  return matchesContentType(contentType, allowedPatterns);
}

export const MAX_ATTACHMENT_BYTES =
  Number(process.env.PAPERCLIP_ATTACHMENT_MAX_BYTES) || 100 * 1024 * 1024; // 100 MB

export const MAX_VIDEO_BYTES =
  Number(process.env.PAPERCLIP_VIDEO_MAX_BYTES) || 2 * 1024 * 1024 * 1024; // 2 GB

/** Returns true if the MIME type is a video format. */
export function isVideoType(mimeType: string): boolean {
  return mimeType.startsWith("video/");
}

/** Returns the maximum allowed bytes for a given MIME type. */
export function maxBytesForType(mimeType: string): number {
  return isVideoType(mimeType) ? MAX_VIDEO_BYTES : MAX_ATTACHMENT_BYTES;
}

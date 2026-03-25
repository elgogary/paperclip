import { spawn } from "node:child_process";
import sharp from "sharp";

const THUMB_WIDTH = 320;
const THUMB_HEIGHT = 180;

/**
 * Extract a single frame from a video buffer using ffmpeg (stdin/stdout).
 * Returns a JPEG Buffer or null on failure.
 */
export function videoThumbnail(videoBuffer) {
  return new Promise((resolve) => {
    const proc = spawn("ffmpeg", [
      "-i", "pipe:0",
      "-ss", "00:00:01",
      "-vframes", "1",
      "-vf", `scale=${THUMB_WIDTH}:${THUMB_HEIGHT}:force_original_aspect_ratio=decrease`,
      "-f", "image2",
      "-vcodec", "mjpeg",
      "-q:v", "5",
      "pipe:1",
    ], { stdio: ["pipe", "pipe", "pipe"] });

    const chunks = [];
    proc.stdout.on("data", (chunk) => chunks.push(chunk));

    proc.on("close", (code) => {
      if (code !== 0 || chunks.length === 0) {
        resolve(null);
        return;
      }
      resolve(Buffer.concat(chunks));
    });

    proc.on("error", () => resolve(null));

    proc.stdin.on("error", () => {
      // Broken pipe is expected if ffmpeg closes early
    });

    proc.stdin.end(videoBuffer);
  });
}

/**
 * Resize an image buffer to a thumbnail using sharp.
 * Returns a JPEG Buffer or null on failure.
 */
export async function imageThumbnail(imageBuffer) {
  try {
    const result = await sharp(imageBuffer)
      .resize(THUMB_WIDTH, null, { withoutEnlargement: true })
      .jpeg({ quality: 75 })
      .toBuffer();
    return result;
  } catch {
    return null;
  }
}

/**
 * Generate a thumbnail for the given buffer+mimeType.
 * Returns { thumbnailDataBase64: string } or { thumbnailDataBase64: null }.
 */
export async function generateThumbnail(buffer, mimeType) {
  let thumbBuf = null;

  if (mimeType.startsWith("video/")) {
    thumbBuf = await videoThumbnail(buffer);
  } else if (mimeType.startsWith("image/")) {
    thumbBuf = await imageThumbnail(buffer);
  }
  // PDFs and Office docs: skip gracefully

  return {
    thumbnailDataBase64: thumbBuf ? thumbBuf.toString("base64") : null,
  };
}

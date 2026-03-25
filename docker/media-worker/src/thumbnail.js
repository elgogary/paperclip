import { spawn } from "node:child_process";
import { createReadStream } from "node:fs";
import sharp from "sharp";

const THUMB_WIDTH = 320;
const THUMB_HEIGHT = 180;

/**
 * Extract a single frame from a video file on disk using ffmpeg.
 * Returns a JPEG Buffer or null on failure.
 */
export function videoThumbnail(inputPath) {
  return new Promise((resolve) => {
    const proc = spawn("ffmpeg", [
      "-i", inputPath,
      "-ss", "00:00:01",
      "-vframes", "1",
      "-vf", `scale=${THUMB_WIDTH}:${THUMB_HEIGHT}:force_original_aspect_ratio=decrease`,
      "-f", "image2",
      "-vcodec", "mjpeg",
      "-q:v", "5",
      "pipe:1",
    ], { stdio: ["ignore", "pipe", "pipe"] });

    const outputChunks = [];
    proc.stdout.on("data", (chunk) => outputChunks.push(chunk));

    let stderrData = "";
    proc.stderr.on("data", (d) => { stderrData += d; });

    proc.on("close", (code) => {
      if (code !== 0) {
        console.error(`[thumbnail] ffmpeg exited ${code}${stderrData ? ": " + stderrData.slice(0, 200) : ""}`);
        resolve(null);
      } else {
        resolve(outputChunks.length ? Buffer.concat(outputChunks) : null);
      }
    });

    proc.on("error", () => resolve(null));
  });
}

/**
 * Resize an image file on disk to a thumbnail using sharp.
 * Returns a JPEG Buffer or null on failure.
 */
export async function imageThumbnail(inputPath) {
  try {
    const result = await sharp(inputPath)
      .resize(THUMB_WIDTH, null, { withoutEnlargement: true })
      .jpeg({ quality: 75 })
      .toBuffer();
    return result;
  } catch {
    return null;
  }
}

/**
 * Generate a thumbnail for the given file on disk.
 * Returns { thumbnailDataBase64: string } or { thumbnailDataBase64: null }.
 */
export async function generateThumbnail(inputPath, mimeType) {
  let thumbBuf = null;

  if (mimeType.startsWith("video/")) {
    thumbBuf = await videoThumbnail(inputPath);
  } else if (mimeType.startsWith("image/")) {
    thumbBuf = await imageThumbnail(inputPath);
  }
  // PDFs and Office docs: skip gracefully

  return {
    thumbnailDataBase64: thumbBuf ? thumbBuf.toString("base64") : null,
  };
}

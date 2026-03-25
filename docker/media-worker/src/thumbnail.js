import { spawn } from "node:child_process";

const THUMB_WIDTH = 1200;

/**
 * Extract a single frame from a video file on disk using ffmpeg.
 * Returns a JPEG Buffer or null on failure.
 */
export function videoThumbnail(inputPath) {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", [
      "-i", inputPath,
      "-ss", "00:00:01",
      "-vframes", "1",
      "-vf", `scale=${THUMB_WIDTH}:-1:force_original_aspect_ratio=decrease`,
      "-f", "image2",
      "-vcodec", "mjpeg",
      "-q:v", "5",
      "pipe:1",
    ], { stdio: ["ignore", "pipe", "pipe"] });

    const timeoutMs = 30_000;
    const timer = setTimeout(() => proc.kill("SIGKILL"), timeoutMs);

    const outputChunks = [];
    proc.stdout.on("data", (chunk) => outputChunks.push(chunk));

    let stderrData = "";
    proc.stderr.on("data", (d) => { stderrData += d; });

    proc.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        console.error(`[thumbnail] ffmpeg exited ${code}${stderrData ? ": " + stderrData.slice(0, 200) : ""}`);
        resolve(null);
      } else {
        resolve(outputChunks.length ? Buffer.concat(outputChunks) : null);
      }
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      console.error("[media-worker] ffmpeg error:", err.message);
      reject(err);
    });
  });
}

import express from "express";
import { mkdtemp } from "node:fs/promises";
import * as fs from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { videoThumbnail } from "./thumbnail.js";
import { convertToHtml, isOfficeType, MIME_TO_EXT } from "./convert.js";
import { extractText, SUPPORTED_EXTRACT_TYPES } from "./extract.js";
import { getObject, putObject } from "./storage.js";

const VERSION = "1.0.0";

export function createApp() {
  const app = express();
  app.use(express.json({ limit: "50kb" }));

  // Health check
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", version: VERSION });
  });

  // POST /thumbnail — generate thumbnail from a storageKey (MinIO object key)
  // Also accepts POST /jobs/thumbnail for backward compat with Paperclip server
  async function handleThumbnail(req, res) {
    const { storageKey, mimeType, attachmentId } = req.body ?? {};

    if (!storageKey || !mimeType) {
      res.status(400).json({ error: "storageKey and mimeType are required" });
      return;
    }

    // Skip types we cannot thumbnail
    if (!mimeType.startsWith("image/") && !mimeType.startsWith("video/")) {
      res.json({ thumbnailKey: null });
      return;
    }

    const workDir = await mkdtemp(join(tmpdir(), "media-thumb-"));

    try {
      const buffer = await getObject(storageKey);
      let thumbBuf = null;

      if (mimeType.startsWith("video/")) {
        // Video: write to temp file for ffmpeg
        const ext = mimeType.split("/")[1]?.split("+")[0] || "bin";
        const inputPath = join(workDir, `input.${ext}`);
        await fs.writeFile(inputPath, buffer);
        thumbBuf = await videoThumbnail(inputPath);
      } else if (mimeType.startsWith("image/")) {
        // Image: process buffer directly with sharp
        thumbBuf = await sharp(buffer)
          .resize(1200, null, { withoutEnlargement: true })
          .jpeg({ quality: 75 })
          .toBuffer();
      }

      if (!thumbBuf) {
        res.json({ thumbnailKey: null, attachmentId: attachmentId || null });
        return;
      }

      const thumbnailKey = `thumbnails/${storageKey}.jpg`;
      await putObject(thumbnailKey, thumbBuf, "image/jpeg");
      res.json({ thumbnailKey, attachmentId: attachmentId || null });
    } catch (err) {
      res.status(500).json({ error: err.message || "Thumbnail generation failed" });
    } finally {
      try { await fs.rm(workDir, { recursive: true, force: true }); } catch {}
    }
  }

  app.post("/thumbnail", handleThumbnail);
  app.post("/jobs/thumbnail", handleThumbnail);

  // POST /convert — convert Office doc to HTML
  app.post("/convert", async (req, res) => {
    const { storageKey, mimeType, targetFormat } = req.body ?? {};

    if (!storageKey || !mimeType) {
      res.status(400).json({ error: "storageKey and mimeType are required" });
      return;
    }

    if (!isOfficeType(mimeType)) {
      res.status(400).json({ error: "Unsupported MIME type for conversion: " + mimeType });
      return;
    }

    const workDir = await mkdtemp(join(tmpdir(), "media-worker-"));
    const ext = MIME_TO_EXT[mimeType] || "bin";
    const inputPath = join(workDir, `input.${ext}`);

    try {
      const buffer = await getObject(storageKey);
      await fs.writeFile(inputPath, buffer);
      const result = await convertToHtml(inputPath, workDir);

      if (result.error) {
        res.status(500).json(result);
        return;
      }

      const outputKey = `converted/${storageKey}.html`;
      await putObject(outputKey, result.htmlBuffer, "text/html");
      res.json({ outputKey });
    } catch (err) {
      res.status(500).json({ error: err.message || "Conversion failed" });
    }
    // workDir cleanup is handled inside convertToHtml's finally block
  });

  // POST /extract — extract text from a document
  app.post("/extract", async (req, res) => {
    const { storageKey, mimeType } = req.body ?? {};

    if (!storageKey || !mimeType) {
      res.status(400).json({ error: "storageKey and mimeType are required" });
      return;
    }

    if (!SUPPORTED_EXTRACT_TYPES.has(mimeType)) {
      res.status(422).json({ error: "Unsupported MIME type for extraction: " + mimeType });
      return;
    }

    try {
      const buffer = await getObject(storageKey);
      const text = await extractText(buffer, mimeType);
      res.json({ text: text ?? "" });
    } catch (err) {
      res.status(500).json({ error: err.message || "Text extraction failed" });
    }
  });

  return app;
}

// Start server if run directly (not imported for testing)
const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain && typeof globalThis.__vitest_worker__ === "undefined") {
  const port = parseInt(process.env.PORT || "3200", 10);
  const app = createApp();
  app.listen(port, "0.0.0.0", () => {
    console.log(`media-worker listening on port ${port}`);
  });
}

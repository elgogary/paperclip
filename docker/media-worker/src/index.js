import express from "express";
import { createWriteStream } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import * as fs from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { URL } from "node:url";
import { fileURLToPath } from "node:url";
import { generateThumbnail } from "./thumbnail.js";
import { convertToHtml, isOfficeType, MIME_TO_EXT } from "./convert.js";
import { extractText, SUPPORTED_EXTRACT_TYPES } from "./extract.js";

const VERSION = "1.0.0";

/**
 * Download a URL to a local file path using streams (no in-memory buffering).
 */
async function downloadToFile(url, destPath) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed: ${response.status}`);
  await pipeline(response.body, createWriteStream(destPath));
}

/**
 * SSRF guard — block requests to internal/private networks unless explicitly allowed.
 */
function assertSafeUrl(urlString) {
  let url;
  try { url = new URL(urlString); } catch { throw new Error("Invalid URL"); }

  const allowed = process.env.ALLOWED_STORAGE_HOST || "";
  const hostname = url.hostname;

  // Reject RFC-1918, link-local, loopback
  const blocked = /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|169\.254\.|::1$|\[::1\]$)/;
  if (blocked.test(hostname) && hostname !== allowed) {
    throw new Error(`SSRF guard: blocked internal host ${hostname}`);
  }

  // Only allow http/https
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("SSRF guard: only http/https allowed");
  }
}

export function createApp() {
  const app = express();
  app.use(express.json({ limit: "50kb" }));

  // Health check
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", version: VERSION });
  });

  // POST /thumbnail — generate thumbnail from a storageUrl
  // Also accepts POST /jobs/thumbnail for backward compat with Paperclip server
  async function handleThumbnail(req, res) {
    const { storageUrl, mimeType, attachmentId } = req.body ?? {};

    if (!storageUrl || !mimeType) {
      res.status(400).json({ error: "storageUrl and mimeType are required" });
      return;
    }

    try {
      assertSafeUrl(storageUrl);
    } catch (err) {
      res.status(400).json({ error: err.message });
      return;
    }

    // Skip types we cannot thumbnail
    if (!mimeType.startsWith("image/") && !mimeType.startsWith("video/")) {
      res.json({ thumbnailDataBase64: null });
      return;
    }

    const workDir = await mkdtemp(join(tmpdir(), "media-thumb-"));
    const ext = mimeType.split("/")[1]?.split("+")[0] || "bin";
    const inputPath = join(workDir, `input.${ext}`);

    try {
      await downloadToFile(storageUrl, inputPath);
      const result = await generateThumbnail(inputPath, mimeType);
      res.json({ ...result, attachmentId: attachmentId || null });
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
    const { storageUrl, mimeType } = req.body ?? {};

    if (!storageUrl || !mimeType) {
      res.status(400).json({ error: "storageUrl and mimeType are required" });
      return;
    }

    try {
      assertSafeUrl(storageUrl);
    } catch (err) {
      res.status(400).json({ error: err.message });
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
      await downloadToFile(storageUrl, inputPath);
      const result = await convertToHtml(inputPath, workDir);

      if (result.error) {
        res.status(500).json(result);
        return;
      }
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message || "Conversion failed" });
    }
    // workDir cleanup is handled inside convertToHtml's finally block
  });

  // POST /extract — extract text from a document
  app.post("/extract", async (req, res) => {
    const { storageUrl, mimeType } = req.body ?? {};

    if (!storageUrl || !mimeType) {
      res.status(400).json({ error: "storageUrl and mimeType are required" });
      return;
    }

    try {
      assertSafeUrl(storageUrl);
    } catch (err) {
      res.status(400).json({ error: err.message });
      return;
    }

    if (!SUPPORTED_EXTRACT_TYPES.has(mimeType)) {
      res.status(422).json({ error: "Unsupported MIME type for extraction: " + mimeType });
      return;
    }

    const workDir = await mkdtemp(join(tmpdir(), "media-extract-"));
    const ext = mimeType.split("/")[1]?.split("+")[0] || "bin";
    const inputPath = join(workDir, `input.${ext}`);

    try {
      await downloadToFile(storageUrl, inputPath);
      const buffer = await fs.readFile(inputPath);
      const text = await extractText(buffer, mimeType);
      res.json({ text: text ?? "" });
    } catch (err) {
      res.status(500).json({ error: err.message || "Text extraction failed" });
    } finally {
      try { await fs.rm(workDir, { recursive: true, force: true }); } catch {}
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

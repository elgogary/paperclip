import express from "express";
import { generateThumbnail } from "./thumbnail.js";
import { convertToHtml, isOfficeType } from "./convert.js";

const VERSION = "1.0.0";

export function createApp() {
  const app = express();
  app.use(express.json({ limit: "200mb" }));

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

    // Skip types we cannot thumbnail
    if (!mimeType.startsWith("image/") && !mimeType.startsWith("video/")) {
      res.json({ thumbnailDataBase64: null });
      return;
    }

    try {
      const response = await fetch(storageUrl);
      if (!response.ok) {
        res.status(502).json({ error: "Failed to fetch file: " + response.status });
        return;
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      const result = await generateThumbnail(buffer, mimeType);
      res.json({ ...result, attachmentId: attachmentId || null });
    } catch (err) {
      res.status(500).json({ error: err.message || "Thumbnail generation failed" });
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

    if (!isOfficeType(mimeType)) {
      res.status(400).json({ error: "Unsupported MIME type for conversion: " + mimeType });
      return;
    }

    try {
      const response = await fetch(storageUrl);
      if (!response.ok) {
        res.status(502).json({ error: "Failed to fetch file: " + response.status });
        return;
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      const result = await convertToHtml(buffer, mimeType);

      if (result.error) {
        res.status(500).json(result);
        return;
      }
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message || "Conversion failed" });
    }
  });

  return app;
}

// Start server if run directly (not imported for testing)
const isMain = !process.argv[1] || process.argv[1].endsWith("index.js");
if (isMain && typeof globalThis.__vitest_worker__ === "undefined") {
  const port = parseInt(process.env.PORT || "3200", 10);
  const app = createApp();
  app.listen(port, "0.0.0.0", () => {
    console.log(`media-worker listening on port ${port}`);
  });
}

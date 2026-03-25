import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

// Mock storage module before importing the app
vi.mock("../storage.js", () => ({
  getObject: vi.fn(),
  putObject: vi.fn(),
}));

// Mock sharp (imported directly in index.js for thumbnail)
vi.mock("sharp", () => {
  const fn = vi.fn(() => ({
    resize: vi.fn().mockReturnThis(),
    jpeg: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from("fake-jpeg")),
  }));
  fn.default = fn;
  return { default: fn };
});

import { createApp } from "../index.js";
import { getObject, putObject } from "../storage.js";

describe("GET /health", () => {
  it("returns ok", async () => {
    const app = createApp();
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.version).toBe("1.0.0");
  });
});

describe("POST /thumbnail", () => {
  let app;
  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
  });

  it("returns 400 when storageKey is missing", async () => {
    const res = await request(app)
      .post("/thumbnail")
      .send({ mimeType: "image/png" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/storageKey/);
  });

  it("returns 400 when mimeType is missing", async () => {
    const res = await request(app)
      .post("/thumbnail")
      .send({ storageKey: "uploads/file.png" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/mimeType/);
  });

  it("returns 422 for unsupported mime type", async () => {
    const res = await request(app)
      .post("/thumbnail")
      .send({ storageKey: "uploads/file.pdf", mimeType: "application/pdf" });
    expect(res.status).toBe(422);
    expect(res.body.error).toBe("unsupported_mime_type");
    expect(res.body.mimeType).toBe("application/pdf");
  });

  it("fetches from MinIO and returns thumbnailKey for images", async () => {
    getObject.mockResolvedValue(Buffer.from("fake-image-data"));
    putObject.mockResolvedValue(undefined);

    const res = await request(app)
      .post("/thumbnail")
      .send({ storageKey: "uploads/photo.png", mimeType: "image/png" });

    expect(res.status).toBe(200);
    expect(res.body.thumbnailKey).toBe("thumbnails/uploads/photo.png.jpg");
    expect(getObject).toHaveBeenCalledWith("uploads/photo.png");
    expect(putObject).toHaveBeenCalledWith(
      "thumbnails/uploads/photo.png.jpg",
      expect.any(Buffer),
      "image/jpeg",
    );
  });
});

describe("POST /convert", () => {
  let app;
  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
  });

  it("returns 400 when storageKey is missing", async () => {
    const res = await request(app)
      .post("/convert")
      .send({ mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/storageKey/);
  });

  it("returns 400 when mimeType is missing", async () => {
    const res = await request(app)
      .post("/convert")
      .send({ storageKey: "uploads/file.docx" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/mimeType/);
  });

  it("returns 422 for unsupported mime type", async () => {
    const res = await request(app)
      .post("/convert")
      .send({ storageKey: "uploads/file.txt", mimeType: "text/plain" });
    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/Unsupported/);
  });
});

describe("POST /extract", () => {
  let app;
  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
  });

  it("returns 400 when storageKey is missing", async () => {
    const res = await request(app)
      .post("/extract")
      .send({ mimeType: "application/pdf" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/storageKey/);
  });

  it("returns 400 when mimeType is missing", async () => {
    const res = await request(app)
      .post("/extract")
      .send({ storageKey: "uploads/file.pdf" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/mimeType/);
  });

  it("returns 422 for unsupported mime type", async () => {
    const res = await request(app)
      .post("/extract")
      .send({ storageKey: "uploads/file.png", mimeType: "image/png" });
    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/Unsupported/);
  });

  it("fetches from MinIO and returns extracted text", async () => {
    getObject.mockResolvedValue(Buffer.from("col1,col2\nval1,val2\n"));

    const res = await request(app)
      .post("/extract")
      .send({ storageKey: "uploads/data.csv", mimeType: "text/csv" });

    expect(res.status).toBe(200);
    expect(res.body.text).toContain("col1");
    expect(getObject).toHaveBeenCalledWith("uploads/data.csv");
  });
});

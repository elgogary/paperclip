import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../index.js";

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
    app = createApp();
  });

  it("returns 400 when storageUrl is missing", async () => {
    const res = await request(app)
      .post("/thumbnail")
      .send({ mimeType: "image/png" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/storageUrl/);
  });

  it("returns 400 when mimeType is missing", async () => {
    const res = await request(app)
      .post("/thumbnail")
      .send({ storageUrl: "https://example.com/file.png" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/mimeType/);
  });

  it("returns null thumbnail for application/pdf", async () => {
    const res = await request(app)
      .post("/thumbnail")
      .send({ storageUrl: "https://example.com/file.pdf", mimeType: "application/pdf" });
    expect(res.status).toBe(200);
    expect(res.body.thumbnailDataBase64).toBeNull();
  });

  it("blocks SSRF attempts to internal hosts", async () => {
    const res = await request(app)
      .post("/thumbnail")
      .send({ storageUrl: "http://127.0.0.1:9000/bucket/file.png", mimeType: "image/png" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/SSRF/);
  });

  it("blocks non-http protocols", async () => {
    const res = await request(app)
      .post("/thumbnail")
      .send({ storageUrl: "file:///etc/passwd", mimeType: "image/png" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/SSRF/);
  });
});

describe("POST /convert", () => {
  let app;
  beforeEach(() => {
    app = createApp();
  });

  it("returns 400 when storageUrl is missing", async () => {
    const res = await request(app)
      .post("/convert")
      .send({ mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/storageUrl/);
  });

  it("returns 400 when mimeType is missing", async () => {
    const res = await request(app)
      .post("/convert")
      .send({ storageUrl: "https://example.com/file.docx" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/mimeType/);
  });

  it("returns 400 for unsupported mime type", async () => {
    const res = await request(app)
      .post("/convert")
      .send({ storageUrl: "https://example.com/file.txt", mimeType: "text/plain" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Unsupported/);
  });

  it("blocks SSRF attempts to 192.168.x.x", async () => {
    const res = await request(app)
      .post("/convert")
      .send({
        storageUrl: "http://192.168.1.1/file.docx",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/SSRF/);
  });
});

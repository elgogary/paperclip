import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { errorHandler } from "../middleware/index.js";
import { attachmentRoutes } from "../routes/attachments.js";

// --- Mocks ---

const mockReturning = vi.fn();
const mockWhere = vi.fn(() => ({ returning: mockReturning }));
const mockValues = vi.fn(() => ({ returning: mockReturning }));
const mockSetFn = vi.fn(() => ({ where: mockWhere }));
const mockFrom = vi.fn(() => ({ where: mockWhere }));

const mockDb = {
  insert: vi.fn(() => ({ values: mockValues })),
  select: vi.fn(() => ({ from: mockFrom })),
  update: vi.fn(() => ({ set: mockSetFn })),
  delete: vi.fn(() => ({ where: vi.fn() })),
};

vi.mock("@paperclipai/db", () => ({
  attachments: { id: "id", companyId: "company_id", issueId: "issue_id", status: "status" },
  issues: { id: "id", companyId: "company_id" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => args),
  and: vi.fn((...args: unknown[]) => args),
}));

vi.mock("../services/index.js", () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
}));

const mockStorage = {
  provider: "local_disk" as const,
  putFile: vi.fn().mockResolvedValue({
    provider: "local_disk",
    objectKey: "company-1/attachments/file.png",
    contentType: "image/png",
    byteSize: 1024,
    sha256: "abc123",
    originalFilename: "file.png",
  }),
  getObject: vi.fn(),
  headObject: vi.fn(),
  deleteObject: vi.fn(),
  putRawObject: vi.fn().mockResolvedValue(undefined),
  getRawObject: vi.fn().mockResolvedValue(Buffer.from("chunk-data")),
};

function createApp(actorOverrides: Record<string, unknown> = {}) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).actor = {
      type: "board",
      userId: "user-1",
      companyIds: ["company-1"],
      source: "session",
      isInstanceAdmin: false,
      ...actorOverrides,
    };
    next();
  });
  app.use("/api/attachments", attachmentRoutes(mockDb as any, mockStorage as any));
  app.use(errorHandler);
  return app;
}

describe("attachment routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-establish default mock chain after clearAllMocks
    mockFrom.mockImplementation(() => ({ where: mockWhere }));
    mockSetFn.mockImplementation(() => ({ where: mockWhere }));
    mockWhere.mockImplementation(() => ({ returning: mockReturning }));
  });

  describe("POST /api/attachments/init", () => {
    it("rejects disallowed MIME type with 415", async () => {
      const res = await request(createApp())
        .post("/api/attachments/init")
        .send({
          filename: "malware.exe",
          mimeType: "application/x-msdownload",
          sizeBytes: 1024,
          issueId: "issue-1",
          companyId: "company-1",
        });

      expect(res.status).toBe(415);
      expect(res.body.error).toMatch(/unsupported content type/i);
    });

    it("rejects oversized file with 413", async () => {
      const res = await request(createApp())
        .post("/api/attachments/init")
        .send({
          filename: "big.png",
          mimeType: "image/png",
          sizeBytes: 200 * 1024 * 1024 * 1024,
          issueId: "issue-1",
          companyId: "company-1",
        });

      expect(res.status).toBe(413);
      expect(res.body.error).toMatch(/too large/i);
    });

    it("rejects missing filename with 400", async () => {
      const res = await request(createApp())
        .post("/api/attachments/init")
        .send({
          mimeType: "image/png",
          sizeBytes: 1024,
          issueId: "issue-1",
          companyId: "company-1",
        });

      expect(res.status).toBe(400);
    });

    it("rejects missing issueId with 400", async () => {
      const res = await request(createApp())
        .post("/api/attachments/init")
        .send({
          filename: "photo.png",
          mimeType: "image/png",
          sizeBytes: 1024,
          companyId: "company-1",
        });

      expect(res.status).toBe(400);
    });

    it("rejects unauthenticated with 401", async () => {
      const res = await request(createApp({ type: "none" }))
        .post("/api/attachments/init")
        .send({
          filename: "photo.png",
          mimeType: "image/png",
          sizeBytes: 1024,
          issueId: "issue-1",
          companyId: "company-1",
        });

      expect(res.status).toBe(401);
    });

    it("rejects dangerous filenames with 400", async () => {
      const res = await request(createApp())
        .post("/api/attachments/init")
        .send({
          filename: "../../etc/passwd",
          mimeType: "image/png",
          sizeBytes: 1024,
          issueId: "issue-1",
          companyId: "company-1",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/invalid filename/i);
    });

    it("succeeds with valid payload and returns attachmentId", async () => {
      // First db.select: issue ownership check
      mockWhere.mockResolvedValueOnce([{ id: "issue-1", companyId: "company-1" }]);
      // Then db.insert().values().returning()
      mockReturning.mockResolvedValueOnce([
        { id: "att-new", companyId: "company-1", issueId: "issue-1" },
      ]);

      const res = await request(createApp())
        .post("/api/attachments/init")
        .send({
          filename: "photo.png",
          mimeType: "image/png",
          sizeBytes: 1024,
          issueId: "issue-1",
          companyId: "company-1",
        });

      expect(res.status).toBe(201);
      expect(res.body.attachmentId).toBe("att-new");
    });

    it("returns 404 when issue does not belong to company", async () => {
      mockWhere.mockResolvedValueOnce([{ id: "issue-1", companyId: "other-company" }]);

      const res = await request(createApp())
        .post("/api/attachments/init")
        .send({
          filename: "photo.png",
          mimeType: "image/png",
          sizeBytes: 1024,
          issueId: "issue-1",
          companyId: "company-1",
        });

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/issue not found/i);
    });
  });

  describe("PUT /api/attachments/:id/chunk", () => {
    it("returns 400 when Content-Range header is missing", async () => {
      const res = await request(createApp())
        .put("/api/attachments/att-1/chunk")
        .send(Buffer.from("data"));

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/content-range/i);
    });

    it("returns 403 when attachment belongs to a different company", async () => {
      mockWhere.mockResolvedValueOnce([
        {
          id: "att-1",
          companyId: "other-company",
          storageKey: "",
          sizeBytes: 100,
          mimeType: "image/png",
          filename: "file.png",
          status: "uploading",
        },
      ]);

      const res = await request(createApp())
        .put("/api/attachments/att-1/chunk")
        .set("Content-Range", "bytes 0-3/100")
        .set("Content-Type", "application/octet-stream")
        .send(Buffer.from("data"));

      expect(res.status).toBe(403);
    });
  });

  describe("POST /api/attachments/:id/complete", () => {
    it("returns 401 for unauthenticated request", async () => {
      const res = await request(createApp({ type: "none" }))
        .post("/api/attachments/att-1/complete")
        .send({});

      expect(res.status).toBe(401);
    });

    it("returns 403 when attachment belongs to a different company", async () => {
      // Atomic update returns a row from different company
      mockReturning.mockResolvedValueOnce([
        {
          id: "att-1",
          companyId: "other-company",
          storageKey: "",
          sizeBytes: 10,
          mimeType: "text/plain",
          filename: "file.txt",
        },
      ]);

      const res = await request(createApp())
        .post("/api/attachments/att-1/complete")
        .send({});

      expect(res.status).toBe(403);
    });

    it("links commentId when provided in complete request", async () => {
      const chunkData = Buffer.from("hello file");
      // Atomic update returns the row
      mockReturning.mockResolvedValueOnce([
        {
          id: "att-1",
          companyId: "company-1",
          storageKey: "",
          sizeBytes: chunkData.length,
          mimeType: "text/plain",
          filename: "file.txt",
        },
      ]);
      mockStorage.getRawObject.mockResolvedValueOnce(chunkData);

      const res = await request(createApp())
        .post("/api/attachments/att-1/complete")
        .send({ commentId: "comment-99" });

      expect(res.status).toBe(200);
      // Verify the second update was called with commentId
      expect(mockSetFn).toHaveBeenCalled();
      const lastSetCall = mockSetFn.mock.calls[mockSetFn.mock.calls.length - 1][0];
      expect(lastSetCall.commentId).toBe("comment-99");
    });
  });

  describe("GET /api/attachments/:id", () => {
    it("returns 404 for non-existent attachment", async () => {
      mockWhere.mockResolvedValueOnce([]);

      const res = await request(createApp())
        .get("/api/attachments/nonexistent-id");

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/not found/i);
    });

    it("returns 403 for attachment belonging to different company", async () => {
      mockWhere.mockResolvedValueOnce([
        {
          id: "att-1",
          companyId: "other-company",
          issueId: "issue-1",
          storageKey: "other-company/attachments/file.png",
          mimeType: "image/png",
          thumbnailKey: null,
          htmlPreviewKey: null,
        },
      ]);

      const res = await request(createApp())
        .get("/api/attachments/att-1");

      expect(res.status).toBe(403);
    });

    it("returns attachment DTO without internal keys for valid request", async () => {
      mockWhere.mockResolvedValueOnce([
        {
          id: "att-1",
          companyId: "company-1",
          issueId: "issue-1",
          commentId: null,
          uploaderType: "user",
          uploaderId: "user-1",
          storageKey: "company-1/attachments/file.png",
          mimeType: "image/png",
          filename: "file.png",
          sizeBytes: 1024,
          thumbnailKey: null,
          htmlPreviewKey: null,
          versionOf: null,
          versionNum: 1,
          status: "ready",
          publishUrl: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]);

      const res = await request(createApp())
        .get("/api/attachments/att-1");

      expect(res.status).toBe(200);
      expect(res.body.downloadUrl).toBe("/api/attachments/att-1/content");
      expect(res.body.id).toBe("att-1");
      // Fix 8: DTO should NOT include storageKey or htmlPreviewKey
      expect(res.body).not.toHaveProperty("storageKey");
      expect(res.body).not.toHaveProperty("htmlPreviewKey");
    });

    it("returns 401 for unauthenticated requests", async () => {
      const res = await request(createApp({ type: "none" }))
        .get("/api/attachments/att-1");

      expect(res.status).toBe(401);
    });
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { attachmentRoutes } from "../routes/attachments.js";
import type { StorageService } from "../storage/types.js";

// ---- Mocks ----------------------------------------------------------------

const insertReturningMock = vi.fn();
const selectWhereMock = vi.fn();
const updateReturningMock = vi.fn();
const updateWhereMock = vi.fn(() => ({ returning: updateReturningMock }));
const updateSetMock = vi.fn(() => ({ where: updateWhereMock }));
const deleteWhereMock = vi.fn();
const logActivityMock = vi.fn();

vi.mock("../services/index.js", () => ({
  logActivity: (...args: unknown[]) => logActivityMock(...args),
}));

// Build a minimal Drizzle-like DB mock
function createDbMock() {
  const returning = vi.fn(() => insertReturningMock());
  const insertValues = vi.fn(() => ({ returning }));
  const insertFn = vi.fn(() => ({ values: insertValues }));

  const selectFrom = vi.fn(() => ({
    where: selectWhereMock,
  }));
  const selectFn = vi.fn(() => ({ from: selectFrom }));

  const updateFn = vi.fn(() => ({ set: updateSetMock }));

  const deleteFn = vi.fn(() => ({ where: deleteWhereMock }));

  return {
    insert: insertFn,
    select: selectFn,
    update: updateFn,
    delete: deleteFn,
  } as any;
}

function createStorageMock(): StorageService {
  return {
    provider: "s3" as any,
    putFile: vi.fn(async () => ({
      provider: "s3" as any,
      objectKey: "test-key",
      contentType: "application/octet-stream",
      byteSize: 100,
      sha256: "abc123",
      originalFilename: null,
    })),
    getObject: vi.fn(),
    headObject: vi.fn(),
    deleteObject: vi.fn(),
    putRawObject: vi.fn().mockResolvedValue(undefined),
    getRawObject: vi.fn().mockResolvedValue(Buffer.from("chunk-data")),
  } as any;
}

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "att-1",
    companyId: "company-1",
    issueId: "issue-1",
    commentId: null,
    uploaderType: "user",
    uploaderId: "user-1",
    filename: "test.png",
    mimeType: "image/png",
    sizeBytes: 1024,
    storageKey: "company-1/files/att-1/test.png",
    thumbnailKey: null,
    htmlPreviewKey: null,
    versionOf: null,
    versionNum: 1,
    status: "uploading",
    publishUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

type ActorOverrides = {
  type?: string;
  source?: string;
  userId?: string;
  companyId?: string;
  companyIds?: string[];
  isInstanceAdmin?: boolean;
  agentId?: string;
};

function createApp(
  db: ReturnType<typeof createDbMock>,
  storage: StorageService,
  actor: ActorOverrides = {},
) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.actor = {
      type: "board",
      source: "local_implicit",
      userId: "user-1",
      companyIds: ["company-1"],
      ...actor,
    } as any;
    next();
  });
  app.use("/api/attachments", attachmentRoutes(db, storage));
  // Error handler to convert thrown HttpError into JSON responses
  app.use((err: any, _req: any, res: any, _next: any) => {
    const status = err.status || 500;
    res.status(status).json({ error: err.message || "Internal Server Error" });
  });
  return app;
}

// ---- Tests -----------------------------------------------------------------

describe("POST /api/attachments/init", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("validates required fields — missing issueId", async () => {
    const db = createDbMock();
    const app = createApp(db, createStorageMock());

    const res = await request(app)
      .post("/api/attachments/init")
      .send({ filename: "a.png", mimeType: "image/png", sizeBytes: 100, companyId: "company-1" });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("issueId");
  });

  it("validates required fields — missing filename", async () => {
    const db = createDbMock();
    const app = createApp(db, createStorageMock());

    const res = await request(app)
      .post("/api/attachments/init")
      .send({ issueId: "issue-1", mimeType: "image/png", sizeBytes: 100, companyId: "company-1" });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("filename");
  });

  it("validates required fields — missing mimeType", async () => {
    const db = createDbMock();
    const app = createApp(db, createStorageMock());

    const res = await request(app)
      .post("/api/attachments/init")
      .send({ issueId: "issue-1", filename: "a.png", sizeBytes: 100, companyId: "company-1" });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("mimeType");
  });

  it("rejects unsupported mimeType with 415", async () => {
    const db = createDbMock();
    const app = createApp(db, createStorageMock());

    const res = await request(app)
      .post("/api/attachments/init")
      .send({
        issueId: "issue-1",
        filename: "evil.exe",
        mimeType: "application/x-msdownload",
        sizeBytes: 100,
        companyId: "company-1",
      });

    expect(res.status).toBe(415);
    expect(res.body.error).toContain("Unsupported content type");
  });

  it("rejects dangerous filenames", async () => {
    const db = createDbMock();
    const app = createApp(db, createStorageMock());

    const res = await request(app)
      .post("/api/attachments/init")
      .send({
        issueId: "issue-1",
        filename: "../../../etc/passwd",
        mimeType: "image/png",
        sizeBytes: 100,
        companyId: "company-1",
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("Invalid filename");
  });

  it("creates attachment row on valid input", async () => {
    const db = createDbMock();
    const row = makeRow();
    // First select: issue ownership check
    selectWhereMock.mockResolvedValueOnce([{ id: "issue-1", companyId: "company-1" }]);
    insertReturningMock.mockResolvedValueOnce([row]);
    logActivityMock.mockResolvedValueOnce(undefined);

    const app = createApp(db, createStorageMock());

    const res = await request(app)
      .post("/api/attachments/init")
      .send({
        issueId: "issue-1",
        filename: "test.png",
        mimeType: "image/png",
        sizeBytes: 1024,
        companyId: "company-1",
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("uploadId");
    expect(res.body).toHaveProperty("attachmentId");
  });

  it("returns 404 when issue does not belong to company", async () => {
    const db = createDbMock();
    selectWhereMock.mockResolvedValueOnce([{ id: "issue-1", companyId: "other-company" }]);

    const app = createApp(db, createStorageMock());

    const res = await request(app)
      .post("/api/attachments/init")
      .send({
        issueId: "issue-1",
        filename: "test.png",
        mimeType: "image/png",
        sizeBytes: 1024,
        companyId: "company-1",
      });

    expect(res.status).toBe(404);
    expect(res.body.error).toContain("Issue not found");
  });
});

describe("PUT /api/attachments/:attachmentId/chunk", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects missing Content-Range header", async () => {
    const db = createDbMock();

    const app = createApp(db, createStorageMock());

    const res = await request(app)
      .put("/api/attachments/att-1/chunk")
      .send(Buffer.alloc(10));

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("Content-Range");
  });

  it("rejects invalid Content-Range format", async () => {
    const db = createDbMock();

    const app = createApp(db, createStorageMock());

    const res = await request(app)
      .put("/api/attachments/att-1/chunk")
      .set("Content-Range", "bytes invalid")
      .send(Buffer.alloc(10));

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("Content-Range");
  });

  it("returns 404 for non-existent attachment", async () => {
    const db = createDbMock();
    selectWhereMock.mockResolvedValueOnce([]);

    const app = createApp(db, createStorageMock());

    const res = await request(app)
      .put("/api/attachments/nonexistent/chunk")
      .set("Content-Range", "bytes 0-9/100")
      .send(Buffer.alloc(10));

    expect(res.status).toBe(404);
  });

  it("rejects chunk for already-completed upload", async () => {
    const db = createDbMock();
    selectWhereMock.mockResolvedValueOnce([makeRow({ status: "ready" })]);

    const app = createApp(db, createStorageMock());

    const res = await request(app)
      .put("/api/attachments/att-1/chunk")
      .set("Content-Range", "bytes 0-9/100")
      .send(Buffer.alloc(10));

    expect(res.status).toBe(409);
  });
});

describe("POST /api/attachments/:attachmentId/complete", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("assembles chunks and updates status to ready", async () => {
    const db = createDbMock();
    const storageMock = createStorageMock();
    const row = makeRow({ mimeType: "application/pdf", sizeBytes: 10, storageKey: "" });

    // Fix 5: first update (atomic transition) uses default chain -> returning
    updateReturningMock.mockResolvedValueOnce([row]);
    logActivityMock.mockResolvedValueOnce(undefined);
    (storageMock.getRawObject as any).mockResolvedValueOnce(Buffer.alloc(10));

    const app = createApp(db, storageMock);

    const res = await request(app)
      .post("/api/attachments/att-1/complete")
      .send();

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ready");
    expect(res.body.attachmentId).toBe("att-1");
    expect(res.body.url).toContain("/api/attachments/att-1/content");
  });

  it("returns 409 for already completed upload", async () => {
    const db = createDbMock();
    // Atomic update returns nothing (already completed)
    updateReturningMock.mockResolvedValueOnce([]);
    // Fallback select finds the row with non-uploading status
    selectWhereMock.mockResolvedValueOnce([makeRow({ status: "ready" })]);

    const app = createApp(db, createStorageMock());

    const res = await request(app)
      .post("/api/attachments/att-1/complete")
      .send();

    expect(res.status).toBe(409);
  });

  it("returns 404 for non-existent attachment", async () => {
    const db = createDbMock();
    // Atomic update returns nothing
    updateReturningMock.mockResolvedValueOnce([]);
    // Fallback select also finds nothing
    selectWhereMock.mockResolvedValueOnce([]);

    const app = createApp(db, createStorageMock());

    const res = await request(app)
      .post("/api/attachments/att-1/complete")
      .send();

    expect(res.status).toBe(404);
  });
});

describe("GET /api/attachments/:attachmentId", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 404 for wrong company (tenant isolation)", async () => {
    const db = createDbMock();
    selectWhereMock.mockResolvedValueOnce([makeRow({ companyId: "other-company" })]);

    const app = createApp(db, createStorageMock(), {
      type: "board",
      source: "session",
      userId: "user-1",
      companyIds: ["company-1"],
    });

    const res = await request(app).get("/api/attachments/att-1");

    expect(res.status).toBe(403);
  });

  it("returns attachment DTO for matching company", async () => {
    const db = createDbMock();
    const row = makeRow({ status: "ready" });
    selectWhereMock.mockResolvedValueOnce([row]);

    const app = createApp(db, createStorageMock());

    const res = await request(app).get("/api/attachments/att-1");

    expect(res.status).toBe(200);
    expect(res.body.id).toBe("att-1");
    expect(res.body.downloadUrl).toContain("/api/attachments/att-1/content");
    // Fix 8: should NOT leak storageKey or htmlPreviewKey
    expect(res.body).not.toHaveProperty("storageKey");
    expect(res.body).not.toHaveProperty("htmlPreviewKey");
  });

  it("returns 404 for non-existent attachment", async () => {
    const db = createDbMock();
    selectWhereMock.mockResolvedValueOnce([]);

    const app = createApp(db, createStorageMock());

    const res = await request(app).get("/api/attachments/nonexistent");

    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/attachments/:attachmentId", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects deletion by non-owner non-admin", async () => {
    const db = createDbMock();
    const row = makeRow({ uploaderId: "other-user" });
    selectWhereMock.mockResolvedValueOnce([row]);

    const app = createApp(db, createStorageMock(), {
      type: "board",
      source: "session",
      userId: "user-1",
      companyIds: ["company-1"],
      isInstanceAdmin: false,
    });

    const res = await request(app).delete("/api/attachments/att-1");

    expect(res.status).toBe(403);
    expect(res.body.error).toContain("uploader or an admin");
  });

  it("allows deletion by the uploader", async () => {
    const db = createDbMock();
    const storageMock = createStorageMock();
    const row = makeRow({ uploaderId: "user-1", storageKey: "company-1/files/att-1/test.png" });
    selectWhereMock.mockResolvedValueOnce([row]);
    deleteWhereMock.mockResolvedValueOnce(undefined);
    logActivityMock.mockResolvedValueOnce(undefined);

    const app = createApp(db, storageMock);

    const res = await request(app).delete("/api/attachments/att-1");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(storageMock.deleteObject).toHaveBeenCalledWith("company-1", "company-1/files/att-1/test.png");
  });

  it("allows deletion by instance admin", async () => {
    const db = createDbMock();
    const storageMock = createStorageMock();
    const row = makeRow({ uploaderId: "other-user" });
    selectWhereMock.mockResolvedValueOnce([row]);
    deleteWhereMock.mockResolvedValueOnce(undefined);
    logActivityMock.mockResolvedValueOnce(undefined);

    const app = createApp(db, storageMock, {
      type: "board",
      source: "session",
      userId: "admin-1",
      companyIds: ["company-1"],
      isInstanceAdmin: true,
    });

    const res = await request(app).delete("/api/attachments/att-1");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});

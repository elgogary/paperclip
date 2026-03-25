import { describe, it, expect, vi, beforeEach } from "vitest";
import { Readable } from "node:stream";
import {
  buildAttachmentContext,
  renderAttachmentContextMarkdown,
  type AttachmentContextResult,
} from "../services/attachment-context.js";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@paperclipai/db", () => ({
  attachments: Symbol("attachments"),
  issueComments: Symbol("issueComments"),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => ({ _tag: "eq", args })),
  inArray: vi.fn((...args: unknown[]) => ({ _tag: "inArray", args })),
  and: vi.fn((...args: unknown[]) => ({ _tag: "and", args })),
  asc: vi.fn((...args: unknown[]) => ({ _tag: "asc", args })),
}));

// Suppress console.warn
vi.spyOn(console, "warn").mockImplementation(() => {});

function bufferStream(data: Buffer | string): Readable {
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
  return Readable.from([buf]);
}

interface MockRow {
  id: string;
  commentId: string | null;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  thumbnailKey: string | null;
  htmlPreviewKey: string | null;
  status: string;
  createdAt: Date;
}

function makeRow(overrides: Partial<MockRow> = {}): MockRow {
  return {
    id: overrides.id ?? "att-1",
    commentId: overrides.commentId ?? "comment-1",
    filename: overrides.filename ?? "photo.png",
    mimeType: overrides.mimeType ?? "image/png",
    sizeBytes: overrides.sizeBytes ?? 1024,
    storageKey: overrides.storageKey ?? "comp/issues/iss/photo.png",
    thumbnailKey: overrides.thumbnailKey ?? null,
    htmlPreviewKey: overrides.htmlPreviewKey ?? null,
    status: overrides.status ?? "ready",
    createdAt: overrides.createdAt ?? new Date("2026-01-01"),
  };
}

function makeMockDb(rows: MockRow[] = []) {
  const orderBy = vi.fn().mockResolvedValue(rows);
  const where = vi.fn().mockReturnValue({ orderBy });
  const from = vi.fn().mockReturnValue({ where });
  const select = vi.fn().mockReturnValue({ from });
  return { select, _from: from, _where: where, _orderBy: orderBy };
}

function makeMockStorage(downloads: Record<string, Buffer> = {}) {
  return {
    provider: "local" as const,
    putFile: vi.fn(),
    getObject: vi.fn().mockImplementation((_companyId: string, key: string) => {
      const buf = downloads[key];
      if (!buf) return Promise.reject(new Error(`Not found: ${key}`));
      return Promise.resolve({ stream: bufferStream(buf) });
    }),
    headObject: vi.fn(),
    deleteObject: vi.fn(),
    putRawObject: vi.fn(),
    getRawObject: vi.fn(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("buildAttachmentContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty result when no comment IDs provided", async () => {
    const db = makeMockDb();
    const storage = makeMockStorage();
    const result = await buildAttachmentContext([], {
      db: db as any,
      storage: storage as any,
      companyId: "comp-1",
    });
    expect(result.attachmentCount).toBe(0);
    expect(result.visionBlocks).toEqual([]);
    expect(result.textSnippets).toEqual([]);
    expect(result.fileNotes).toEqual([]);
    expect(db.select).not.toHaveBeenCalled();
  });

  it("returns empty result when no attachments found", async () => {
    const db = makeMockDb([]);
    const storage = makeMockStorage();
    const result = await buildAttachmentContext(["c1"], {
      db: db as any,
      storage: storage as any,
      companyId: "comp-1",
    });
    expect(result.attachmentCount).toBe(0);
    expect(result.visionBlocks).toEqual([]);
  });

  it("includes image as vision block for image/png attachment", async () => {
    const imgData = Buffer.from("fake-png-data");
    const row = makeRow({
      mimeType: "image/png",
      storageKey: "comp/img.png",
      sizeBytes: imgData.length,
    });
    const db = makeMockDb([row]);
    const storage = makeMockStorage({ "comp/img.png": imgData });
    const result = await buildAttachmentContext(["c1"], {
      db: db as any,
      storage: storage as any,
      companyId: "comp-1",
    });
    expect(result.attachmentCount).toBe(1);
    expect(result.visionBlocks).toHaveLength(1);
    expect(result.visionBlocks[0]).toEqual({
      type: "image",
      source: {
        type: "base64",
        media_type: "image/png",
        data: imgData.toString("base64"),
      },
    });
    expect(result.totalImageBytes).toBe(imgData.length);
  });

  it("caps at 5 images (6th is skipped with note)", async () => {
    const imgData = Buffer.from("x");
    const rows = Array.from({ length: 6 }, (_, i) =>
      makeRow({
        id: `att-${i}`,
        filename: `img${i}.png`,
        mimeType: "image/png",
        storageKey: `comp/img${i}.png`,
        sizeBytes: imgData.length,
      }),
    );
    const downloads: Record<string, Buffer> = {};
    for (let i = 0; i < 6; i++) downloads[`comp/img${i}.png`] = imgData;

    const db = makeMockDb(rows);
    const storage = makeMockStorage(downloads);
    const result = await buildAttachmentContext(["c1"], {
      db: db as any,
      storage: storage as any,
      companyId: "comp-1",
    });
    expect(result.visionBlocks).toHaveLength(5);
    expect(result.fileNotes).toContain("[Image skipped (limit reached): img5.png (1 B)]");
  });

  it("adds text note for video with no thumbnail", async () => {
    const row = makeRow({
      filename: "demo.mp4",
      mimeType: "video/mp4",
      sizeBytes: 5_000_000,
      storageKey: "comp/demo.mp4",
      thumbnailKey: null,
    });
    const db = makeMockDb([row]);
    const storage = makeMockStorage();
    const result = await buildAttachmentContext(["c1"], {
      db: db as any,
      storage: storage as any,
      companyId: "comp-1",
    });
    expect(result.visionBlocks).toHaveLength(0);
    expect(result.fileNotes).toContain("[Video attached: demo.mp4 (4.8 MB)]");
  });

  it("includes code content for text/plain attachment", async () => {
    const codeContent = Buffer.from("console.log('hello');");
    const row = makeRow({
      filename: "script.js",
      mimeType: "text/javascript",
      storageKey: "comp/script.js",
      sizeBytes: codeContent.length,
    });
    const db = makeMockDb([row]);
    const storage = makeMockStorage({ "comp/script.js": codeContent });
    const result = await buildAttachmentContext(["c1"], {
      db: db as any,
      storage: storage as any,
      companyId: "comp-1",
    });
    expect(result.textSnippets).toHaveLength(1);
    expect(result.textSnippets[0]).toContain("console.log('hello');");
    expect(result.textSnippets[0]).toContain("```");
  });

  it("skips gracefully when storage download fails (no throw)", async () => {
    const row = makeRow({
      filename: "broken.png",
      mimeType: "image/png",
      storageKey: "comp/broken.png",
      sizeBytes: 100,
    });
    const db = makeMockDb([row]);
    const storage = makeMockStorage({}); // no download available
    const result = await buildAttachmentContext(["c1"], {
      db: db as any,
      storage: storage as any,
      companyId: "comp-1",
    });
    // Should NOT throw
    expect(result.visionBlocks).toHaveLength(0);
    expect(result.fileNotes).toContain("[Image unavailable: broken.png]");
  });

  it("respects 10MB total image limit", async () => {
    // Create two 6MB images — second should be skipped
    const big = Buffer.alloc(6 * 1024 * 1024, 0x42);
    const rows = [
      makeRow({
        id: "att-1",
        filename: "big1.png",
        mimeType: "image/png",
        storageKey: "comp/big1.png",
        sizeBytes: big.length,
      }),
      makeRow({
        id: "att-2",
        filename: "big2.png",
        mimeType: "image/png",
        storageKey: "comp/big2.png",
        sizeBytes: big.length,
      }),
    ];
    const db = makeMockDb(rows);
    const storage = makeMockStorage({
      "comp/big1.png": big,
      "comp/big2.png": big,
    });
    const result = await buildAttachmentContext(["c1"], {
      db: db as any,
      storage: storage as any,
      companyId: "comp-1",
    });
    expect(result.visionBlocks).toHaveLength(1);
    expect(result.fileNotes.some((n) => n.includes("size budget exceeded"))).toBe(true);
  });

  it("includes document text extract from htmlPreviewKey", async () => {
    const html = Buffer.from("<html><body><p>Contract terms here</p></body></html>");
    const row = makeRow({
      filename: "contract.pdf",
      mimeType: "application/pdf",
      storageKey: "comp/contract.pdf",
      sizeBytes: 50000,
      htmlPreviewKey: "comp/contract-preview.html",
    });
    const db = makeMockDb([row]);
    const storage = makeMockStorage({ "comp/contract-preview.html": html });
    const result = await buildAttachmentContext(["c1"], {
      db: db as any,
      storage: storage as any,
      companyId: "comp-1",
    });
    expect(result.textSnippets).toHaveLength(1);
    expect(result.textSnippets[0]).toContain("Contract terms here");
    expect(result.textSnippets[0]).toContain("--- Document: contract.pdf ---");
  });

  it("adds file note for unknown mime types", async () => {
    const row = makeRow({
      filename: "data.zip",
      mimeType: "application/zip",
      storageKey: "comp/data.zip",
      sizeBytes: 2048,
    });
    const db = makeMockDb([row]);
    const storage = makeMockStorage();
    const result = await buildAttachmentContext(["c1"], {
      db: db as any,
      storage: storage as any,
      companyId: "comp-1",
    });
    expect(result.fileNotes).toContain("[File attached: data.zip (application/zip, 2.0 KB)]");
  });

  it("handles video with thumbnail (uses it as vision block)", async () => {
    const thumbData = Buffer.from("thumb-png");
    const row = makeRow({
      filename: "demo.mp4",
      mimeType: "video/mp4",
      storageKey: "comp/demo.mp4",
      sizeBytes: 5_000_000,
      thumbnailKey: "comp/demo-thumb.png",
    });
    const db = makeMockDb([row]);
    const storage = makeMockStorage({ "comp/demo-thumb.png": thumbData });
    const result = await buildAttachmentContext(["c1"], {
      db: db as any,
      storage: storage as any,
      companyId: "comp-1",
    });
    expect(result.visionBlocks).toHaveLength(1);
    expect(result.visionBlocks[0].source.media_type).toBe("image/png");
    expect(result.fileNotes).toContain("[Video thumbnail shown: demo.mp4 (4.8 MB)]");
  });
});

describe("renderAttachmentContextMarkdown", () => {
  it("returns empty string for zero attachments", () => {
    const ctx: AttachmentContextResult = {
      visionBlocks: [],
      textSnippets: [],
      fileNotes: [],
      totalImageBytes: 0,
      attachmentCount: 0,
    };
    expect(renderAttachmentContextMarkdown(ctx)).toBe("");
  });

  it("renders text snippets and file notes", () => {
    const ctx: AttachmentContextResult = {
      visionBlocks: [{ type: "image", source: { type: "base64", media_type: "image/png", data: "abc" } }],
      textSnippets: ["--- File: test.js ---\n```\nconsole.log('hi');\n```"],
      fileNotes: ["[Video attached: demo.mp4 (5.0 MB)]"],
      totalImageBytes: 100,
      attachmentCount: 3,
    };
    const md = renderAttachmentContextMarkdown(ctx);
    expect(md).toContain("## Attachments");
    expect(md).toContain("1 image(s) attached");
    expect(md).toContain("console.log('hi');");
    expect(md).toContain("[Video attached: demo.mp4 (5.0 MB)]");
  });
});

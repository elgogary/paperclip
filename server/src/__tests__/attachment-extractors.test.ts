import { describe, it, expect, vi, beforeEach } from "vitest";
import { Readable } from "node:stream";
import {
  buildAttachmentContext,
} from "../services/attachment-context.js";

// ---------------------------------------------------------------------------
// Mocks — pdf-parse, mammoth, xlsx, drizzle, db
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

const mockGetText = vi.fn();
const mockDestroy = vi.fn();
vi.mock("pdf-parse", () => ({
  PDFParse: vi.fn().mockImplementation(() => ({
    getText: mockGetText,
    destroy: mockDestroy,
  })),
}));

const mockExtractRawText = vi.fn();
vi.mock("mammoth", () => ({
  extractRawText: mockExtractRawText,
}));

const mockSheetToJson = vi.fn();
const mockRead = vi.fn();
vi.mock("xlsx", () => ({
  read: mockRead,
  utils: { sheet_to_json: mockSheetToJson },
}));

vi.spyOn(console, "warn").mockImplementation(() => {});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function bufferStream(data: Buffer | string): Readable {
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
  return Readable.from([buf]);
}

function fakePng(size = 64): Buffer {
  const buf = Buffer.alloc(size, 0x00);
  buf[0] = 0x89;
  buf[1] = 0x50;
  buf[2] = 0x4e;
  buf[3] = 0x47;
  return buf;
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

describe("attachment extraction — PDF direct fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("extracts PDF text when htmlPreviewKey is absent", async () => {
    mockGetText.mockResolvedValue({ text: "Hello from PDF", pages: [], total: 1 });
    mockDestroy.mockResolvedValue(undefined);

    const pdfBuf = Buffer.from("fake-pdf-bytes");
    const row = makeRow({
      filename: "report.pdf",
      mimeType: "application/pdf",
      sizeBytes: pdfBuf.length,
      storageKey: "comp/report.pdf",
      htmlPreviewKey: null,
    });
    const db = makeMockDb([row]);
    const storage = makeMockStorage({ "comp/report.pdf": pdfBuf });

    const result = await buildAttachmentContext(["c1"], {
      db: db as any,
      storage: storage as any,
      companyId: "comp-1",
    });

    expect(result.textSnippets).toHaveLength(1);
    expect(result.textSnippets[0]).toContain("Hello from PDF");
    expect(result.textSnippets[0]).toContain("Document: report.pdf");
  });

  it("prefers htmlPreviewKey over direct extraction for PDF", async () => {
    const htmlBuf = Buffer.from("<p>Preview text from HTML</p>");
    const row = makeRow({
      filename: "report.pdf",
      mimeType: "application/pdf",
      sizeBytes: 500,
      storageKey: "comp/report.pdf",
      htmlPreviewKey: "comp/report-preview.html",
    });
    const db = makeMockDb([row]);
    const storage = makeMockStorage({ "comp/report-preview.html": htmlBuf });

    const result = await buildAttachmentContext(["c1"], {
      db: db as any,
      storage: storage as any,
      companyId: "comp-1",
    });

    expect(result.textSnippets).toHaveLength(1);
    expect(result.textSnippets[0]).toContain("Preview text from HTML");
    // pdf-parse should NOT have been called
    expect(mockGetText).not.toHaveBeenCalled();
  });

  it("skips PDF extraction for files over 2MB", async () => {
    const row = makeRow({
      filename: "huge.pdf",
      mimeType: "application/pdf",
      sizeBytes: 3 * 1024 * 1024,
      storageKey: "comp/huge.pdf",
      htmlPreviewKey: null,
    });
    const db = makeMockDb([row]);
    const storage = makeMockStorage({});

    const result = await buildAttachmentContext(["c1"], {
      db: db as any,
      storage: storage as any,
      companyId: "comp-1",
    });

    expect(result.textSnippets).toHaveLength(0);
    expect(result.fileNotes.some(n => n.includes("too large for extraction"))).toBe(true);
    expect(mockGetText).not.toHaveBeenCalled();
  });

  it("falls back to fileNote when PDF extraction returns empty text", async () => {
    mockGetText.mockResolvedValue({ text: "   ", pages: [], total: 1 });
    mockDestroy.mockResolvedValue(undefined);

    const pdfBuf = Buffer.from("fake-pdf-bytes");
    const row = makeRow({
      filename: "empty.pdf",
      mimeType: "application/pdf",
      sizeBytes: pdfBuf.length,
      storageKey: "comp/empty.pdf",
      htmlPreviewKey: null,
    });
    const db = makeMockDb([row]);
    const storage = makeMockStorage({ "comp/empty.pdf": pdfBuf });

    const result = await buildAttachmentContext(["c1"], {
      db: db as any,
      storage: storage as any,
      companyId: "comp-1",
    });

    expect(result.textSnippets).toHaveLength(0);
    expect(result.fileNotes.some(n => n.includes("text preview unavailable"))).toBe(true);
  });
});

describe("attachment extraction — DOCX direct fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("extracts DOCX text when htmlPreviewKey is absent", async () => {
    mockExtractRawText.mockResolvedValue({ value: "Hello from DOCX" });

    const docxBuf = Buffer.from("fake-docx-bytes");
    const row = makeRow({
      filename: "memo.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      sizeBytes: docxBuf.length,
      storageKey: "comp/memo.docx",
      htmlPreviewKey: null,
    });
    const db = makeMockDb([row]);
    const storage = makeMockStorage({ "comp/memo.docx": docxBuf });

    const result = await buildAttachmentContext(["c1"], {
      db: db as any,
      storage: storage as any,
      companyId: "comp-1",
    });

    expect(result.textSnippets).toHaveLength(1);
    expect(result.textSnippets[0]).toContain("Hello from DOCX");
    expect(result.textSnippets[0]).toContain("Document: memo.docx");
  });
});

describe("attachment extraction — Spreadsheet (XLSX/CSV)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("extracts XLSX rows as JSON", async () => {
    const xlsxBuf = Buffer.from("fake-xlsx-bytes");
    const fakeSheet = Symbol("sheet");
    mockRead.mockReturnValue({
      SheetNames: ["Sheet1"],
      Sheets: { Sheet1: fakeSheet },
    });
    mockSheetToJson.mockReturnValue([
      { Name: "Alice", Age: 30 },
      { Name: "Bob", Age: 25 },
    ]);

    const row = makeRow({
      filename: "data.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      sizeBytes: xlsxBuf.length,
      storageKey: "comp/data.xlsx",
    });
    const db = makeMockDb([row]);
    const storage = makeMockStorage({ "comp/data.xlsx": xlsxBuf });

    const result = await buildAttachmentContext(["c1"], {
      db: db as any,
      storage: storage as any,
      companyId: "comp-1",
    });

    expect(result.textSnippets).toHaveLength(1);
    expect(result.textSnippets[0]).toContain("Spreadsheet: data.xlsx");
    expect(result.textSnippets[0]).toContain("Alice");
    expect(result.textSnippets[0]).toContain("Bob");
  });

  it("extracts CSV rows as JSON", async () => {
    const csvBuf = Buffer.from("Name,Age\nAlice,30\n");
    const fakeSheet = Symbol("sheet");
    mockRead.mockReturnValue({
      SheetNames: ["Sheet1"],
      Sheets: { Sheet1: fakeSheet },
    });
    mockSheetToJson.mockReturnValue([{ Name: "Alice", Age: "30" }]);

    const row = makeRow({
      filename: "data.csv",
      mimeType: "text/csv",
      sizeBytes: csvBuf.length,
      storageKey: "comp/data.csv",
    });
    const db = makeMockDb([row]);
    const storage = makeMockStorage({ "comp/data.csv": csvBuf });

    const result = await buildAttachmentContext(["c1"], {
      db: db as any,
      storage: storage as any,
      companyId: "comp-1",
    });

    expect(result.textSnippets).toHaveLength(1);
    expect(result.textSnippets[0]).toContain("Spreadsheet: data.csv");
    expect(result.textSnippets[0]).toContain("Alice");
  });

  it("skips oversized spreadsheets", async () => {
    const row = makeRow({
      filename: "huge.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      sizeBytes: 3 * 1024 * 1024,
      storageKey: "comp/huge.xlsx",
    });
    const db = makeMockDb([row]);
    const storage = makeMockStorage({});

    const result = await buildAttachmentContext(["c1"], {
      db: db as any,
      storage: storage as any,
      companyId: "comp-1",
    });

    expect(result.textSnippets).toHaveLength(0);
    expect(result.fileNotes.some(n => n.includes("too large for extraction"))).toBe(true);
    expect(mockRead).not.toHaveBeenCalled();
  });

  it("returns empty array for workbook with no sheets", async () => {
    const xlsxBuf = Buffer.from("fake-xlsx");
    mockRead.mockReturnValue({ SheetNames: [], Sheets: {} });

    const row = makeRow({
      filename: "empty.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      sizeBytes: xlsxBuf.length,
      storageKey: "comp/empty.xlsx",
    });
    const db = makeMockDb([row]);
    const storage = makeMockStorage({ "comp/empty.xlsx": xlsxBuf });

    const result = await buildAttachmentContext(["c1"], {
      db: db as any,
      storage: storage as any,
      companyId: "comp-1",
    });

    // Empty spreadsheet produces a text snippet with empty JSON array
    expect(result.textSnippets).toHaveLength(1);
    expect(result.textSnippets[0]).toContain("Spreadsheet: empty.xlsx");
    expect(result.textSnippets[0]).toContain("[]");
  });
});

describe("attachment extraction — unknown type fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns metadata-only file note for unsupported types", async () => {
    const row = makeRow({
      filename: "archive.zip",
      mimeType: "application/zip",
      sizeBytes: 50000,
      storageKey: "comp/archive.zip",
    });
    const db = makeMockDb([row]);
    const storage = makeMockStorage({});

    const result = await buildAttachmentContext(["c1"], {
      db: db as any,
      storage: storage as any,
      companyId: "comp-1",
    });

    expect(result.textSnippets).toHaveLength(0);
    expect(result.visionBlocks).toHaveLength(0);
    expect(result.fileNotes).toHaveLength(1);
    expect(result.fileNotes[0]).toContain("archive.zip");
    expect(result.fileNotes[0]).toContain("application/zip");
  });
});

describe("attachment extraction — image handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("image attachment returns vision block with base64 data", async () => {
    const img = fakePng(128);
    const row = makeRow({
      filename: "screenshot.png",
      mimeType: "image/png",
      sizeBytes: img.length,
      storageKey: "comp/screenshot.png",
    });
    const db = makeMockDb([row]);
    const storage = makeMockStorage({ "comp/screenshot.png": img });

    const result = await buildAttachmentContext(["c1"], {
      db: db as any,
      storage: storage as any,
      companyId: "comp-1",
    });

    expect(result.visionBlocks).toHaveLength(1);
    expect(result.visionBlocks[0].type).toBe("image");
    expect(result.visionBlocks[0].source.media_type).toBe("image/png");
    expect(result.visionBlocks[0].source.data).toBe(img.toString("base64"));
  });

  it("no attachments returns empty array", async () => {
    const db = makeMockDb([]);
    const storage = makeMockStorage({});

    const result = await buildAttachmentContext(["c1"], {
      db: db as any,
      storage: storage as any,
      companyId: "comp-1",
    });

    expect(result.attachmentCount).toBe(0);
    expect(result.visionBlocks).toEqual([]);
    expect(result.textSnippets).toEqual([]);
    expect(result.fileNotes).toEqual([]);
  });
});

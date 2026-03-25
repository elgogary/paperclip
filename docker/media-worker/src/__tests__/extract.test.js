import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock heavy dependencies before importing
vi.mock("pdf-parse", () => ({
  default: vi.fn(async (buf) => ({ text: "PDF extracted text from buffer" })),
}));

vi.mock("mammoth", () => ({
  extractRawText: vi.fn(async ({ buffer }) => ({ value: "DOCX extracted text" })),
}));

vi.mock("xlsx", () => {
  const mockSheet = {};
  const mockWorkbook = {
    SheetNames: ["Sheet1"],
    Sheets: { Sheet1: mockSheet },
  };
  return {
    read: vi.fn(() => mockWorkbook),
    utils: {
      sheet_to_json: vi.fn(() => [
        ["Name", "Age"],
        ["Alice", 30],
        ["Bob", 25],
      ]),
    },
  };
});

import { extractText, SUPPORTED_EXTRACT_TYPES } from "../extract.js";

describe("extractText", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("extracts text from PDF", async () => {
    const buf = Buffer.from("fake-pdf");
    const result = await extractText(buf, "application/pdf");
    expect(result).toBe("PDF extracted text from buffer");
  });

  it("extracts text from DOCX", async () => {
    const buf = Buffer.from("fake-docx");
    const result = await extractText(
      buf,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    expect(result).toBe("DOCX extracted text");
  });

  it("extracts rows from XLSX as JSON", async () => {
    const buf = Buffer.from("fake-xlsx");
    const result = await extractText(
      buf,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    const parsed = JSON.parse(result);
    expect(parsed).toEqual([
      ["Name", "Age"],
      ["Alice", 30],
      ["Bob", 25],
    ]);
  });

  it("extracts text from CSV (first 50 rows)", async () => {
    const lines = Array.from({ length: 60 }, (_, i) => `row${i},col${i}`);
    const buf = Buffer.from(lines.join("\n"));
    const result = await extractText(buf, "text/csv");
    const outputLines = result.split("\n");
    expect(outputLines.length).toBe(50);
    expect(outputLines[0]).toBe("row0,col0");
  });

  it("returns null for unsupported mime type", async () => {
    const buf = Buffer.from("whatever");
    const result = await extractText(buf, "application/octet-stream");
    expect(result).toBeNull();
  });

  it("returns null for image mime type", async () => {
    const buf = Buffer.from("img");
    const result = await extractText(buf, "image/png");
    expect(result).toBeNull();
  });
});

describe("SUPPORTED_EXTRACT_TYPES", () => {
  it("includes pdf, docx, xlsx, csv", () => {
    expect(SUPPORTED_EXTRACT_TYPES.has("application/pdf")).toBe(true);
    expect(SUPPORTED_EXTRACT_TYPES.has("application/vnd.openxmlformats-officedocument.wordprocessingml.document")).toBe(true);
    expect(SUPPORTED_EXTRACT_TYPES.has("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")).toBe(true);
    expect(SUPPORTED_EXTRACT_TYPES.has("text/csv")).toBe(true);
  });

  it("does not include unsupported types", () => {
    expect(SUPPORTED_EXTRACT_TYPES.has("image/png")).toBe(false);
    expect(SUPPORTED_EXTRACT_TYPES.has("text/plain")).toBe(false);
  });
});

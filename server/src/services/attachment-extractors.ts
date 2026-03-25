/**
 * Direct content extraction for document attachments.
 *
 * Used as fallback when pre-generated HTML previews are unavailable.
 * Each extractor handles one format and returns plain text.
 */

/**
 * Extract text from a PDF buffer using pdf-parse (v2).
 * Returns null if extraction fails or yields no text.
 */
export async function extractPdfText(buf: Buffer): Promise<string | null> {
  try {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: new Uint8Array(buf) });
    const result = await parser.getText();
    await parser.destroy();
    return result.text?.trim() || null;
  } catch (err) {
    console.warn("[attachment-extractors] PDF extraction failed:", (err as Error).message);
    return null;
  }
}

/**
 * Extract text from a DOCX buffer using mammoth.
 * Returns null if extraction fails or yields no text.
 */
export async function extractDocxText(buf: Buffer): Promise<string | null> {
  try {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer: buf });
    return result.value?.trim() || null;
  } catch (err) {
    console.warn("[attachment-extractors] DOCX extraction failed:", (err as Error).message);
    return null;
  }
}

/**
 * Extract the first N rows from a spreadsheet (XLSX, XLS, CSV) buffer.
 * Returns an array of row objects keyed by column headers (or A/B/C if no header).
 */
export async function extractSpreadsheetRows(
  buf: Buffer,
  _mimeType: string,
  maxRows: number,
): Promise<Record<string, unknown>[]> {
  const XLSX = await import("xlsx");

  const workbook = XLSX.read(buf, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];

  const sheet = workbook.Sheets[sheetName];
  const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  return rows.slice(0, maxRows);
}

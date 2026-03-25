/**
 * Text extraction from documents.
 * Supports PDF, DOCX, XLSX, and CSV.
 */

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PDF_MIME = "application/pdf";
const CSV_MIME = "text/csv";

const MAX_XLSX_ROWS = 50;
const MAX_CSV_ROWS = 50;

/**
 * Extract text from a buffer based on MIME type.
 * @param {Buffer} buffer - file contents
 * @param {string} mimeType
 * @returns {Promise<string|null>} extracted text or null if unsupported
 */
export async function extractText(buffer, mimeType) {
  if (mimeType === PDF_MIME) {
    return extractPdf(buffer);
  }
  if (mimeType === DOCX_MIME) {
    return extractDocx(buffer);
  }
  if (mimeType === XLSX_MIME) {
    return extractXlsx(buffer);
  }
  if (mimeType === CSV_MIME) {
    return extractCsv(buffer);
  }
  return null;
}

async function extractPdf(buffer) {
  const pdfParse = (await import("pdf-parse")).default;
  const data = await pdfParse(buffer);
  return data.text || "";
}

async function extractDocx(buffer) {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return result.value || "";
}

async function extractXlsx(buffer) {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return "";
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  const limited = rows.slice(0, MAX_XLSX_ROWS);
  return JSON.stringify(limited);
}

function extractCsv(buffer) {
  const text = buffer.toString("utf-8");
  const lines = text.split(/\r?\n/).filter(Boolean);
  const limited = lines.slice(0, MAX_CSV_ROWS);
  return limited.join("\n");
}

export const SUPPORTED_EXTRACT_TYPES = new Set([PDF_MIME, DOCX_MIME, XLSX_MIME, CSV_MIME]);

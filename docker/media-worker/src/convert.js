import * as fs from "node:fs/promises";
import { readFile, mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";

const OFFICE_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/msword",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
  "application/vnd.oasis.opendocument.text",
  "application/vnd.oasis.opendocument.spreadsheet",
  "application/vnd.oasis.opendocument.presentation",
]);

export const MIME_TO_EXT = {
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "application/msword": "doc",
  "application/vnd.ms-excel": "xls",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.oasis.opendocument.text": "odt",
  "application/vnd.oasis.opendocument.spreadsheet": "ods",
  "application/vnd.oasis.opendocument.presentation": "odp",
};

/**
 * Check if a MIME type is a supported Office format.
 */
export function isOfficeType(mimeType) {
  return OFFICE_MIME_TYPES.has(mimeType);
}

/**
 * Run LibreOffice headless to convert a file on disk to HTML.
 * @param {string} inputPath - path to the input file on disk
 * @param {string} workDir - temp directory for output
 * Returns { htmlBase64: string } or { htmlBase64: null, error: string }.
 */
export async function convertToHtml(inputPath, workDir) {
  try {
    const { exitCode, stderr } = await new Promise((resolve, reject) => {
      const proc = spawn("libreoffice", [
        "--headless",
        "--convert-to", "html",
        "--outdir", workDir,
        inputPath,
      ], { stdio: ["ignore", "pipe", "pipe"] });

      let stderrBuf = "";
      proc.stderr.on("data", (d) => { stderrBuf += d; });
      proc.on("close", (code) => resolve({ exitCode: code, stderr: stderrBuf }));
      proc.on("error", (err) => reject(err));
    });

    if (exitCode !== 0) {
      console.error(`[convert] LibreOffice exited ${exitCode}: ${stderr}`);
      throw new Error(`LibreOffice exited with code ${exitCode}: ${stderr.slice(0, 200)}`);
    }

    const htmlPath = join(workDir, "input.html");
    const html = await readFile(htmlPath);
    return { htmlBase64: html.toString("base64") };
  } catch (err) {
    return { htmlBase64: null, error: err.message || "Conversion failed" };
  } finally {
    try {
      await fs.rm(workDir, { recursive: true, force: true });
    } catch {}
  }
}

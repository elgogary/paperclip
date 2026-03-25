import { writeFile, readFile, unlink, mkdtemp } from "node:fs/promises";
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

const MIME_TO_EXT = {
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
 * Run LibreOffice headless to convert a buffer to HTML.
 * Returns { htmlBase64: string } or { htmlBase64: null, error: string }.
 */
export async function convertToHtml(buffer, mimeType) {
  if (!isOfficeType(mimeType)) {
    return { htmlBase64: null, error: "Unsupported MIME type for conversion" };
  }

  const workDir = await mkdtemp(join(tmpdir(), "media-worker-"));
  const ext = MIME_TO_EXT[mimeType] || "bin";
  const inputPath = join(workDir, `input.${ext}`);

  try {
    await writeFile(inputPath, buffer);

    const exitCode = await new Promise((resolve, reject) => {
      const proc = spawn("libreoffice", [
        "--headless",
        "--convert-to", "html",
        "--outdir", workDir,
        inputPath,
      ], { stdio: ["ignore", "pipe", "pipe"] });

      let stderr = "";
      proc.stderr.on("data", (d) => { stderr += d; });
      proc.on("close", (code) => resolve(code));
      proc.on("error", (err) => reject(err));
    });

    if (exitCode !== 0) {
      return { htmlBase64: null, error: "LibreOffice exited with code " + exitCode };
    }

    const htmlPath = join(workDir, "input.html");
    const html = await readFile(htmlPath);
    return { htmlBase64: html.toString("base64") };
  } catch (err) {
    return { htmlBase64: null, error: err.message || "Conversion failed" };
  } finally {
    // Best-effort cleanup
    try { await unlink(inputPath); } catch {}
    try { await unlink(join(workDir, "input.html")); } catch {}
  }
}

## Summary

The attachment-context and attachment-extractors implementation is well-structured, all four previously reported blockers are confirmed fixed, and no new critical or important issues were found.

## Blocker Verification

### 1. Per-image 5MB cap — CONFIRMED FIXED
`MAX_SINGLE_IMAGE_BYTES = 5 * 1024 * 1024` is defined at line 45 of `attachment-context.ts`.
The guard fires at line 157 — before any storage download — and emits a `[Image too large to send: ...]` file note.
The test at `attachment-context.test.ts:444` ("skips individual image over 5MB without downloading") also asserts `storage.getObject` was never called, confirming the pre-download guard is correct.

### 2. pdf-parse API — CONFIRMED CORRECT
`attachment-extractors.ts` uses the class-based v2 API: `new PDFParse({ data: new Uint8Array(buf) })`, calls `parser.getText()`, then `parser.destroy()`. Matches v2.4.5 interface. The test mock at `attachment-extractors.test.ts:26` correctly stubs the same class + method pattern.

### 3. CSV routing guard — CONFIRMED FIXED
Line 297 of `attachment-context.ts`:
```ts
if (isTextMime(mimeType) && !isSpreadsheetMime(mimeType)) {
```
`isSpreadsheetMime` returns true for `text/csv` (line 75), so CSV is routed to the spreadsheet branch and never reaches the text/code branch. The CSV test in `attachment-extractors.test.ts:292` confirms it produces a `Spreadsheet:` snippet, not a code fence.

### 4. Oversized image test — CONFIRMED PRESENT
Test "skips individual image over 5MB without downloading" is at `attachment-context.test.ts:444`. It sets `sizeBytes: 6 * 1024 * 1024`, passes an empty storage mock, and asserts both the file note text and that `getObject` was not called.

## Issues

- **[severity: low]** correctness: `extractSpreadsheetRows` in `attachment-extractors.ts` ignores the `_mimeType` parameter entirely and always uses `XLSX.read(buf, { type: "buffer" })`. The xlsx library can parse CSV buffers this way, so it works in practice, but if the library's CSV parsing behavior ever diverges from the caller's expectation the parameter being silently ignored offers no fallback. No fix required now — just document the implicit assumption.

- **[severity: low]** correctness: The `isDocMime` helper (line 64) matches any `application/vnd.openxmlformats-officedocument.*` MIME type, which includes spreadsheet (`xlsx`) and presentation (`pptx`) types. However, the spreadsheet branch fires first (line 218), so XLSX files never reach the doc branch. PPTX files reach the doc branch, have no htmlPreviewKey in most cases, and then fall through to the `extractPdfText`/`extractDocxText` fallback — neither of which can parse PPTX — and ultimately land on the "text preview unavailable" file note. This is an acceptable graceful degradation, not a bug.

- **[severity: low]** readability: `streamToBuffer` has no size cap. A malicious or corrupt storage backend could stream an arbitrarily large object into memory. The per-image 5MB cap on `sizeBytes` (from the DB row) mitigates this for images because the check is pre-download, but for documents the `MAX_DIRECT_EXTRACT_BYTES` check also uses `sizeBytes` — which trusts the DB value. If `sizeBytes` is wrong (e.g., a record was inserted with an incorrect value), the buffer could grow unexpectedly. Low severity because the storage backend is internal, not user-controlled.

## Verdict

PASS WITH NOTES — all four blockers are confirmed fixed, no blocking issues remain. The three low-severity notes above are all edge cases with acceptable existing mitigations and do not require changes before shipping.

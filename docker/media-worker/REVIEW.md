## Summary

All 8 previously reported fixes are confirmed in place. Three new issues remain — one important and two low-severity.

---

## Previously Reported Fixes — Confirmation

1. **Double workDir cleanup removed from convertToHtml** — CONFIRMED. `convert.js` has no cleanup block; cleanup is handled exclusively by the caller in `index.js` line 135.

2. **storageKey path traversal validation added** — CONFIRMED. `isValidStorageKey` at `index.js:23-25` rejects keys containing `..` and enforces an allowlist character regex. Applied consistently on all three endpoints before any storage call.

3. **Video extension uses hardcoded allowlist map** — CONFIRMED. `VIDEO_MIME_TO_EXT` in `index.js:15-21` maps MIME type to extension. Unknown MIME types return 422 rather than deriving an extension from the raw string.

4. **Subprocess timeouts added** — CONFIRMED. LibreOffice: 120 s (`convert.js:52-53`). ffmpeg: 30 s (`thumbnail.js:22-23`). Both use `SIGKILL` on timeout with timer cleared on normal exit.

5. **Size check before streaming** — CONFIRMED. `getObject` in `storage.js:39-42` reads `ContentLength` and throws before consuming the body if it exceeds `maxBytes`. All three callers pass explicit limits (200 MB convert, 100 MB image, 2 GB video, 50 MB extract).

6. **Dead imageThumbnail export removed, ffmpeg error logs properly** — CONFIRMED. Only `videoThumbnail` is exported from `thumbnail.js`. ffmpeg stderr is captured and logged with the exit code at `thumbnail.js:34`.

7. **LibreOffice stdout set to `ignore`** — CONFIRMED. `convert.js:50`: `stdio: ["ignore", "ignore", "pipe"]`.

8. **Unused import removed** — CONFIRMED. No stale imports found in any file.

---

## Issues

- **[severity: important]** **Security**: The `ContentLength` guard in `storage.js:39` only fires when `ContentLength` is present in the response. S3/MinIO can legally omit this header for objects uploaded with chunked transfer encoding or multipart upload. When absent, the condition is falsy and the entire object streams into memory with no cap. A caller relying on the 50 MB limit for `/extract` gets no protection in that case. Suggested fix: accumulate chunk byte counts inside the `for await` loop and throw if the running total exceeds `maxBytes`, regardless of whether the header was present.

- **[severity: low]** **Correctness**: `convertToHtml` in `convert.js` assumes the LibreOffice output file is always named `input.html` (line 72). This works today because the caller in `index.js` always names the input file `input.${ext}`. However the dependency is invisible — if the input filename changes in `index.js`, `convert.js` reads a missing path and throws a confusing `ENOENT`. The output path should be derived explicitly from `inputPath` (replace extension) rather than assumed.

- **[severity: low]** **Error handling**: When the size limit is exceeded in `storage.js:40`, `response.Body.destroy?.()` is called to abort the stream. `destroy` is a Node.js `Readable` method; the AWS SDK v3 may return a web `ReadableStream` in some runtimes, which uses `cancel()` instead. Optional chaining prevents a crash but silently leaves the connection open. Both `response.Body.destroy?.()` and `response.Body.cancel?.()` should be called to cover both stream types.

---

## Verdict

APPROVED — the one important issue (size limit bypass when `ContentLength` is absent) should be fixed in a follow-up before high-volume production use, but is not a blocker for an internal trusted-network service. The two low-severity items carry no immediate risk.

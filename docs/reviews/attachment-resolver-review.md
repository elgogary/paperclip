## Summary

Solid, well-structured service with good layered security (null byte, pre-resolve, symlink, MIME, size — in that order). The recent fixes addressed the most dangerous gaps. A few correctness issues remain that could cause silent failures or data inconsistency under realistic conditions.

---

## Issues

---

[IMPORTANT] `workspaceRoot` trailing-separator inconsistency between `isSafePath` and `resolveAttachTokens`
Location: attachment-resolver.ts:119 vs attachment-resolver.ts:61-62
Problem: `isSafePath` normalizes the root with a trailing `/` before calling `startsWith`. The post-realpath check at line 119 manually appends `path.sep` inline. On Windows `path.sep` is `\`, but `workspaceRoot` strings in config are likely always `/`-delimited. On Linux this is fine, but the two callsites are using different constructions for the same invariant — a future copy-paste or cross-platform execution will diverge silently. More concretely: `isSafePath` correctly handles the case where `normalized === workspaceRoot` (exact match), but line 119 handles that separately via `|| realPath !== workspaceRoot`. The logic is equivalent but duplicated with different structure, and one of them will be wrong when someone edits just one branch.
Fix: Extract a single `isWithinRoot(realPath, workspaceRoot)` predicate reusing the same `endsWith("/")` guard, then call it from both the pre-resolve check and the post-realpath check.

---

[IMPORTANT] `isSafePath` does not call `fs.realpath` — pre-resolve check can be bypassed
Location: attachment-resolver.ts:59-63
Problem: `isSafePath` uses `path.resolve()` which is a pure string operation. A path like `/workspace/link` where `link` is a symlink to `/etc/shadow` will pass `isSafePath` (resolves to `/workspace/link` which is inside root) and only get caught by the post-realpath check at line 119. This is the intended design per the comment on line 102 ("Pre-resolve check: reject obviously bad paths"). The risk is that `isSafePath` is exported as a public function. Any future caller who imports it and uses it as the only safety check — without also calling `fs.realpath` afterward — has a symlink escape vulnerability. The function's name (`isSafePath`) implies it is the authoritative safety check, but it is not sufficient on its own.
Fix: Either rename it to `isStaticallySafePath` or add a JSDoc comment on the export making explicit that symlink safety requires a subsequent `realpath` check. Preventing misuse is worth one comment here.

---

[IMPORTANT] `resolveAttachTokens` silently drops `failed` tokens when `uploaderType === "user"`
Location: attachment-resolver.ts:86-89
Problem: When the uploader is a board user, the function returns `{ resolved: [], failed: [] }`. The tokens are not in `failed` — they are simply discarded. The caller receiving this result cannot distinguish between "no tokens were present" and "tokens were present but suppressed." If the caller uses `failed.length > 0` to decide whether to show a warning to the user, that warning will never appear. Whether this is intended behavior is not documented in the function signature or return type.
Fix: Either populate `failed` with a `reason: "uploader_not_allowed"` entry for each suppressed token so the caller can act on them, or document clearly in the JSDoc that user-uploaded tokens are silently discarded by design. The current comment (`// Fix 6`) is internal — the exported behavior is undocumented.

---

[IMPORTANT] Race condition: `stat.size` used for `sizeBytes` DB column but `fileBuffer.length` is the authoritative value
Location: attachment-resolver.ts:131-158
Problem: The `stat.size` (line 131) is read before `readFile` (line 137). If the file is being written concurrently (common in agent workspaces), `stat.size` may reflect a smaller or larger size than what is actually read into `fileBuffer`. The DB record stores `stat.size` as `sizeBytes` (line 157) while the storage object contains `fileBuffer` which may differ. This is a TOCTOU (time-of-check/time-of-use) issue. The size check itself is still valid as a best-effort guard, but the stored `sizeBytes` can be inaccurate.
Fix: After `readFile`, use `fileBuffer.byteLength` as the `sizeBytes` value in the DB insert rather than `stat.size`. The stat check can still use `stat.size` as a fast pre-read guard.

---

[SUGGESTION] `classifyError` matches on raw English message strings — fragile coupling
Location: attachment-resolver.ts:188-194
Problem: Error classification depends on substrings of internal error messages ("Path traversal", "File not found", etc.). If any throw site changes its message wording (e.g., during a refactor), the classifier silently falls back to `"internal_error"` with no compile-time or test-time signal. Tests currently assert the classified reason, so a message change would be caught — but only if the relevant test runs.
Fix: Use a typed error class or an error code property (`err.code = "PATH_TRAVERSAL"`) instead of string matching. This makes the coupling explicit and compiler-visible.

---

[SUGGESTION] Unhandled promise for media-worker `fetch` call is fire-and-forget with no timeout
Location: attachment-resolver.ts:164-170
Problem: The `fetch` to the media-worker has no timeout. If the worker is slow (e.g., processing a large video), the detached promise can hold open the event loop or accumulate silently. In a high-throughput scenario with many attachments, this creates unbounded background work. A hung media-worker will log one `console.warn` per token but will not surface as a failure.
Fix: Wrap the `fetch` call with `AbortSignal.timeout(5000)` (Node 18+) so the detached promise has a bounded lifetime. This is already a low-severity concern given the `.catch` handler, but worth noting for production.

---

[SUGGESTION] Test: "rejects disallowed MIME type without reading file into memory" — assertion comment contradicts code order
Location: attachment-resolver.test.ts:447-449
Problem: The test comment says "MIME check happens first" and asserts `stat` was not called. Looking at the implementation, the order is: `realpath` → extension extraction → `getMimeType` → `isAllowedContentType` → `stat`. So `stat` is correctly skipped when MIME is rejected. However, `realpath` IS called before the MIME check, and the test does not mock `stat` at all. This is correct test behavior (stat would throw if called since it is not mocked), but the comment is slightly misleading — it should say "stat and readFile are skipped because MIME check rejects before reaching them."
Fix: Minor wording fix in the test comment. No code change needed.

---

## Verdict

NOT APPROVED

Three IMPORTANT issues need resolution before merge:
1. The `stat.size` / `fileBuffer.byteLength` mismatch can cause inaccurate DB records (data correctness).
2. The silent discard of user tokens leaves callers unable to surface warnings to end users (behavioral correctness, undocumented contract).
3. The `isSafePath` export is misleading about what safety guarantee it provides (security footgun for future callers).

The CRITICAL security path (null byte → static path check → realpath → workspace containment → MIME → stat-before-read) is correctly ordered and well-tested. No blocking security vulnerabilities exist in the current call path.

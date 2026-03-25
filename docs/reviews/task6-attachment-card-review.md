## Frontend Review: Task 6 — AttachmentCard UI

Files reviewed:
- `ui/src/components/attachments/AttachmentCard.tsx`
- `ui/src/components/attachments/AttachmentUploadZone.tsx`
- `ui/src/components/attachments/__tests__/AttachmentCard.test.tsx`
- `ui/src/api/attachments.ts`
- `ui/src/components/MarkdownBody.tsx`
- `ui/src/components/CommentThread.tsx` (design comparison)
- `ui/src/components/ApprovalCard.tsx` (design comparison)
- `ui/src/components/ui/skeleton.tsx` (design token reference)

---

### Summary

The AttachmentCard implementation covers all six media type variants correctly and integrates cleanly with MarkdownBody, but has several accessibility gaps, one critical type mismatch between the API and the card's status enum, one missing AbortController in InlineAttachment, and a chunk upload that has no retry logic and silently abandons partial uploads on failure.

---

### Spec Compliance

| # | Requirement | Status | Notes |
|---|---|---|---|
| 1 | image/* → inline img, lazy loading | PASS | `loading="lazy"` present, wraps in `<a>` to open full-size |
| 2 | video/* → controls, preload="none", poster thumbnail | PASS | All three attributes present |
| 3 | application/pdf → "View PDF" opens new tab | PASS | `target="_blank"` + `rel="noreferrer"` |
| 4 | Office types → "View Document" | PASS | Covers `application/vnd.openxmlformats-officedocument.*` only — see issue below |
| 5 | text/* / code → View + Download | PASS | Both actions present; "View" opens in new tab |
| 6 | Generic fallback → download | PASS | |
| 7 | status="processing" → spinner | PASS | Also covers "uploading" and "assembling" |
| 8 | status="error" → error state | PASS | |
| 9 | `[label](attachment:UUID)` in MarkdownBody | PASS | `parseAttachmentHref` + `InlineAttachment` wired correctly |
| 10 | Upload zone: drag-drop, chunked, progress, onAttached | PASS | All present |
| 11 | formatBytes helper | PASS | Exported and tested |

---

### Critical Issues

**[CRITICAL] `AttachmentCard.tsx` line 22 — Status enum mismatch with API**

`AttachmentCardProps.status` includes `"processing"` and `"uploading"` and `"assembling"`.
`AttachmentMeta.status` in `api/attachments.ts` line 14 does NOT include `"processing"` — it only has `"uploading" | "assembling" | "ready" | "error"`.

`InlineAttachment` in `MarkdownBody.tsx` line 157 manually maps the API status:
```
status={meta.status === "ready" ? "ready" : meta.status === "error" ? "error" : "processing"}
```
This mapping swallows the semantically distinct `"uploading"` and `"assembling"` states and collapses them both to `"processing"`. This is safe today because the UI for all three is identical, but the prop type claims to expose all three granular states while the API type does not carry them. Either:
- Remove `"uploading"` and `"assembling"` from `AttachmentCardProps.status` and keep only `"processing" | "ready" | "error"`, or
- Add `"processing"` to `AttachmentMeta.status` in `api/attachments.ts` so the types are consistent.

The current state is a silent lie in the type signature that will cause confusion when someone tries to pass `meta.status` directly to `AttachmentCard`.

---

**[CRITICAL] `MarkdownBody.tsx` line 130 — No AbortController on the `attachmentsApi.get()` fetch in `InlineAttachment`**

The `useEffect` sets `active = false` on cleanup, which prevents stale state updates, but it does NOT abort the in-flight network request. If the component unmounts mid-flight (e.g., user navigates away while a long attachment is loading), the request continues consuming bandwidth and a connection slot. The `active` guard only prevents the `setState` call — the fetch itself runs to completion.

`attachmentsApi.get()` goes through `api.get()` (the shared client). If that client accepts an `AbortSignal`, pass one. If it does not, the fetch inside `uploadChunk` (line 56, `attachments.ts`) uses raw `fetch` and does accept a signal. The `get` wrapper likely does too — verify and add an `AbortController` pattern to match the cleanup already done in `MermaidDiagramBlock` (line 70-98, same file), which correctly uses the `active` flag but also shows the established pattern in this codebase.

---

**[CRITICAL] `AttachmentUploadZone.tsx` line 41-47 — No chunk retry logic; partial uploads are silently orphaned**

If any single chunk `PUT` fails (network blip, 5xx, timeout), the `catch` at line 51 fires, sets the error message, and returns. The partially uploaded attachment record created by `initUpload` is now an orphan on the server — it has an `attachmentId` in `"uploading"` status but no client will ever call `completeUpload` on it. There is no retry, no cleanup call, and no user affordance to resume.

This is acceptable for a v1 if the server auto-expires incomplete uploads, but the UX consequence is that the user sees "Upload failed" with no retry button and must re-select the file. At minimum:
- Add a retry button that re-runs the entire upload (not just the failed chunk).
- Document whether the server cleans up orphaned upload records.

If the server does NOT expire them, this is a data leak issue (orphaned blob storage) and becomes Critical from a backend perspective too.

---

### Accessibility Issues

**[Important] `AttachmentCard.tsx` line 119 — `<video>` has no accessible label**

The `<video>` element has no `aria-label` and no `<track>` element for captions or descriptions. Screen readers will announce the video controls but the user will not know what the video is. Fix: add `aria-label={filename}` to the `<video>` tag.

```tsx
<video
  controls
  preload="none"
  poster={thumbnailUrl ?? undefined}
  aria-label={filename}
  className="w-full max-h-96"
>
```

**[Important] `AttachmentCard.tsx` line 197-203 — Download-only button has no accessible label**

The download button in `TextCard` renders an icon with no text and no `aria-label`:
```tsx
<a href={downloadUrl} download={filename} className="...">
  <Download className="h-3.5 w-3.5" />
</a>
```
A screen reader will announce this as an unlabeled link. Fix: add `aria-label={`Download ${filename}`}`.

**[Important] `AttachmentUploadZone.tsx` line 96-128 — Upload zone missing `aria-label` and `aria-busy`**

The drop zone uses `role="button"` which is correct, but it has no `aria-label` to describe its purpose beyond what a sighted user reads from the inner `<p>` text. When `uploading` is true there is no `aria-busy="true"` to signal the busy state to assistive technology.

Fix:
```tsx
<div
  role="button"
  tabIndex={0}
  aria-label="Upload attachment — drop a file or press Enter to browse"
  aria-busy={uploading}
  ...
>
```

**[Important] `AttachmentUploadZone.tsx` line 117 — `<Upload>` icon has no aria-hidden**

Lucide icons render as inline SVGs. The `Upload` icon inside the drop zone is decorative (the adjacent `<p>` describes the action). Without `aria-hidden="true"` on the icon, screen readers may announce it as an unlabeled image.

Fix: `<Upload className="h-5 w-5 text-muted-foreground" aria-hidden="true" />`

This applies equally to all Lucide icons used decoratively inside interactive elements throughout `AttachmentCard.tsx` (lines 70, 81, 117, 139, 151, 161, 162, 182, 194, 212, 218).

**[Suggestion] `AttachmentCard.tsx` — `<ImageCard>` wrapping anchor needs a label**

```tsx
<a href={downloadUrl} target="_blank" rel="noreferrer">
  <img src={downloadUrl} alt={filename} loading="lazy" ... />
</a>
```
The `<img>` has an `alt`, so screen readers will announce the filename as the link text — this is acceptable. No change needed, but note that if the image fails to load the broken image icon also has no alt-based fallback text beyond the `alt` attribute.

---

### Design System Issues

**[Suggestion] `AttachmentCard.tsx` lines 139, 161 — Hard-coded color values outside design tokens**

Two icons use hard-coded Tailwind color classes:
- `FileText` on line 139: `text-red-500`
- `FileSpreadsheet` on line 161: `text-blue-500`

The rest of the codebase (e.g., `ApprovalCard.tsx` lines 10-14) uses `dark:` variants when using named Tailwind colors. These two icon colors have no dark-mode variant, meaning they will be the same `red-500`/`blue-500` in both modes. This may be intentional (the colors are standard document type colors), but they should at minimum have dark variants: `text-red-500 dark:text-red-400` / `text-blue-500 dark:text-blue-400` to match contrast in dark mode.

**[Suggestion] `MarkdownBody.tsx` line 143-146 — Loading state uses plain text, not a skeleton**

When `InlineAttachment` is loading, it renders:
```tsx
<span className="text-xs text-muted-foreground">{label || "Loading attachment..."}</span>
```
The rest of the app uses `<Skeleton>` (see `ui/src/components/ui/skeleton.tsx`) for loading placeholders. A skeleton card matching the approximate height of an attachment card would produce less layout shift when the metadata loads and is more consistent with the design system.

---

### XSS / Security Issues

**[Important] `MarkdownBody.tsx` line 104 — `dangerouslySetInnerHTML` with Mermaid SVG**

```tsx
<div dangerouslySetInnerHTML={{ __html: svg }} />
```

Mermaid is initialized with `securityLevel: "strict"` (line 80), which sandboxes click handlers and external links inside the rendered SVG. This is the correct setting and mitigates most injection risk. However, this is worth calling out explicitly: if the Mermaid library version used ever regresses on strict mode, this is a direct XSS vector. Ensure Mermaid is pinned to a version with a known-good strict mode in `package.json`.

This is a pre-existing pattern, not introduced by Task 6, but it lives in the same file and the reviewer should be aware.

**[PASS] URL injection in `downloadUrl` / `thumbnailUrl`**

Both are sourced from `AttachmentMeta` returned by the API. The API response is trusted (same origin, authenticated). No raw markdown user input is interpolated into `href` or `src` attributes without going through the API layer first. The `parseAttachmentHref` function only extracts a UUID segment, not a full URL.

**[PASS] `target="_blank"` links all have `rel="noreferrer"`**

Present on all external link anchors in `AttachmentCard.tsx`. Correct.

---

### Performance Issues

**[Important] `MarkdownBody.tsx` — `InlineAttachment` fires a network request per attachment on every render cycle where the `attachmentId` prop is stable**

The `useEffect` dependency is `[attachmentId]`, which is correct — it only re-fetches when the ID changes. However, there is no caching layer. If the same `attachmentId` appears twice in the same document, two independent requests are made to `GET /api/attachments/:id`. If the document has many attachments, they all fire in parallel on mount. This is an N×1 pattern (one request per attachment per mount).

For v1 this is acceptable, but a simple module-level Map cache keyed by `attachmentId` would eliminate duplicate fetches within the same session.

**[Suggestion] `AttachmentUploadZone.tsx` line 46 — Progress jumps at chunk boundaries**

```tsx
setProgress(Math.round((offset / file.size) * 100));
```
Progress only updates after each chunk completes, so for a 4 MB chunk on a slow connection, the bar sits at 0% for a long time then jumps to 100%. Within a chunk there is no partial progress signal (the Fetch API does not expose upload progress natively without XHR). This is a known limitation of the `fetch` API. Consider using XHR with `upload.onprogress` if smooth progress is a UX requirement, or add a note in the code that progress is chunk-granular.

**[PASS] No N+1 queries in loops**

The chunk upload loop is sequential by design (each chunk waits for the previous to complete), which is correct for ordered reassembly on the server side.

**[PASS] Mermaid loaded lazily**

`loadMermaid()` uses a module-level promise cache so the dynamic import fires only once regardless of how many diagrams are on the page.

---

### TypeScript Issues

**[Important] `AttachmentCard.tsx` line 230 — Unsafe cast to access `className`**

```tsx
const { status, mimeType, className } = props as AttachmentCardProps & { className?: string };
```
`AttachmentCardProps` does not include `className`, so it is cast away. This works at runtime but suppresses TypeScript's check. The fix is to extend the interface:
```ts
export interface AttachmentCardProps {
  ...
  className?: string;
}
```
Or accept it separately in the function signature. The cast pattern is unnecessary.

**[Suggestion] `api/attachments.ts` line 39 — `CompleteUploadResult.status` typed as `string`**

```ts
interface CompleteUploadResult {
  url: string;
  attachmentId: string;
  status: string;  // <-- should be the same union as AttachmentMeta.status
}
```
This should be typed as `AttachmentMeta["status"]` or the explicit union to catch any future status value additions at compile time.

---

### Test Coverage

**[Important] Missing test: `InlineAttachment` error state**

The `__tests__/AttachmentCard.test.tsx` file tests `AttachmentCard` in isolation but does not test `InlineAttachment` at all. The following states are untested:
- API fetch failure → renders "[attachment unavailable]" span
- Loading state → renders label text while fetching
- Successful fetch → renders `AttachmentCard` with resolved props

These are rendered inside `MarkdownBody` via the `a` component override. They should have tests, ideally in `MarkdownBody.test.tsx`.

**[Important] Missing test: upload failure in `AttachmentUploadZone`**

No tests exist for `AttachmentUploadZone` at all. The following paths are untested:
- `initUpload` throws → error state shown
- Chunk PUT returns 4xx → error message shown, upload stops
- `completeUpload` throws → error state shown

**[Suggestion] Missing test: `status="assembling"` renders processing state**

The test at line 101-104 covers `status="uploading"` but there is no test for `status="assembling"`. Given all three map to `ProcessingState`, this is low risk but an easy gap to close.

**[PASS] Happy-path coverage is solid**

All six media type variants, the two non-happy statuses, `formatBytes` edge cases, and the core download URL are all tested.

---

### Verdict

**NEEDS CHANGES**

Fix in priority order:

1. **[CRITICAL]** Resolve the status enum mismatch between `AttachmentCardProps` and `AttachmentMeta` — pick one canonical set and remove the cast in `InlineAttachment`.
2. **[CRITICAL]** Add `AbortController` to the `attachmentsApi.get()` call in `InlineAttachment.useEffect`.
3. **[CRITICAL]** Add a retry button to `AttachmentUploadZone` and confirm / document server-side cleanup of orphaned upload records.
4. **[Important]** Add `aria-label` to `<video>` elements and the download-only `<a>` in `TextCard`.
5. **[Important]** Add `aria-label` + `aria-busy` to the upload drop zone div.
6. **[Important]** Add `aria-hidden="true"` to all decorative Lucide icons inside interactive elements.
7. **[Important]** Fix the `className` cast in `AttachmentCard` — add it to the interface.
8. **[Important]** Add tests for `InlineAttachment` states and `AttachmentUploadZone` error paths.
9. **[Suggestion]** Replace the loading `<span>` in `InlineAttachment` with a `<Skeleton>` card.
10. **[Suggestion]** Add dark-mode variants to `text-red-500` and `text-blue-500` icon classes.
11. **[Suggestion]** Type `CompleteUploadResult.status` as the `AttachmentMeta["status"]` union.

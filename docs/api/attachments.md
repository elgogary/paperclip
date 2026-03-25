---
title: Attachments
summary: Chunked file upload, metadata retrieval, content streaming, and deletion
---

File attachments are linked to issues and optionally to a specific comment. Upload is chunked — large files are split into ≤50 MB pieces, then assembled server-side on complete.

All routes require authentication. Board users must supply `companyId`; agent tokens carry it automatically.

Base path: `/api/attachments`

---

## Initialize Upload

```
POST /api/attachments/init
```

Creates an attachment record in `uploading` status and returns an ID to use for subsequent chunk and complete calls.

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `issueId` | string | yes | Issue the file belongs to |
| `filename` | string | yes | Display name. No path separators or null bytes. Max 255 chars. |
| `mimeType` | string | yes | Must be a [supported MIME type](#supported-mime-types) |
| `sizeBytes` | number | yes | Total file size in bytes (positive integer) |
| `commentId` | string | no | Associate with a specific comment (can also be set on complete) |
| `companyId` | string | board users only | Not needed for agent tokens |

**Response `201`:**

```json
{ "uploadId": "uuid", "attachmentId": "uuid" }
```

**Error codes:** `400` invalid fields, `401` unauthenticated, `413` file too large, `415` unsupported MIME type

---

## Upload Chunk

```
PUT /api/attachments/:attachmentId/chunk
```

Upload one chunk of the file body. Chunks must be ≤50 MB. The server stores them keyed by byte offset; ordering is determined at assembly time.

**Headers:**

| Header | Format | Example |
|--------|--------|---------|
| `Content-Range` | `bytes start-end/total` | `bytes 0-52428799/104857600` |
| `Content-Type` | `application/octet-stream` | |
| `Content-Length` | byte count of this chunk | `52428800` |

**Response `200`:**

```json
{ "received": true, "bytesReceived": 52428800 }
```

**Error codes:** `400` missing or invalid Content-Range / chunk size mismatch, `404` attachment not found, `409` upload already finalized, `413` chunk exceeds 50 MB

---

## Complete Upload

```
POST /api/attachments/:attachmentId/complete
```

Assembles all uploaded chunks into the final file, marks the attachment `ready`, and fires an async thumbnail job for images and videos.

The transition from `uploading` → `assembling` → `ready` is atomic — calling complete twice returns `409`.

**Request body (optional):**

```json
{ "commentId": "uuid" }
```

Overrides or sets the comment association if not provided at init time.

**Response `200`:**

```json
{
  "attachmentId": "uuid",
  "status": "ready",
  "url": "/api/attachments/uuid/content"
}
```

**Error codes:** `404` attachment not found, `409` already completed or in wrong state

---

## Get Attachment Metadata

```
GET /api/attachments/:attachmentId
```

Returns full metadata for an attachment.

**Response `200`:**

```json
{
  "id": "uuid",
  "issueId": "uuid",
  "commentId": "uuid | null",
  "uploaderType": "agent | user",
  "uploaderId": "uuid",
  "filename": "report.pdf",
  "mimeType": "application/pdf",
  "sizeBytes": 204800,
  "versionOf": "uuid | null",
  "versionNum": 1,
  "status": "ready",
  "publishUrl": "string | null",
  "createdAt": "2026-03-25T10:00:00Z",
  "updatedAt": "2026-03-25T10:00:05Z",
  "downloadUrl": "/api/attachments/uuid/content",
  "thumbnailUrl": "/api/attachments/uuid/thumbnail | null",
  "htmlPreviewKey": "string | null"
}
```

`thumbnailUrl` is non-null once the media-worker has processed the file (images: immediately; videos: within ~30 s).

`htmlPreviewKey` is non-null for Office documents (DOCX, XLSX, PPTX) after LibreOffice conversion.

---

## Stream File Content

```
GET /api/attachments/:attachmentId/content
```

Streams the raw file with `Content-Disposition: inline`, `Content-Type` from the stored MIME type, and `Cache-Control: private, max-age=60`.

---

## Stream HTML Preview

```
GET /api/attachments/:attachmentId/preview
```

Streams the LibreOffice-generated HTML for Office documents. Returns `404` if `htmlPreviewKey` is null (file is still processing or not an Office type).

Response headers: `Content-Type: text/html; charset=utf-8`, `Cache-Control: private, max-age=60`.

---

## Stream Thumbnail

```
GET /api/attachments/:attachmentId/thumbnail
```

Streams the JPEG thumbnail for images and videos. Returns `404` if `thumbnailKey` is null (still processing or type has no thumbnail).

Response headers: `Content-Type: image/jpeg`, `Cache-Control: public, max-age=3600`.

---

## List Attachments for Issue

```
GET /api/attachments/issue/:issueId?companyId=uuid
```

Returns all attachments linked to an issue. `companyId` is required for board users; agent tokens supply it automatically.

**Response `200`:**

```json
{
  "attachments": [
    {
      "id": "uuid",
      "issueId": "uuid",
      "commentId": "uuid | null",
      "uploaderType": "agent",
      "uploaderId": "uuid",
      "filename": "diagram.png",
      "mimeType": "image/png",
      "sizeBytes": 81920,
      "versionOf": null,
      "versionNum": 1,
      "status": "ready",
      "publishUrl": null,
      "createdAt": "2026-03-25T10:00:00Z",
      "updatedAt": "2026-03-25T10:00:02Z",
      "downloadUrl": "/api/attachments/uuid/content",
      "thumbnailUrl": "/api/attachments/uuid/thumbnail",
      "htmlPreviewKey": null
    }
  ]
}
```

---

## Delete Attachment

```
DELETE /api/attachments/:attachmentId
```

Deletes the attachment record and removes the file (and thumbnail if present) from storage. Only the original uploader or a board admin can delete.

**Response `200`:**

```json
{ "ok": true }
```

**Error codes:** `403` not the uploader or admin, `404` not found

---

## Attachment Status Lifecycle

```
uploading  →  assembling  →  ready
                          →  error (if assembly fails)
```

- `uploading` — chunks are being received
- `assembling` — complete was called; chunks being joined (atomic, prevents double-complete)
- `ready` — file available for download; thumbnail/preview may still be generating asynchronously
- `error` — assembly failed

---

## Supported MIME Types

Images: `image/png`, `image/jpeg`, `image/gif`, `image/webp`

Video: `video/mp4`, `video/webm`, `video/quicktime`, `video/avi`, `video/x-matroska`

Audio: `audio/mpeg`, `audio/wav`, `audio/ogg`

Documents: `application/pdf`, `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `application/vnd.ms-excel`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `application/vnd.ms-powerpoint`, `application/vnd.openxmlformats-officedocument.presentationml.presentation`

Text/code: `text/plain`, `text/markdown`, `text/csv`, `application/json`, `application/xml`, `text/javascript`, `text/typescript`, `text/x-python`

**Size limits:** Images ≤50 MB, video ≤2 GB, audio ≤200 MB, documents ≤100 MB, text/code ≤10 MB.

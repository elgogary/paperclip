# Multimodal Attachment System — Design Doc
**Date:** 2026-03-25
**Status:** Approved
**Server:** 65.109.65.159 (Hetzner — same as Paperclip + Sanad Brain)

---

## Problem

Agents generate files (DOCX reports, videos, charts) but the Paperclip issue view is text/markdown only. Humans cannot preview agent output without downloading files manually. Agents cannot see files humans attach. The marketing agent that generates videos has no delivery pipeline.

---

## Goals

1. Agents attach any file via `[[attach:/workspace/path]]` syntax in comment body
2. Humans drag-drop or click to upload any file into comments
3. Rich inline preview per file type (image, video, PDF, Office, code)
4. Agents receive human-attached files as vision input (bidirectional)
5. Approved videos publish to YouTube + LinkedIn
6. media-worker Docker container reusable for future workloads (Whisper, video trimming, batch ops)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   65.109.65.159 (Hetzner)                   │
│                                                             │
│  ┌──────────────┐   ┌───────────────────────────────────┐  │
│  │  Paperclip   │──►│  media-worker (Docker sidecar)    │  │
│  │  Server      │   │  - ffmpeg (video thumbnails)      │  │
│  │  (Node/TS)   │   │  - LibreOffice headless (Office)  │  │
│  └──────┬───────┘   │  - REST: /thumbnail /convert      │  │
│         │           └─────────────────┬─────────────────┘  │
│         │                             │                     │
│         ▼                             ▼                     │
│  ┌────────────────────────────────────────────────────┐    │
│  │              MinIO (already running)               │    │
│  │   bucket: paperclip-files                          │    │
│  │   presigned URLs for upload + delivery             │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### New table: `attachments`

```sql
CREATE TABLE attachments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id        UUID REFERENCES issues(id) ON DELETE CASCADE,
  comment_id      UUID REFERENCES issue_comments(id) ON DELETE SET NULL,
  uploader_type   TEXT NOT NULL CHECK (uploader_type IN ('user', 'agent')),
  uploader_id     TEXT NOT NULL,           -- userId or agentId
  filename        TEXT NOT NULL,
  mime_type       TEXT NOT NULL,
  size_bytes      BIGINT NOT NULL,
  storage_key     TEXT NOT NULL,           -- MinIO object key
  thumbnail_key   TEXT,                    -- MinIO key for thumbnail
  html_preview_key TEXT,                   -- MinIO key for LibreOffice HTML
  version_of      UUID REFERENCES attachments(id),  -- null = original
  version_num     INT NOT NULL DEFAULT 1,
  status          TEXT NOT NULL DEFAULT 'processing'
                  CHECK (status IN ('processing', 'ready', 'error')),
  publish_url     TEXT,                    -- YouTube/LinkedIn URL after publish
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## Upload Flow (chunked, resumable)

```
1. POST /api/attachments/init
   Body: { filename, mimeType, sizeBytes, issueId, commentId? }
   Returns: { attachmentId, uploadId, chunkSize }

2. PUT /api/attachments/:id/chunks/:n
   Body: binary chunk
   Returns: { received }

3. POST /api/attachments/:id/complete
   Returns: { attachment }
   Server: finalizes MinIO multipart → queues thumbnail job

4. media-worker processes async:
   - Video → ffmpeg frame at 1s → thumbnail stored in MinIO
   - DOCX/XLSX/PPTX → LibreOffice headless → HTML → stored in MinIO
   - Image → resize to 1200px max → thumbnail stored
   - status updated to 'ready'
```

---

## Agent Syntax

Agents write in comment body:

```
[[attach:/workspace/docs/reports/sanad-brain-security-srs.docx]]
[[attach:/workspace/output/demo.mp4 | title="Product Demo v2"]]
[[attach:/workspace/charts/revenue.xlsx | title="Q1 Revenue"]]
```

Server parses `[[attach:...]]` tokens before saving the comment:
1. Resolves workspace path → reads file from agent's workspace
2. Uploads to MinIO → creates `attachment` record linked to comment
3. Queues thumbnail/convert job
4. Replaces token in stored comment body with `[[attachment:{id}]]`

---

## UI Preview Cards

Rendered by `AttachmentCard` component inside `MarkdownBody`:

| MIME type | Preview |
|-----------|---------|
| `image/*` | Inline full-width, click to expand lightbox |
| `image/gif` | Animated inline |
| `video/*` | `<video>` streaming player, range-request delivery, timestamp comment pins |
| `application/pdf` | "View PDF" button → `<iframe>` modal with PDF.js |
| `application/vnd.openxmlformats-officedocument.*` (DOCX/XLSX/PPTX) | "View Document" → iframe serving LibreOffice HTML from MinIO |
| `text/*`, code files | Syntax-highlighted code block (highlight.js) |
| `application/vnd.ms-excel`, `text/csv` | Table preview (first 50 rows) |
| `*/*` (fallback) | Download card: icon + filename + file size |

Version history: if attachment has versions, show "v1 → v2 → v3" selector on the card.

---

## Agent Vision (Bidirectional)

When a human attaches a file to an issue/comment, the next agent run receives:

| File type | What agent gets |
|-----------|----------------|
| Image / video frame | Base64 image block in Claude message (vision) |
| PDF | Extracted text via `pdf-parse` |
| DOCX | Extracted text via `mammoth` |
| XLSX / CSV | Row data as JSON |
| Timestamp comments | `[{ time: "0:12", note: "fix logo" }]` structured list |

Agent instructions in `CAPABILITIES.md` will document:
```
When a human attaches a file, you will receive it as context before your task.
Images → vision block. Documents → extracted text. Videos → key frame + transcript.
```

---

## Publish Pipeline (Video)

```
Human clicks "Approve" on video attachment card
→ POST /api/attachments/:id/publish { destinations: ["youtube", "linkedin"] }
→ Server:
    YouTube: uploads via YouTube Data API v3 (title, description, tags from issue)
    LinkedIn: uploads teaser clip (first 60s) via LinkedIn Video API
→ attachment.publish_url updated
→ Agent notified via issue comment: "Published to YouTube: {url}"
```

Credentials stored in Infisical: `YOUTUBE_API_KEY`, `LINKEDIN_CLIENT_ID/SECRET`

---

## media-worker Docker Container

**Image:** custom `paperclip-media-worker`
**Base:** `jrottenberg/ffmpeg:6-ubuntu` + LibreOffice headless layer
**REST API:**

```
POST /thumbnail   { storageKey, mimeType } → { thumbnailKey }
POST /convert     { storageKey, mimeType, targetFormat } → { outputKey }
POST /extract     { storageKey, mimeType } → { text }
```

**Reuse roadmap:**
- Phase 1: thumbnails + Office→HTML (this feature)
- Phase 2: Whisper audio transcription for meeting recordings
- Phase 3: Video trimming + format conversion for marketing agent
- Phase 4: Batch image optimization for AccuBuild asset uploads

**docker-compose addition on 65.109.65.159:**
```yaml
media-worker:
  image: paperclip-media-worker:latest
  restart: unless-stopped
  environment:
    - MINIO_ENDPOINT=http://minio:9000
    - MINIO_ACCESS_KEY=${MINIO_ACCESS_KEY}
    - MINIO_SECRET_KEY=${MINIO_SECRET_KEY}
    - MINIO_BUCKET=paperclip-files
  ports:
    - "127.0.0.1:8200:8200"   # internal only
  volumes:
    - /workspace:/workspace:ro  # read agent workspace files
```

---

## Milestones

| Phase | Scope | Effort |
|-------|-------|--------|
| 1 | DB schema + MinIO bucket + chunked upload API | 3 days |
| 2 | Agent `[[attach:]]` syntax parser + resolver | 1 day |
| 3 | media-worker Docker (ffmpeg thumbnails + LibreOffice HTML) | 2 days |
| 4 | UI: AttachmentCard component + MarkdownBody integration | 3 days |
| 5 | Agent vision (file context injection into runs) | 2 days |
| 6 | Publish pipeline (YouTube + LinkedIn) | 2 days |

**Total: ~13 days**
**Marketing agent video workflow unblocked at Phase 4.**

---

## Open Questions

- MinIO bucket `paperclip-files`: public read (presigned URLs) or private + proxy?
  → Recommend presigned URLs (30-min expiry), consistent with existing `press-uploads` bucket.
- Workspace volume mount: agents run in Docker containers — confirm `/workspace` mount path on 65.109.65.159.
- LibreOffice HTML output fidelity: complex PPTX animations will be lost. Acceptable for v1.

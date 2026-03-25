# Paperclip Dev Log

## Working State
**Session:** Multimodal Attachments | **Date:** 2026-03-25

### Completed This Session
- [x] Task 1: DB schema — attachments table (migration 0044), self-ref FK, ON DELETE, updatedAt
- [x] Task 2: Attachment types — 31 MIME types, MAX_VIDEO_BYTES 2GB, safe env parsing
- [x] Task 3: Chunked upload API — init/chunk/complete/get/delete, chunk assembly, atomic TOCTOU guard
- [x] Task 4: [[attach:]] comment parser — isSafePath contract, symlink escape, null byte guard
- [x] Task 5: media-worker Docker — ffmpeg thumbnails, LibreOffice HTML, disk streaming, SSRF guard
- [x] Task 6: AttachmentCard UI — inline images, video player, Office viewer, upload zone, MarkdownBody hook
- [x] Task 7: Agent vision — vision blocks wired to openclaw-gateway adapter, magic byte validation, prompt injection guard
- [x] Task 9: Deploy runbook created, branch pushed to origin
- [x] Task 10: Wiki + API docs — docs/api/attachments.md, docs/guides/agent-developer/attachments.md, wiki README updated

### Branch
`feature/multimodal-attachments` — 28 commits, pushed to GitHub

### Key Files
**`server/src/routes/attachments.ts`** (MODIFIED, ~420 lines)
Chunked upload API with 6 endpoints. Chunk assembly via storage compose. Atomic status transitions. SSRF filename sanitization.

**`server/src/services/attachment-context.ts`** (NEW, ~300 lines)
Builds attachment context for agent runs. Vision blocks (base64), doc text extracts, file notes. Parallel downloads, 10MB budget, magic byte validation, prompt injection guard.

**`ui/src/components/attachments/AttachmentCard.tsx`** (NEW, ~249 lines)
Smart card rendering by mimeType. Handles images, video, PDF, Office, code, generic. Status-aware (processing/error/ready). a11y compliant.

**`docker/media-worker/`** (NEW)
Express service. ffmpeg for video thumbnails, LibreOffice for Office->HTML. Disk streaming, SSRF guard, workDir cleanup.

**`packages/db/src/migrations/0044_attachments.sql`** (NEW)
Attachments table. Drizzle format with --> statement-breakpoint and "public". prefix.

### Next Steps
1. SSH to 65.109.65.159, confirm MinIO container name
2. Apply migration 0044
3. Create paperclip-files MinIO bucket
4. `docker compose build media-worker && docker compose up -d`
5. Verify /health endpoints
6. Smoke test file upload

### Watch Out
- MinIO container name must match ALLOWED_STORAGE_HOST env var — confirm with `docker ps | grep minio`
- media-worker build takes 5-10 min (ffmpeg + LibreOffice layers)
- Server has `depends_on: media-worker: condition: service_healthy` — server won't start until media-worker passes health check

---
---

## Session Archive

### Session 1 — 2026-03-25: Multimodal Attachments Feature
**What we did:** Built complete file attachment system — DB schema, chunked upload API, media processing worker, UI components, agent vision integration. 9 tasks across backend, frontend, infra.
**Files:** attachments.ts, attachment-context.ts, attachment-resolver.ts, AttachmentCard.tsx, media-worker/, 0044_attachments.sql
**Decisions:** Chunked uploads for large files (2GB video cap). Separate media-worker container for ffmpeg/LibreOffice. Vision blocks for agent context with 10MB budget.

## Milestones
- [x] Multimodal attachments feature — schema, API, UI, agent vision, deploy runbook
- [ ] Production deployment — migration, MinIO bucket, smoke test

## Mistakes & Lessons

## Technical Debt & Future Ideas
- media-worker: audio transcription (Whisper), video trimming, batch image optimization

# Deployment: Multimodal Attachments Feature
Date: 2026-03-25
Branch: feature/multimodal-attachments
Server: 65.109.65.159 (Hetzner)

## Summary of Changes

This feature adds chunked file upload, media processing, and agent context injection for attachments.

### New service
- `media-worker` — Docker service on internal port 3200 (not exposed externally). Handles ffmpeg thumbnails, LibreOffice HTML conversion, and MinIO read/write.

### New DB table
- `attachments` — stores file metadata, versioning, processing status, and storage keys.

### New env vars required on server
| Variable | Value | Notes |
|---|---|---|
| `PAPERCLIP_MEDIA_WORKER_URL` | `http://paperclip-media-worker:3200` | Already wired in docker-compose.yml; must exist in server .env if overriding |
| `PAPERCLIP_ATTACHMENT_MAX_BYTES` | `104857600` | 100 MB default for non-video files |
| `PAPERCLIP_VIDEO_MAX_BYTES` | `2147483648` | 2 GB default for video |
| `ALLOWED_STORAGE_HOST` | `minio` | Media-worker SSRF guard — must match your MinIO container name |

### New MinIO bucket required
`paperclip-files` — must exist before the server starts receiving uploads.

---

## Pre-deployment Checklist

- [ ] Branch pushed to origin (done — `feature/multimodal-attachments`)
- [ ] All 28 commits present on remote (verify with `git log master..feature/multimodal-attachments --oneline`)
- [ ] Server `.env` backed up before editing
- [ ] MinIO instance reachable from within Docker network
- [ ] Disk space confirmed: media-worker image adds ffmpeg + LibreOffice (~1.5 GB uncompressed)
- [ ] Downtime window agreed: the `server` service restart causes ~30s unavailability

---

## Server Steps (SSH to 65.109.65.159)

### 0. Connect and navigate to project root
```bash
ssh root@65.109.65.159
cd /path/to/paperclip   # adjust to actual deploy path on server
```

### 1. Pull the feature branch
```bash
git fetch origin
git checkout feature/multimodal-attachments
git pull origin feature/multimodal-attachments
```

Verify the latest commit hash matches `f9854743`:
```bash
git log --oneline -1
# expected: f9854743 fix(server): agent vision — per-image 5MB cap, pdf-parse types fix, CSV routing guard, oversized image test
```

### 2. Add new env vars to .env
Open the server `.env` file and append (or update) the following lines:
```bash
# Multimodal attachments — added 2026-03-25
PAPERCLIP_MEDIA_WORKER_URL=http://paperclip-media-worker:3200
PAPERCLIP_ATTACHMENT_MAX_BYTES=104857600
PAPERCLIP_VIDEO_MAX_BYTES=2147483648
ALLOWED_STORAGE_HOST=minio
```

Note: `PAPERCLIP_MEDIA_WORKER_URL` is already hardcoded in `docker-compose.yml` for the `server` service.
Adding it to `.env` as well ensures any future override mechanism works correctly.

### 3. Run DB migration
The `attachments` table must be created before the server starts handling upload requests.
```bash
docker compose exec db psql -U paperclip -d paperclip < packages/db/src/migrations/0044_attachments.sql
```

Expected output — lines ending with `CREATE TABLE`, `ALTER TABLE`, `CREATE INDEX`. No errors.

To verify the table exists:
```bash
docker compose exec db psql -U paperclip -d paperclip -c "\d attachments"
```

### 4. Create MinIO bucket
```bash
# If mc (MinIO client) is available inside the minio container:
docker compose exec minio mc alias set local http://localhost:9000 $MINIO_ROOT_USER $MINIO_ROOT_PASSWORD
docker compose exec minio mc mb local/paperclip-files --ignore-existing
```

If mc is not in the minio container, use the mc binary on the host or the MinIO web console (port 9001 by default):
- Navigate to Buckets > Create Bucket
- Name: `paperclip-files`
- Leave versioning off unless you need it

Verify bucket exists:
```bash
docker compose exec minio mc ls local/
# should list paperclip-files
```

### 5. Build the media-worker image
This image includes ffmpeg and LibreOffice — expect the build to take 5-10 minutes.
```bash
docker compose build media-worker
```

If build fails due to apt package unavailability, check the Dockerfile at `docker/media-worker/Dockerfile`.

### 6. Start the media-worker service
```bash
docker compose up -d media-worker
```

Wait for health check to pass (up to 30s start_period):
```bash
docker compose ps media-worker
# STATUS should show: Up X seconds (healthy)
```

You can also tail logs:
```bash
docker compose logs -f media-worker
```

### 7. Restart server to pick up new env vars and new depends_on
The `server` service now declares `depends_on: media-worker: condition: service_healthy`.
A restart is sufficient since media-worker is already healthy.
```bash
docker compose restart server
```

### 8. Verify health endpoints
```bash
# media-worker health
curl -sf http://localhost:3200/health && echo "media-worker OK"

# main server health
curl -sf http://localhost:3100/api/health && echo "server OK"
```

Both must return 200. If `media-worker` health fails, check logs:
```bash
docker compose logs media-worker --tail 50
```

### 9. Smoke test — upload init
Replace `$API_KEY` and `$ISSUE_ID` with real values from your test company.
```bash
curl -X POST http://localhost:3100/api/attachments/init \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "issueId": "<test-issue-id>",
    "filename": "test.png",
    "mimeType": "image/png",
    "sizeBytes": 1024
  }'
```

Expected: HTTP 200 with `{ "attachmentId": "...", "uploadToken": "..." }`.

---

## Rollback Plan

If the deployment causes issues:

1. Stop the new service:
   ```bash
   docker compose stop media-worker
   ```

2. Revert the server to the previous branch:
   ```bash
   git checkout master
   docker compose restart server
   ```

3. The DB migration is additive (new table only) — no rollback needed for the schema.
   The `attachments` table can be left in place; it is not referenced by master-branch code.

4. The MinIO bucket can also be left empty — no impact on existing functionality.

---

## Commit Log (28 commits on this feature branch)

```
16152efd fix(media-worker): enforce maxBytes during stream in getObject, not just ContentLength header
cd1ff3ec fix(server): wire vision blocks to adapter, magic byte validation, prompt injection guard, parallel downloads, fix truncation check
615e5a9c fix(media-worker): security and quality fixes — validation, timeouts, size limits, dead code
059d5b14 fix(media-worker): 422 for unsupported MIME on /thumbnail and /convert, fix /convert workDir leak
14a90bd5 feat(server): inject attachments into agent run context — vision blocks, doc text, file notes
efe42b8a fix(media-worker): storage contract — storageKey input, MinIO read/write, correct response fields
39792a2f fix(ui): status type alignment, AbortController cleanup, chunk retry with orphan cleanup, a11y aria-labels
f018f807 feat(media-worker): add /extract endpoint, MinIO storage client, update deps
bccb4b1e fix(server): SSRF guard on media-worker URL in attachment-resolver
0dadc2e7 feat(ui): AttachmentCard component — inline images, video player, Office viewer, upload zone, MarkdownBody integration
3d2b575f fix(server): attachment-resolver — sizeBytes from buffer, user-token contract, isSafePath JSDoc
bd5f08d0 fix(server): fix isSafePath contract, symlink escape test, null byte guard, uploaderType from call sites
9e54f94f fix(server): attachment-resolver — symlink escape, per-token isolation, regex concurrency, stat-before-read, dollar-sign trap, tests
16127b3e fix(infra): stream files to disk, full workDir cleanup, SSRF guard, healthcheck, logging, expanded tests
02d4fc46 feat(server): [[attach:]] comment parser — resolves workspace paths to attachment records
2e86f6e5 feat(infra): media-worker Docker service — ffmpeg thumbnails + LibreOffice HTML conversion
76d0d7d2 feat(server): agent [[attach:]] syntax parser — auto-upload workspace files on comment save
9447d0a2 fix(server): chunk assembly, issueId ownership, agent companyId guard, chunk size cap, atomic complete, route conflicts, filename sanitization, DTO response
bf986126 fix(server): chunk assembly, status values, fire-and-forget worker, commentId linkage, HTTP status codes, test coverage
974cffbe feat(server): chunked upload API — init/chunk/complete/get/delete endpoints
95d6dd55 chore: remove duplicate test file attachments-routes.test.ts
aadab8d4 feat(server): chunked upload API endpoints for attachments (init/chunk/complete/url/list)
f0935f69 fix(server): safe env parsing, lowercase video check, wire MAX_VIDEO_BYTES to upload routes, update tests and docs
9999a160 feat(server): extend allowed attachment types to all media + Office + code, add video size limit helpers
31b935bd fix(db): apply all quality review recommendations to attachments schema
f84e6ab7 fix(db): remove unused agents import, explicit ON DELETE RESTRICT for company_id
1d17c001 feat(db): add attachments table with versioning and processing status
```

Total: 27 commits (plus one earlier chore commit = 28 tracked on branch).

---

## Known Gaps and Notes

### MinIO credentials
`docker-compose.yml` does not define a `minio` service — MinIO is assumed to be running as a
separate container or external service on this server. Confirm the container name matches
`ALLOWED_STORAGE_HOST=minio` and that it is on the `paperclip-internal` Docker network.

If MinIO runs under a different container name (e.g., `minio-server`), update `ALLOWED_STORAGE_HOST`
in `.env` accordingly.

### MINIO_ENDPOINT / MINIO_ACCESS_KEY env vars
The media-worker reads MinIO connection details from its own env vars. Check
`docker/media-worker/` source for the exact variable names and add them to `docker-compose.yml`
under the `media-worker` environment block, or pass via `.env`.

### DB connection user
The migration command above uses `-U paperclip -d paperclip`. Verify these match the actual
Postgres credentials on the server (they may differ from the dev defaults in `docker-compose.yml`).

### Port 3200 is internal only
`media-worker` uses `expose` not `ports` — it is NOT reachable from outside Docker.
The server communicates with it over the `paperclip-internal` network via
`http://paperclip-media-worker:3200`. No firewall changes needed.

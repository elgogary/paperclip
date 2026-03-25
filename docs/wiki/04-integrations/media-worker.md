# media-worker Integration

Thumbnail generation and Office document conversion service.

## What it does
- Extracts video frame thumbnails (ffmpeg) at 1s
- Resizes image thumbnails (sharp, 320px wide)
- Converts DOCX/XLSX/PPTX to HTML (LibreOffice headless)

## Endpoints
| Method | Path | Input | Output |
|--------|------|-------|--------|
| GET | /health | — | `{ status: "ok" }` |
| POST | /thumbnail | `{ storageUrl, mimeType, attachmentId }` | `{ thumbnailDataBase64 }` |
| POST | /convert | `{ storageUrl, mimeType }` | `{ htmlBase64 }` |

## Environment
| Var | Default | Description |
|-----|---------|-------------|
| PORT | 3200 | Listening port (internal only) |
| ALLOWED_STORAGE_HOST | — | Hostname allowed for storageUrl (SSRF guard) |

## Docker
```bash
docker compose build media-worker
docker compose up -d media-worker
curl http://localhost:3200/health
```

## Security
- SSRF guard on `storageUrl` — only `ALLOWED_STORAGE_HOST` is allowed
- Files streamed to disk before processing (no memory buffering of large files)
- `/tmp` work directories cleaned up recursively after each job

## Reuse potential
Future workloads: audio transcription (Whisper), video trimming, batch image optimization.

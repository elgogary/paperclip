# media-worker

Lightweight Docker service for processing media files. Used by Paperclip server for:
- **Video thumbnails** via ffmpeg (extract frame, resize to 320x180 JPEG)
- **Image thumbnails** via sharp (resize to 320px wide JPEG)
- **Office-to-HTML conversion** via LibreOffice headless (DOCX, XLSX, PPTX, etc.)

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check, returns `{ status, version }` |
| POST | `/thumbnail` | Generate thumbnail from file URL |
| POST | `/jobs/thumbnail` | Alias for `/thumbnail` (backward compat) |
| POST | `/convert` | Convert Office document to HTML |

### POST /thumbnail
```json
{
  "storageUrl": "http://server:3100/internal/file",
  "mimeType": "video/mp4",
  "attachmentId": "uuid"
}
// Response: { "thumbnailDataBase64": "base64...", "attachmentId": "uuid" }
```

### POST /convert
```json
{
  "storageUrl": "http://server:3100/internal/file",
  "mimeType": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
}
// Response: { "htmlBase64": "base64..." }
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3200` | HTTP listen port |

## Build & Run

```bash
# Build the image
docker build -t paperclip-media-worker ./docker/media-worker

# Run standalone
docker run -p 3200:3200 paperclip-media-worker

# Run via docker-compose (from project root)
docker compose up media-worker
```

## Test Locally

```bash
cd docker/media-worker
npm install
npx vitest run
```

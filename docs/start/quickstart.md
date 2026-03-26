---
title: Quickstart
summary: Deploy Sanad AI EOI with docker-compose in minutes
---

This guide deploys the full Sanad AI EOI stack: server, PostgreSQL, MinIO (S3 storage), and media worker.

## Prerequisites

- Docker + Docker Compose v2
- 4GB RAM minimum (8GB recommended)
- Port 3100 open or Tailscale for private access

## 1. Clone and Configure

```bash
git clone https://github.com/elgogary/sanad-ai-eoi.git sanad-ai-eoi
cd sanad-ai-eoi
git checkout feature/multimodal-attachments
cp .env.example .env
```

Edit `.env`:

```bash
# Required
BETTER_AUTH_SECRET=$(openssl rand -hex 32)
MINIO_SECRET_KEY=your-strong-password

# Your server's public IP or Tailscale IP
PAPERCLIP_PUBLIC_URL=http://100.109.59.30:3100

# Optional — connect to Sanad Brain for persistent agent memory
SANAD_BRAIN_URL=http://100.109.59.30:8100
SANAD_BRAIN_API_KEY=your-brain-api-key
```

## 2. Start the Stack

```bash
docker compose up -d
```

Services start in order: `db` → `minio` + `media-worker` → `server`.

Check status:
```bash
docker compose ps
```

All four services should show `healthy` or `running`.

## 3. Create the MinIO Bucket

On first run only:

```bash
docker run --rm --network paperclip_paperclip-internal \
  --entrypoint /bin/sh minio/mc:latest -c \
  "mc alias set local http://minio:9000 paperclip-minio YOUR_MINIO_SECRET_KEY && mc mb local/paperclip-files"
```

Replace `YOUR_MINIO_SECRET_KEY` with your `MINIO_SECRET_KEY` value.

## 4. Verify Health

```bash
curl http://localhost:3100/api/health
```

Expected:
```json
{"status":"ok","version":"0.3.1","deploymentMode":"authenticated","authReady":true}
```

## 5. Open the UI

Go to `http://localhost:3100` (or your server IP).

1. Sign up to create the first admin account
2. Create your first company (e.g., "Optiflow Systems")
3. Add agents under the company
4. Configure their adapters (claude_local, openclaw, etc.)

## Apply a New Migration

Migrations run automatically on startup. To apply manually after an update:

```bash
docker compose up -d server
docker logs sanad-ai-eoi-server-1 | grep -i migrat
```

## Update to Latest

```bash
git pull origin feature/multimodal-attachments
docker build --no-cache -t sanad-ai-eoi-server .
docker compose up -d server
```

## What's Next

<Card title="Connect Sanad Brain" href="/guides/board-operator/brain-architecture">Give your agents persistent memory</Card>
<Card title="Set Up Toolkit" href="/guides/board-operator/toolkit-capabilities">Add skills, MCP servers, scheduled jobs</Card>
<Card title="Multimodal Attachments" href="/guides/agent-developer/attachments">Upload files and give agents vision</Card>

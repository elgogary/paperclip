---
title: Sanad AI EOI Deployment
summary: Production deployment on Hetzner with Tailscale private access
---

This is the production deployment guide for Sanad AI EOI running the Optiflow AI Crew on a Hetzner VPS with Tailscale private networking.

## Server Specs

| Property | Value |
|----------|-------|
| Provider | Hetzner |
| OS | Ubuntu 22.04 |
| Tailscale IP | `100.109.59.30` |
| UI URL | `http://100.109.59.30:3100/OPT/` |
| Brain URL | `http://100.109.59.30:8100` |
| Project path | `/home/eslam/data/projects/paperclip/` |
| Workspace | `/home/eslam/optiflow/` |

## Stack

```
docker compose up -d
```

Services:
- `db` — PostgreSQL 16 on internal network
- `minio` — MinIO S3-compatible storage (`:9000` internal, `:9001` console)
- `media-worker` — `sanad-ai-eoi-media-worker` container (ffmpeg + LibreOffice)
- `server` — `sanad-ai-eoi-server:latest` image built from this repo

## Production `.env`

```bash
BETTER_AUTH_SECRET=ebeca1656a2424f97642ec68314eb7632cb9d55b292fe4e47a2752d84cd6b3c6
PAPERCLIP_PUBLIC_URL=http://100.109.59.30:3100
PAPERCLIP_DEPLOYMENT_MODE=authenticated
PAPERCLIP_DEPLOYMENT_EXPOSURE=private

# Sanad Brain
SANAD_BRAIN_URL=http://100.109.59.30:8100
SANAD_BRAIN_API_KEY=c246f4294bf4a99ccfb2883f68352a9889789076414b7cf93cbd3fb01f735d4e

# MinIO
MINIO_ACCESS_KEY=paperclip-minio
MINIO_SECRET_KEY=paperclip-minio-secret-2026
```

## Build & Deploy

When new commits are pushed to `feature/multimodal-attachments`:

```bash
cd /home/eslam/data/projects/paperclip
git pull origin feature/multimodal-attachments

# Build server image (takes ~3-5 min with cache)
docker build -t sanad-ai-eoi-server .

# Restart server only (db + minio + media-worker stay running)
docker compose up -d server
```

Full rebuild (clears Docker cache — use after major changes):

```bash
docker build --no-cache -t sanad-ai-eoi-server .
docker compose up -d server
```

## Volumes

| Volume | Mount | Purpose |
|--------|-------|---------|
| `pgdata` | `/var/lib/postgresql/data` | PostgreSQL data |
| `sanad-ai-eoi-data` | `/paperclip` | App config, DB backups |
| `minio-data` | `/data` | All uploaded files |
| `/home/eslam/optiflow` | `/workspace` (server) | Agent workspace |
| `/home/eslam/data/projects/sanad-brain-mcp` | mounted ro | Brain MCP server |

## MinIO Bucket Setup (First Deploy Only)

```bash
docker run --rm --network sanad-ai-eoi_sanad-ai-eoi-internal \
  --entrypoint /bin/sh minio/mc:latest -c \
  "mc alias set local http://minio:9000 paperclip-minio paperclip-minio-secret-2026 && \
   mc mb local/paperclip-files"
```

Verify bucket exists:
```bash
docker run --rm --network sanad-ai-eoi_sanad-ai-eoi-internal \
  --entrypoint /bin/sh minio/mc:latest -c \
  "mc alias set local http://minio:9000 paperclip-minio paperclip-minio-secret-2026 && \
   mc ls local"
```

## Apply Database Migration

Migrations run automatically on server startup. To check:

```bash
docker logs sanad-ai-eoi-server-1 2>&1 | grep -i migrat
```

Expected: `Migrations already applied` or `Applied N migrations`.

## Health Checks

```bash
# Server
curl http://100.109.59.30:3100/api/health

# Media worker (from inside Docker network)
docker exec sanad-ai-eoi-media-worker curl -f http://localhost:3200/health

# All container status
docker compose ps
```

## Tailscale Access

The server binds to `0.0.0.0:3100` — accessible on the Tailscale network at `100.109.59.30:3100`. Port 3100 is not exposed to the public internet.

To allow new team members:
1. Add them to the Tailscale network
2. Grant them access to the `100.109.59.30` node in Tailscale ACLs
3. Share the Optiflow URL: `http://100.109.59.30:3100/OPT/`

## Sanad Brain Connection

Sanad Brain runs as a separate Docker stack (`~/sanad-brain/docker-compose.yml`) on the same server.

The EOI server connects via `SANAD_BRAIN_URL=http://100.109.59.30:8100`. Both are on the host network, so this works without Docker networking.

To verify the Brain connection:
```bash
curl -H "X-Api-Key: c246f4294bf4a99ccfb2883f68352a9889789076414b7cf93cbd3fb01f735d4e" \
  http://100.109.59.30:8100/health
```

## Troubleshooting

**Server won't start — media-worker not healthy**
```bash
docker logs sanad-ai-eoi-media-worker --tail 20
# Verify: curl from inside container
docker exec sanad-ai-eoi-media-worker curl -f http://localhost:3200/health
```

**MinIO connection errors**
```bash
docker logs sanad-ai-eoi-server-1 | grep -i minio
# Check bucket exists
docker run --rm --network sanad-ai-eoi_sanad-ai-eoi-internal --entrypoint /bin/sh minio/mc:latest -c \
  "mc alias set l http://minio:9000 paperclip-minio paperclip-minio-secret-2026 && mc ls l"
```

**Build context too large (>2GB)**
```bash
# Always build from the project directory
cd /home/eslam/data/projects/paperclip
docker build -t sanad-ai-eoi-server .
```

**TypeScript errors during build**
Check the build output:
```bash
docker build -t sanad-ai-eoi-server . 2>&1 | grep "error TS"
```

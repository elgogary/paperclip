# Deployment Guide

## Production Server

| Item | Value |
|------|-------|
| **Server** | 65.109.65.159 (Hetzner) |
| **UI URL** | http://100.109.59.30:3100 (Tailscale) |
| **Branch** | `main-sanad-eoi-app` |
| **User** | `eslam` |
| **SSH** | `ssh eslam@65.109.65.159` |

## Docker Services

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| `db` | postgres:16-alpine | 5432 | PostgreSQL database |
| `server` | Local Dockerfile | 3100 | Node.js + Express + UI |
| `minio` | minio/minio | internal | S3 object storage |
| `media-worker` | docker/media-worker | internal | Image/Office conversion |

## Docker Volumes

| Volume | Purpose |
|--------|---------|
| `eslam_pgdata` | PostgreSQL data |
| `eslam_paperclip-data` | Paperclip instance data (skills, agents, logs) |
| `eslam_minio-data` | MinIO S3 data (attachments, assets) |

## Deploy Procedure

### MANDATORY: Pre-Deploy Backup

**ALWAYS run before any deploy. No exceptions.**

```bash
ssh eslam@65.109.65.159 "bash /home/eslam/docker-backups/pre-deploy-backup.sh"
```

This backs up:
1. PostgreSQL SQL dump (~7MB)
2. Infisical DB dump (~644K)
3. MinIO data volume
4. Paperclip app data volume (~55MB)

Retention: 5 SQL dumps + 3 full volume backups.

### Standard Deploy

```bash
# 1. Backup (MANDATORY)
ssh eslam@65.109.65.159 "bash /home/eslam/docker-backups/pre-deploy-backup.sh"

# 2. Pull latest code
ssh eslam@65.109.65.159 "git pull origin main-sanad-eoi-app"

# 3. Build and restart
ssh eslam@65.109.65.159 "docker compose build server media-worker && docker compose up -d --no-deps server media-worker"
```

### Fast UI-Only Deploy (no full rebuild)

If only UI files changed and pnpm/node is available on server:

```bash
# Build UI on server
ssh eslam@65.109.65.159 "npx pnpm install && npx pnpm --filter ui build"

# Copy built assets into running container
ssh eslam@65.109.65.159 "docker cp ui/dist/. eslam-server-1:/app/ui/dist/"

# Restart server (fast — no rebuild)
ssh eslam@65.109.65.159 "docker compose restart server"
```

### Pre-Deploy Verification

Run tests before deploying:

```bash
# Local (before push)
pnpm build
npx tsc -p server/tsconfig.json --noEmit
npx vitest run
./scripts/pre-deploy.sh  # 21 test groups, 272+ tests
```

## Backup System

### Backup Script Location
Server: `/home/eslam/docker-backups/pre-deploy-backup.sh`

### Backup Directory
Server: `/home/eslam/docker-backups/`

```
docker-backups/
├── pre-deploy-backup.sh          # The backup script
├── dump-volumes.sh               # Older volume dump script
├── paperclip-postgres-*.sql      # SQL dumps (keep 5)
├── infisical-postgres-*.sql      # Infisical dumps (keep 5)
└── full/
    ├── minio-data-*.tar.gz       # MinIO volume backups (keep 3)
    └── paperclip-app-*.tar.gz    # App data backups (keep 3)
```

### Restore From Backup

```bash
# Restore PostgreSQL
docker exec -i eslam-db-1 psql -U paperclip < paperclip-postgres-TIMESTAMP.sql

# Restore MinIO volume
docker run --rm -v eslam_minio-data:/data -v /home/eslam/docker-backups/full:/backup alpine \
  sh -c "cd /data && tar xzf /backup/minio-data-TIMESTAMP.tar.gz"

# Restore app data volume
docker run --rm -v eslam_paperclip-data:/data -v /home/eslam/docker-backups/full:/backup alpine \
  sh -c "cd /data && tar xzf /backup/paperclip-app-TIMESTAMP.tar.gz"
```

## Environment Variables

### Required
| Variable | Purpose |
|----------|---------|
| `BETTER_AUTH_SECRET` | Auth session encryption |
| `MINIO_SECRET_KEY` | MinIO access secret |
| `DATABASE_URL` | PostgreSQL connection string |

### Optional (Sanad Integration)
| Variable | Purpose |
|----------|---------|
| `SANAD_BRAIN_URL` | Brain API base URL |
| `SANAD_BRAIN_API_KEY` | Brain API key |
| `PAPERCLIP_PUBLIC_URL` | Public URL for callbacks |

## Mounted Volumes (Optiflow Workspace)

The server container mounts the Optiflow workspace:

```yaml
volumes:
  - /home/eslam/optiflow:/workspace
  - skills:/workspace/skills:ro
  - plugins:/workspace/plugins:ro
  - mcp-servers:/workspace/mcp-servers:ro
```

This gives agents access to:
- Agent configs in `/workspace/.agents/`
- Skills in `/workspace/skills/`
- MCP servers in `/workspace/mcp-servers/`

## Troubleshooting

### Container won't start
```bash
docker logs eslam-server-1 2>&1 | tail -20
```

### Database connection issues
```bash
docker exec eslam-db-1 pg_isready -U paperclip
```

### Check server health
```bash
curl http://100.109.59.30:3100/api/health
```

### Rebuild from scratch (CAUTION — backup first!)
```bash
docker compose down
docker compose build --no-cache server
docker compose up -d
```

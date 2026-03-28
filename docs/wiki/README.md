# Sanad AI EOI Platform Wiki

AI agent orchestration platform — manage teams of AI agents that work on tasks autonomously.
Fork of Paperclip with Sanad Brain integration, multimodal attachments, scheduled jobs, and capability swarm.

## Wiki Index

### 00 — Getting Started
- [Overview](00-getting-started/overview.md) — What this platform does, who it's for
- [Architecture](00-getting-started/architecture.md) — System design, data flow, module map
- [Development Setup](00-getting-started/development-setup.md) — Prerequisites, install, run

### 01 — Backend
- [File Reference Matrix](01-backend/file-reference-matrix.md) — Complete map of all 200+ files with purpose
- [Services Map](01-backend/services-map.md) — All 81 service files grouped by domain
- [Routes Map](01-backend/routes-map.md) — All REST API endpoints
- [Database Schema](01-backend/database-schema.md) — All 60+ tables with relationships
- [Adapters](01-backend/adapters.md) — 10 agent runtime adapters
- [Split Module Pattern](01-backend/split-module-pattern.md) — The $ bag factory pattern

### 02 — Frontend
- [Pages & Components](02-frontend/pages-map.md) — All UI pages, components, hooks
- [Routing](02-frontend/routing.md) — Company-prefix routing system

### 03 — Deployment & Operations
- [Deployment Guide](03-deployment/deployment-guide.md) — Docker, backups, server info
- [CLI Commands](03-deployment/cli-commands.md) — All CLI commands reference

### 04 — Integrations
- [media-worker](04-integrations/media-worker.md) — Thumbnail generation and Office document conversion

---

## Deployment & Operations (existing docs)
- [Deploy overview](../deploy/overview.md)
- [Docker setup](../deploy/docker.md)
- [Environment variables](../deploy/environment-variables.md)
- [Database](../deploy/database.md)
- [Storage](../deploy/storage.md)
- [Secrets](../deploy/secrets.md)
- [Local development](../deploy/local-development.md)
- [Deployment modes](../deploy/deployment-modes.md)
- [Tailscale private access](../deploy/tailscale-private-access.md)

## API Reference
- [API docs](../api/)

## Guides
- [User guides](../guides/)

---

## Features

### Multimodal Attachments (2026-03-25)
- **API docs**: `docs/api/attachments.md` — full REST reference
- **Backend**: `server/src/routes/attachments.ts`, `server/src/services/attachment-context.ts`
- **DB**: `packages/db/src/migrations/0044_attachments.sql`
- **Media processing**: `docker/media-worker/` — see [media-worker](04-integrations/media-worker.md)
- **UI**: `ui/src/components/attachments/`

### Scheduled Jobs (2026-03-24)
- **Backend**: `server/src/services/scheduler-loop.ts`, `server/src/services/scheduled-job-executors.ts`
- **UI**: `ui/src/pages/ScheduledJobs.tsx`, `ui/src/components/scheduled-jobs/`
- **API docs**: `docs/api/scheduled-jobs.md`
- **User guide**: `docs/guides/board-operator/scheduled-jobs.md`

### Ephemeral Agent Chat (2026-03-26)
- **Backend**: `server/src/routes/public-chat.ts` — token service + public API routes
- **UI**: `ui/src/pages/PublicChat.tsx` — standalone chat page
- **Flow**: Email watcher creates issue → generates signed token → sends link → customer chats without auth

### Agent Crew (9 Agents) (2026-03-26)
- **Configs**: `.agents/{ceo,tech-lead,backend-engineer,...}/`
- **Each agent has**: `SOUL.md`, `HEARTBEAT.md`, `SKILLS.md`, `LESSONS.md`
- **Shared**: `.agents/_common/` — capabilities, execution rules, knowledge index
- **Company Law**: `docs/company-law.md` — 7 Islamic principles governing all agents

### Email MCP + Watcher (2026-03-26)
- **MCP Server**: `tools/email-mcp/server.py` — 7 IMAP/SMTP tools for agents
- **Watcher**: `tools/email-mcp/watcher.py` — auto-ack → classify → create task → chat invite

### Capability Swarm (2026-03-27)
- **Backend**: `server/src/services/swarm.ts`, `server/src/routes/swarm.ts`
- **UI**: `ui/src/pages/Swarm.tsx`, `ui/src/components/swarm/`
- **Design doc**: `docs/plans/2026-03-26-capabilities-swarm-design.md`

## Project Status & Plans
- **Master status**: [STATUS.md](../STATUS.md)
- **All plans**: `docs/plans/` (14 files) + `optiflow/docs/plans/` (31 files)

---

**Stack**: Node.js, Express, TypeScript, React 19, PostgreSQL, Drizzle ORM
**Server**: 65.109.65.159:3100 (Hetzner, Docker Compose)
**Branch**: `main-sanad-eoi-app`

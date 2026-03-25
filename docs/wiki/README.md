# Paperclip Wiki

Project documentation index for Paperclip — the AI agent platform.

## Deployment & Operations
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

## Integrations
- [media-worker](04-integrations/media-worker.md) — thumbnail generation and Office document conversion

## Features

### Multimodal Attachments (2026-03-25)
- **API docs**: `docs/api/attachments.md` — full REST reference (init/chunk/complete/content/preview/thumbnail/delete)
- **Developer guide**: `docs/guides/agent-developer/attachments.md` — [[attach:]] syntax, vision injection, AttachmentCard, media-worker, DB schema
- **Backend**: `server/src/routes/attachments.ts`, `server/src/services/attachment-context.ts`, `server/src/services/attachment-resolver.ts`
- **DB**: `packages/db/src/migrations/0044_attachments.sql`
- **Media processing**: `docker/media-worker/` — see also [media-worker integration](04-integrations/media-worker.md)
- **UI**: `ui/src/components/attachments/`, `ui/src/api/attachments.ts`
- **Deploy**: `docs/deploy/2026-03-25-multimodal-attachments-deploy.md`

### Scheduled Jobs (2026-03-24)
- **Backend**: `server/src/services/scheduler-loop.ts`, `server/src/services/scheduled-job-executors.ts`
- **UI**: `ui/src/pages/ScheduledJobs.tsx`, `ui/src/components/scheduled-jobs/`
- **API docs**: `docs/api/scheduled-jobs.md`
- **User guide**: `docs/guides/board-operator/scheduled-jobs.md`

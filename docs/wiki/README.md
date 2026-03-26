# Sanad AI EOI Wiki

Project documentation index for Sanad AI EOI — the AI agent platform.

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

### Ephemeral Agent Chat (2026-03-26)
- **DB**: `packages/db/src/schema/chat-sessions.ts`, `packages/db/src/migrations/0046_chat_sessions.sql`
- **Backend**: `server/src/routes/public-chat.ts` — token service + public API routes
- **WebSocket**: Token-based auth for ephemeral sessions (no login required)
- **UI**: `ui/src/pages/PublicChat.tsx` — standalone chat page with countdown timer
- **Runtime**: `ui/src/components/chat/paperclip-runtime.ts` — assistant-ui adapter
- **Flow**: Email watcher creates issue → generates signed token → sends link → customer chats without auth

### Agent Crew (9 Agents) (2026-03-26)
- **Configs**: `.agents/{ceo,tech-lead,backend-engineer,frontend-engineer,product-manager,sales-manager,sales-rep,beta-tester,devops}/`
- **Each agent has**: `SOUL.md` (identity + ethics + rules), `HEARTBEAT.md` (operating cycle), `SKILLS.md` (capabilities), `LESSONS.md` (learnings)
- **Shared**: `.agents/_common/` — CAPABILITIES.md, EXECUTION-RULES.md, INFISICAL.md, PROJECT-KNOWLEDGE-INDEX.md, report-template.html
- **Company Law**: `docs/company-law.md` — 7 Islamic principles governing all agents

### Email MCP + Watcher (2026-03-26)
- **MCP Server**: `tools/email-mcp/server.py` — 7 IMAP/SMTP tools for agents
- **Watcher**: `tools/email-mcp/watcher.py` — auto-ack → AI classify → create task → chat invite → track
- **Modules**: `auto_reply.py`, `guardrails.py`, `mail_client.py`, `request_analyzer.py`, `task_builder.py`, `tracker.py`
- **Security**: Rate limiting, content blocking, file safety checks, SSRF guards

### Capability Swarm (2026-03-26) — DESIGN ONLY
- **Design doc**: `docs/plans/2026-03-26-capabilities-swarm-design.md` (561 lines)
- **Prototype**: `docs/prototypes/capabilities_swarm_prototype.html` (6 tabs + 3 dialogs)
- **Architecture**: 3 layers (Infrastructure → Brain Tools → Director Agent), 4 implementation phases

## Project Status & Plans
- **Master status**: [STATUS.md](../STATUS.md) — all features shipped vs not-done, 45 plan docs indexed
- **Master TODO (96 tasks)**: `optiflow/docs/plans/2026-03-23-master-todo-all-plans.md`
- **All plans**: `docs/plans/` (14 files) + `optiflow/docs/plans/` (31 files)

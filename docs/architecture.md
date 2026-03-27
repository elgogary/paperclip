# Paperclip Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────┐
│                    React UI (Vite)                       │
│  AgentDetail │ Issues │ Skills │ Dashboard │ Settings    │
└──────────────────────────┬──────────────────────────────┘
                           │ HTTP/WebSocket
┌──────────────────────────┴──────────────────────────────┐
│                  Express.js Server                       │
│                                                         │
│  Routes          Services           Adapters            │
│  ┌──────────┐   ┌──────────────┐   ┌────────────────┐  │
│  │ agents   │──▶│ heartbeat    │──▶│ claude_local   │  │
│  │ issues   │   │ skills       │   │ codex_local    │  │
│  │ access   │   │ portability  │   │ cursor         │  │
│  │ companies│   │ issues       │   │ openclaw       │  │
│  │ brain    │   │ workspace    │   │ http           │  │
│  └──────────┘   └──────────────┘   └────────────────┘  │
│        │               │                    │           │
│        ▼               ▼                    ▼           │
│  ┌──────────┐   ┌──────────────┐   ┌────────────────┐  │
│  │ Drizzle  │   │ Scheduler    │   │ Claude CLI     │  │
│  │ ORM      │   │ Loop (60s)   │   │ (on host)      │  │
│  └────┬─────┘   └──────┬───────┘   └────────────────┘  │
└───────┼─────────────────┼───────────────────────────────┘
        │                 │
        ▼                 ▼
┌──────────────┐  ┌───────────────┐  ┌──────────────────┐
│  PostgreSQL  │  │  Sanad Brain  │  │  MinIO (S3)      │
│  (Drizzle)   │  │  (RAG/Memory) │  │  (Attachments)   │
└──────────────┘  │  ├─ Qdrant    │  └──────────────────┘
                  │  ├─ LiteLLM   │
                  │  └─ Ollama    │
                  └───────────────┘
```

## Service Module Architecture (Post-Split)

### Heartbeat Service — Agent Run Lifecycle
```
heartbeat.ts (factory stub)
├── heartbeat-helpers.ts     ← Pure functions, types, constants
├── heartbeat-session.ts     ← Session compaction, task sessions
├── heartbeat-workspace.ts   ← Workspace resolution for runs
├── heartbeat-run-ops.ts     ← Run status, events, queue management
├── heartbeat-execution.ts   ← executeRun (main engine)
├── heartbeat-wakeup.ts      ← Wakeup queueing + issue promotion
└── heartbeat-cancellation.ts ← Cancel operations

Data flow: wakeup → enqueue → claim → execute → finalize → promote
```

### Company Portability — Package Import/Export
```
company-portability.ts (factory stub)
├── portability-yaml-render.ts  ← YAML serialization
├── portability-helpers.ts      ← File utils, env extraction
├── portability-skills.ts       ← Skill export mapping
├── portability-manifest.ts     ← Package file parsing
├── portability-export.ts       ← Export bundle builder
└── portability-import.ts       ← Import bundle executor

Data flow: files → manifest → preview → plan → import/export
```

### Route Architecture
```
app.ts
├── /api/companies/:companyId/agents  → agents.ts
│   ├── agent-config.ts      (config, instructions, skills)
│   ├── agent-heartbeats.ts  (wakeup, runs, logs)
│   └── agent-lifecycle.ts   (create, pause, delete, keys)
├── /api/companies/:companyId/issues  → issues.ts
│   ├── issue-comments.ts    (comments with mentions)
│   ├── issue-documents.ts   (docs + work products)
│   └── issue-attachments.ts (upload, stream, delete)
├── /api/access              → access.ts
│   ├── access-auth.ts       (CLI auth, board claim)
│   ├── access-invites.ts    (invite lifecycle)
│   ├── access-members.ts    (join, members, keys)
│   └── access-skills.ts     (marketplace)
├── /api/brain/*             → sanad-brain.ts (proxy)
└── /api/health              → health.ts
```

## Cross-Module Communication: $ Bag Pattern

Split factory services use a shared mutable context bag to avoid circular imports:

```
heartbeatService(db)
  │
  ├── $ = {}                        ← Create empty bag
  ├── $.getAgent = ...              ← Add simple closures
  │
  ├── Object.assign($, sessionOps)  ← Merge session functions into $
  ├── Object.assign($, workspaceOps)
  ├── Object.assign($, runOps)      ← runOps can call $.evaluateSessionCompaction
  ├── Object.assign($, executionOps) ← executionOps calls $.everything
  ├── Object.assign($, wakeupOps)   ← wakeupOps calls $.startNextQueuedRunForAgent
  ├── Object.assign($, cancellationOps)
  │
  ├── $.budgets = budgetService(db, $.budgetHooks)  ← Last (needs cancel hook)
  │
  └── return { public API using $ }
```

**Why this works**: Functions reference `$.otherFunction()` but are only called at runtime — by then all modules are initialized and `$` is fully populated.

## Database

PostgreSQL via Drizzle ORM. Key tables:
- `agents` — Agent definitions + adapter config
- `heartbeat_runs` — Run history with status, logs, usage
- `issues` — Tasks/issues with checkout locking
- `company_skills` — Installed skills per company
- `scheduled_jobs` — Brain sync jobs
- `workspace_runtime_services` — Runtime service registry

Migrations: `packages/db/src/migrations/`. Applied automatically on server start.

## Deployment

```bash
# Local dev
pnpm dev

# Docker (production)
docker compose build server
docker compose up -d

# Pre-deploy verification
./scripts/pre-deploy.sh    # 21 test groups, 272+ tests
```

Server: `65.109.65.159:3100` (Hetzner Docker)
Branch: `main-sanad-eoi-app`

# Paperclip — Sanad Fork

AI agent orchestration platform. This is our production fork (`main-sanad-eoi-app`) with Sanad Brain integration, multimodal attachments, scheduled jobs, and the file-splitting refactor.

## Stack

- **Server**: Node.js + Express + TypeScript, Drizzle ORM, PostgreSQL
- **UI**: React 19, Vite, TanStack Query, Tailwind CSS, shadcn/ui
- **CLI**: Commander.js, TypeScript
- **Packages**: `@paperclipai/db` (schema), `@paperclipai/shared` (types), `@paperclipai/adapter-utils`
- **Infra**: Docker Compose, MinIO (S3), Sanad Brain (RAG/memory), LiteLLM

## Commands

```bash
pnpm install                          # Install deps
pnpm dev                              # Start dev server (server + UI)
pnpm build                            # Build all packages
npx tsc -p server/tsconfig.json --noEmit  # Strict TS check (same as Docker)
npx vitest run                        # Run all tests
./scripts/pre-deploy.sh               # Pre-deploy verification (21 test groups, 272+ tests)
```

## Structure

```
server/src/
  services/                 # Business logic (split into modules)
    heartbeat.ts            # Agent run orchestrator (stub → 7 modules)
    heartbeat-helpers.ts    # Pure helpers, types, constants
    heartbeat-session.ts    # Session management
    heartbeat-workspace.ts  # Workspace resolution
    heartbeat-run-ops.ts    # Run lifecycle, queue, status
    heartbeat-execution.ts  # executeRun (single function)
    heartbeat-wakeup.ts     # Wakeup queueing + issue promotion
    heartbeat-cancellation.ts # Cancellation operations
    company-portability.ts  # Import/export (stub → 6 modules)
    portability-*.ts        # YAML render, helpers, skills, manifest, export, import
    company-skills.ts       # Skill service (stub → 3 helper modules)
    skill-inventory.ts      # Classification, naming, DB mapping
    skill-import-sources.ts # GitHub/URL/local import
    skill-resolution.ts     # Lookup, enrichment, path resolution
    issues.ts               # Issue service (stub → 3 modules)
    issue-comments.ts       # Comment operations
    issue-attachments.ts    # Attachment CRUD
    issue-checkout.ts       # Checkout/lock management
    workspace-runtime.ts    # Workspace runtime (stub → 2 modules)
    workspace-provision.ts  # Git worktree provision/cleanup
    runtime-services.ts     # Service lifecycle + shared Maps
  routes/                   # Express route handlers (split into sub-routers)
    access.ts               # Auth/invite/member routes (stub → 4 sub-routers)
    agents.ts               # Agent routes (stub → 3 sub-routers)
    issues.ts               # Issue routes (stub → 3 sub-routers)
    sanad-brain.ts          # Brain proxy routes
    scheduled-jobs.ts       # Scheduled job routes
  adapters/                 # Agent runtime adapters (claude_local, codex, etc.)
  __tests__/                # Test files
    pre-deploy-smoke.test.ts  # 33 wiring tests for all split modules
    heartbeat-wiring.test.ts  # 19 $ bag wiring tests

ui/src/
  pages/
    AgentDetail.tsx         # Agent detail (stub → 8 tab components)
    agent-detail/           # Tab components folder
  components/
    NewIssueDialog.tsx      # Issue dialog (stub → 5 helpers)
    new-issue/              # Extracted helpers folder

cli/src/commands/
  worktree.ts               # Worktree commands (stub → 3 modules)
  worktree-helpers.ts       # Shared utilities
  worktree-init.ts          # init + make commands
  worktree-cleanup.ts       # cleanup + env + list commands

packages/
  shared/src/               # Shared types + YAML parser + skill keys
  db/                       # Drizzle schema + migrations
```

## Architecture

### Split Module Pattern ($ bag)
Factory services use a shared mutable context bag `$` for cross-module references:
```typescript
const $ = {} as Record<string, any>;
Object.assign($, createSessionOps(db, $));
Object.assign($, createExecutionOps(db, $));
// Functions call $.otherFunction() — resolved at runtime
```

### Key Services
- **heartbeatService(db)** — Agent run lifecycle: wakeup → queue → execute → finalize
- **companyPortabilityService(db)** — Company package export/import (COMPANY.md format)
- **companySkillService(db)** — Skill management: import, scan, resolve, runtime entries
- **issueService(db)** — Task/issue CRUD + comments + attachments + checkout
- **Sanad Brain** — RAG memory/knowledge via `SANAD_BRAIN_URL` proxy

### Data Flow
```
UI → Express Routes → Service Factories → Drizzle ORM → PostgreSQL
                   → Adapters (claude_local) → Claude CLI → Agent Work
                   → Brain Proxy → Sanad Brain API → Qdrant/LiteLLM
```

## Conventions

- **File size**: Target <700 lines. Split using $ bag pattern for services, sub-routers for routes.
- **Imports**: Stubs re-export public API so existing import paths never break.
- **Tests**: `pre-deploy-smoke.test.ts` verifies all split module wiring. Run before every deploy.
- **Deploy**: `./scripts/pre-deploy.sh` then `docker compose build server && docker compose up -d server`

## Deployment

- **Server**: `65.109.65.159:3100` (Hetzner, Docker Compose)
- **Branch**: `main-sanad-eoi-app` (our production fork)
- **Brain**: Sanad Brain v0.9.0 running alongside
- **Backups**: `/home/eslam/docker-backups/` on Hetzner

## Key Context

- Fork of upstream Paperclip — we cherry-pick bug fixes, never force-push upstream
- Brain integration files: `sanad-brain.ts`, `scheduled-job-executors.ts`, `scheduler-loop.ts`
- Never touch Brain files during splits/refactors
- `plugins` table migration conflict — pre-existing, drop tables to fix

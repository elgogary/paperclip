# Paperclip Server

Express.js + TypeScript server for the Paperclip agent orchestration platform.

## Quick Start

```bash
pnpm install
pnpm -C server dev        # Start dev server
pnpm -C server build      # Build for production
```

## Module Map

After the 2026-03-26 file-splitting refactor, large service files were decomposed into focused modules. Each original file is now a thin stub that imports from sibling modules.

### Services (`src/services/`)

#### Heartbeat — Agent Run Lifecycle (8 files, was 3899 lines)
```
heartbeat.ts                 (305)  ← Factory stub, wires $ bag, returns public API
heartbeat-helpers.ts         (745)  ← Pure helpers, types, constants
heartbeat-session.ts         (377)  ← Session management (evaluate compaction, task sessions)
heartbeat-workspace.ts       (229)  ← Workspace resolution for runs
heartbeat-run-ops.ts         (645)  ← Run status, events, queue, finalize, reap orphans
heartbeat-execution.ts       (975)  ← executeRun — the main execution engine
heartbeat-wakeup.ts          (679)  ← Wakeup queueing + issue execution promotion
heartbeat-cancellation.ts    (216)  ← Cancel run/agent/budget-scope operations
```

#### Company Portability — Import/Export (7 files, was 4088 lines)
```
company-portability.ts       (203)  ← Factory stub + resolveSource (GitHub fetch)
portability-yaml-render.ts   (187)  ← YAML serialization (renderYamlBlock, buildMarkdown)
portability-helpers.ts       (700)  ← File utils, env extraction, slug generation, config
portability-skills.ts        (880)  ← Skill export dirs, sidebar sort, GitHub URL parsing
portability-manifest.ts      (911)  ← Manifest parsing + routine migration
portability-export.ts        (900)  ← exportBundle + previewExport
portability-import.ts        (1049) ← buildPreview + importBundle
```

#### Company Skills — Skill Management (4 files, was 2203 lines)
```
company-skills.ts            (1122) ← Factory with 23 closures (tightly coupled)
skill-inventory.ts           (278)  ← Classification, naming, DB row mappers
skill-import-sources.ts      (711)  ← GitHub/URL/local skill import readers
skill-resolution.ts          (283)  ← Skill lookup, enrichment, path resolution
```

#### Issues — Task Management (4 files, was 1727 lines)
```
issues.ts                    (1173) ← Factory with core CRUD + labels + mentions
issue-comments.ts            (139)  ← Comment operations (list, get, add)
issue-attachments.ts         (164)  ← Attachment CRUD
issue-checkout.ts            (293)  ← Checkout/lock management
```

#### Workspace Runtime (3 files, was 1564 lines)
```
workspace-runtime.ts         (116)  ← Stub with types + re-exports
workspace-provision.ts       (669)  ← Git worktree provision/cleanup
runtime-services.ts          (835)  ← Service lifecycle + shared Maps
```

### Routes (`src/routes/`)

#### Access Routes (6 files, was 2908 lines)
```
access.ts                    (38)   ← Stub mounting sub-routers
access-auth.ts               (316)  ← Board claim, CLI auth, admin promotion
access-invites.ts            (803)  ← Invite lifecycle
access-members.ts            (431)  ← Join requests, members, API keys
access-skills.ts             (46)   ← Skill marketplace endpoints
access-helpers.ts            (1556) ← Shared utilities (tokens, hashing, onboarding)
```

#### Agent Routes (5 files, was 2324 lines)
```
agents.ts                    (298)  ← Stub with list/detail/org-chart
agent-helpers.ts             (670)  ← Shared context, auth checks
agent-config.ts              (725)  ← Config CRUD, revisions, instructions
agent-heartbeats.ts          (375)  ← Wakeup, runs, events, logs
agent-lifecycle.ts           (437)  ← Create, pause, resume, terminate, API keys
```

#### Issue Routes (5 files, was 1636 lines)
```
issues.ts                    (828)  ← Core CRUD, checkout, labels, approvals
issue-route-context.ts       (143)  ← Shared services factory
issue-comments.ts            (314)  ← Comment operations with reopen/wakeup
issue-documents.ts           (265)  ← Documents + work products
issue-attachments.ts         (217)  ← Upload, stream, delete
```

## Split Pattern: $ Bag

Factory services use a shared mutable context object for cross-module references:

```typescript
export function heartbeatService(db: Db) {
  const $: Record<string, any> = {};

  // Simple closures stay inline
  $.getAgent = async (id) => db.select()...;

  // Each module populates $
  Object.assign($, createSessionOps(db, $));
  Object.assign($, createExecutionOps(db, $));
  // ...

  // Functions call $.otherFunction() at runtime
  return { list, getRun, wakeup: $.enqueueWakeup, ... };
}
```

## Testing

```bash
# Pre-deploy (21 groups, 272+ tests)
./scripts/pre-deploy.sh

# Individual module tests
npx vitest run server/src/__tests__/pre-deploy-smoke.test.ts    # 33 wiring tests
npx vitest run server/src/__tests__/heartbeat-wiring.test.ts    # 19 $ bag tests
npx vitest run server/src/__tests__/company-portability.test.ts # 27 portability tests
npx vitest run server/src/__tests__/company-skills.test.ts      # 12 skills tests
npx vitest run server/src/__tests__/workspace-runtime.test.ts   # 13 workspace tests
```

## Brain Integration

Sanad Brain provides RAG memory and knowledge sync:

```
SANAD_BRAIN_URL=http://sanad-brain:8000
SANAD_BRAIN_API_KEY=<key>
```

Routes: `sanad-brain.ts` proxies all `/api/brain/*` to Brain API.
Executors: `scheduled-job-executors.ts` runs knowledge_sync, dream, memory_ingest.

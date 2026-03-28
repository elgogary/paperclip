# Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENTS                               │
│  React UI (Vite)  │  CLI (Commander.js)  │  Public Chat     │
└────────┬──────────┴──────────┬───────────┴────────┬─────────┘
         │                     │                     │
         ▼                     ▼                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    EXPRESS SERVER (:3100)                     │
│                                                              │
│  Middleware: JSON → Logger → SSRF Guard → Actor Resolution   │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │
│  │ Routes   │  │ Services │  │ Adapters │  │ Scheduler  │  │
│  │ (47 files│  │ (81 files│  │ (10 types│  │ (60s loop) │  │
│  │  13K LOC)│  │  28K LOC)│  │  )       │  │            │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────┬─────┘  │
│       │              │             │                │        │
│       ▼              ▼             ▼                ▼        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Drizzle ORM + PostgreSQL                 │   │
│  │              60+ tables, 46+ migrations               │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
         │                     │                     │
         ▼                     ▼                     ▼
┌──────────────┐  ┌──────────────────┐  ┌─────────────────┐
│   MinIO S3   │  │   Sanad Brain    │  │  Agent CLIs     │
│  (attachments│  │  (RAG/memory/    │  │  (Claude, Codex │
│   assets)    │  │   knowledge)     │  │   Cursor, etc.) │
└──────────────┘  └──────────────────┘  └─────────────────┘
```

## Data Flow

### Agent Execution Flow
```
Wakeup Request → Queue → Claim → Resolve Workspace → Execute Adapter
                                                          │
                                    ┌─────────────────────┤
                                    ▼                     ▼
                              Stream Logs            Stream Costs
                              (SSE events)           (token usage)
                                    │                     │
                                    ▼                     ▼
                              Finalize Run → Update Issue Status
```

### Request Flow
```
HTTP Request → Actor Middleware (who is this?)
            → Board Mutation Guard (read-only check)
            → Route Handler (validate + delegate)
            → Service Factory (business logic)
            → Drizzle ORM (DB query)
            → JSON Response
```

## Module Map

### Server Services (grouped by domain)

| Domain | Files | Lines | Key Service |
|--------|-------|-------|-------------|
| **Heartbeat** (agent runs) | 9 | ~3,500 | `heartbeatService(db)` |
| **Portability** (import/export) | 8 | ~4,000 | `companyPortabilityService(db)` |
| **Skills** | 12 | ~3,400 | `companySkillService(db)` |
| **Issues** | 7 | ~2,000 | `issueService(db)` |
| **Workspace** | 6 | ~2,300 | `workspace-runtime.ts` (stub) |
| **Routines** | 1 | 1,268 | `routineService(db)` |
| **Budgets/Costs** | 4 | ~1,500 | `budgetService(db)`, `costService(db)` |
| **Agents** | 5 | ~1,800 | `agentService(db)` |
| **Access/Auth** | 5 | ~1,000 | `accessService(db)`, `boardAuthService(db)` |
| **Scheduler** | 3 | ~600 | `schedulerLoop`, `executors` |
| **Swarm** | 1 | 300 | `swarmService(db)` |
| **Other** | 20 | ~3,500 | Attachments, approvals, secrets, etc. |
| **Total** | **81** | **~28K** | |

### Server Routes

| Domain | Files | Endpoints |
|--------|-------|-----------|
| **Access/Auth** | 5 | ~20 |
| **Agents** | 6 | ~25 |
| **Issues** | 5 | ~20 |
| **Companies** | 2 | ~15 |
| **Skills** | 3 | ~15 |
| **Routines/Jobs** | 2 | ~15 |
| **Other** | 24 | ~40 |
| **Total** | **47** | **~150** |

### UI Pages

| Area | Pages | Key pages |
|------|-------|-----------|
| **Dashboard** | 1 | Dashboard with 4 charts |
| **Agents** | 3 | List, Detail (7 tabs), New |
| **Issues** | 2 | List (kanban+table), Detail |
| **Projects** | 1 | Detail (7 tabs) |
| **Skills** | 2 | Split panel, Company skills |
| **Brain** | 1 | 7 tabs (Live, Memories, Knowledge, Graph, Health, Audit, Monitoring) |
| **Swarm** | 1 | 5 tabs (Catalog, My Swarm, Sources, Queue, Audit) |
| **Finance** | 2 | Costs (5 tabs), Approvals |
| **Ops** | 3 | Scheduled Jobs, Routines, Toolkit |
| **Other** | 10+ | Chat, Inbox, Settings, Auth, etc. |

## Database Entity Relationships

```
Company (tenant root)
├── Agents (workers)
│   ├── Agent Runtime State
│   ├── Agent Task Sessions
│   ├── Agent Config Revisions
│   ├── Agent API Keys
│   └── Wakeup Requests → Heartbeat Runs
├── Projects
│   ├── Project Workspaces (git repos)
│   └── Execution Workspaces (ephemeral)
├── Issues (tasks)
│   ├── Comments
│   ├── Attachments → Assets (S3)
│   ├── Documents → Revisions
│   ├── Work Products
│   ├── Labels
│   └── Approvals
├── Goals (hierarchy: company → team → agent → task)
├── Skills (company_skills + skills)
├── Routines → Triggers → Runs
├── Scheduled Jobs → Job Runs
├── Budget Policies → Incidents
├── Cost Events → Finance Events
├── Swarm Sources → Capabilities → Installs
├── MCP Servers, Connectors, Plugins
├── Secrets
└── Activity Log
```

## Key Patterns

### 1. Split Module Pattern ($ bag)
Large services split into sibling files sharing a mutable context object:
```typescript
const $ = {} as Record<string, any>;
Object.assign($, createSessionOps(db, $));    // heartbeat-session.ts
Object.assign($, createExecutionOps(db, $));  // heartbeat-execution.ts
// Functions call $.otherFunction() — resolved at runtime
```
Original file becomes thin stub re-exporting the public API.

### 2. Company-Prefix Routing (UI)
Every board page lives under `/:companyPrefix/`. Custom router wrappers in `lib/router.tsx` inject the prefix transparently. Adding a new page requires BOTH a Route in App.tsx AND adding to `BOARD_ROUTE_ROOTS`.

### 3. Service Factory Pattern
All services are factory functions that receive `db` (Drizzle instance):
```typescript
export function issueService(db: Database) {
  return { create, update, list, ... };
}
```

### 4. Adapter Registry
10 agent adapters registered in `server/src/adapters/registry.ts`. Each implements `ServerAdapterModule`: `execute()`, `testEnvironment()`, optional `listSkills()`, `syncSkills()`, `getQuotaWindows()`.

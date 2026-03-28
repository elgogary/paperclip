# Sanad AI — Architecture

> Full system architecture. If you lose direction, read this first.
> See also: `roadmap.md` (what's built, what's next), `knowledge-base.md` (all decisions)

---

## The Vision (One Sentence)

**Sanad AI is not another ERP. It is the intelligent operating layer that sits on top of ERPs.**

Every person in the organization gets a **Twin Agent** that thinks with them, captures voice, routes work to the correct ERP automatically, and never loses a thought.

> The ERP is infrastructure. Sanad is the operating layer on top.

---

## System Layers

```
┌──────────────────────────────────────────────────────────────────┐
│                        HUMANS (Board)                            │
│          Approve strategy · Review agents · Set budgets          │
└──────────────────────┬───────────────────────────────────────────┘
                       │
┌──────────────────────▼───────────────────────────────────────────┐
│                  SANAD EOI PLATFORM (Paperclip Fork)             │
│                                                                  │
│  ┌────────────┐  ┌──────────────┐  ┌──────────┐  ┌──────────┐  │
│  │ React UI   │  │ Express API  │  │ Scheduler│  │ Brain    │  │
│  │ (port 3100)│  │ (REST + SSE) │  │ (60s)    │  │ Proxy    │  │
│  └────────────┘  └──────┬───────┘  └──────────┘  └──────────┘  │
│                         │                                        │
│  ┌──────────────────────▼────────────────────────────────────┐  │
│  │           PostgreSQL — Drizzle ORM (76 tables)            │  │
│  │   agents · runs · issues · skills · swarm · costs · ...   │  │
│  └───────────────────────────────────────────────────────────┘  │
└──────────────────────┬───────────────────────────────────────────┘
                       │ adapters
┌──────────────────────▼───────────────────────────────────────────┐
│                       AGENT CREW                                 │
│                                                                  │
│  CEO → TechLead → BackendEng / FrontendEng                      │
│      → SalesManager → SalesRep                                   │
│      → ProductManager → BetaTester                               │
│      → DevOps                                                    │
│                                                                  │
│  Each agent: Claude Code / Codex / Cursor / HTTP                 │
└──────────────────────┬───────────────────────────────────────────┘
                       │ MCP (agents propose, humans approve)
┌──────────────────────▼───────────────────────────────────────────┐
│                      ERP LAYER                                   │
│  ERPNext (AccuBuild) · Odoo (planned) · SAP (Phase 6)           │
│                                                                  │
│  Rule: Agents NEVER touch ERP directly.                         │
│        Every ERP action goes through Sanad MCP. Always.         │
└──────────────────────────────────────────────────────────────────┘
```

---

## Platform Architecture (Sanad EOI = Paperclip Fork)

```
                    ┌─── Board UI (React 19) ───┐
                    │  Tasks · Agents · Costs   │
                    │  Swarm · Brain · Jobs     │
                    └──────────┬────────────────┘
                               │ REST / SSE
                    ┌──────────▼────────────────┐
                    │   Express Server (Node 24) │
                    │                            │
                    │  Routes (48 files)         │
                    │  Services (89 files)       │
                    │  Scheduler (60s loop)      │
                    │  Sanad Brain Proxy         │
                    └──────┬───────────┬─────────┘
                           │           │
             ┌─────────────▼──┐  ┌────▼─────────────┐
             │  PostgreSQL    │  │   Sanad Brain     │
             │  76 tables     │  │  (Qdrant + LLM)   │
             │  Drizzle ORM   │  │  RAG memory       │
             └────────────────┘  └──────────────────┘
                           │
             ┌─────────────▼──────────────┐
             │    Agent Adapters          │
             │  claude_local · codex      │
             │  cursor · http · process   │
             └────────────────────────────┘
                           │
             ┌─────────────▼──────────────┐
             │     MinIO (S3)             │
             │  attachments · assets      │
             └────────────────────────────┘
```

---

## Infrastructure (Hetzner)

```
Cloudflare DNS (3 zones)
  sanadai.com           → HETZNER_IP (proxy ON — WAF + DDoS)
  *.sanadai.com         → HETZNER_IP (proxy ON)
  *.dev.sanadai.com     → HETZNER_IP (proxy OFF — Traefik handles SSL)
  *.sandbox.sanadai.com → HETZNER_IP (proxy OFF — Traefik handles SSL)

Hetzner Server (16GB RAM)
  Docker Compose stack:
  ┌─────────────────────────────────────────┐
  │  Traefik v3        → reverse proxy      │
  │  Sanad EOI server  → port 3100          │
  │  PostgreSQL        → DB                 │
  │  MinIO             → S3 storage         │
  │  Sanad Brain       → RAG/memory         │
  │  media-worker      → LibreOffice/ffmpeg │
  │  Portainer         → Docker management  │
  │  Prometheus        → metrics            │
  │  Grafana           → dashboards         │
  └─────────────────────────────────────────┘
```

---

## Data Flow

### Agent Execution Flow
```
Human creates Issue
    → Assigns to Agent
    → Wakeup Request queued
    → Heartbeat picks up (60s loop)
    → Resolve workspace (git worktree or cwd)
    → Execute Adapter (Claude/Codex/Cursor)
    → Stream output to SSE (live in UI)
    → Stream cost events (token usage)
    → Finalize run → Update issue status
    → Append to activity log
```

### MCP (Agent → ERP) Flow
```
Agent proposes ERP change
    → Sanad MCP receives proposal
    → Checker Agent reviews
    → Human approves in Sanad UI
    → MCP pushes diff to ERPNext
    → Confirmation back to agent
    → Never bypasses this chain
```

### Knowledge / Memory Flow
```
Agent run completes
    → Run summary → memory_ingest queue
    → Scheduler picks up → Sanad Brain API
    → Embedded into Qdrant
    → Future agents recall via /brain/recall
    → Knowledge sync job indexes project wikis
    → Dream job consolidates nightly
```

---

## Multi-Company Model

```
One Sanad Instance
├── Accurate Systems (holding, CEO cross-view)
├── AccuBuild (construction ERP → ERPNext live)
├── Sales Force App (sales domain)
└── (future companies)

Each company has:
  - Its own agents, issues, projects, budgets
  - Its own ERP connector (MCP)
  - Its own data scope (row-level isolation)
  - Shared Sanad Brain (RAG) with company namespace
```

---

## Key Design Principles

| # | Principle |
|---|---|
| 1 | **ERP is infrastructure, Sanad is the operating layer** |
| 2 | **Agents propose. Humans approve. Always.** |
| 3 | **Nothing touches production until it passes the full chain** (Maker → Checker → Human → MCP) |
| 4 | **Agents never build the safety layer** — permissions are built by humans first |
| 5 | **Never locked to one model** — LLM Router abstracts all models |
| 6 | **Additive-only DB migrations** — never drop/modify columns |
| 7 | **Masked data for all non-production** — no PII leaves production |
| 8 | **On-premise first** — all services run on Hetzner |
| 9 | **Sandbox isolation** — each agent task gets its own microVM |
| 10 | **Two languages only**: TypeScript (frontend/API) + Python (agents/AI) |
| 11 | **Each phase ships something usable** |
| 12 | **SRS documents are agent task specifications** |
| 13 | **Monitoring (passive) ≠ Evaluation (active). Never mix them.** |

---

## Module Map

### Server Services (grouped by domain)

| Domain | Files | Key Service |
|---|---|---|
| Heartbeat (agent runs) | 9 | `heartbeatService(db)` |
| Portability (import/export) | 8 | `companyPortabilityService(db)` |
| Skills | 13 | `companySkillService(db)` |
| Issues | 7 | `issueService(db)` |
| Workspace | 7 | `workspace-runtime.ts` |
| Scheduled Jobs | 3 | `schedulerLoop`, `executors` |
| Swarm | 1 | `swarmService(db)` |
| Budgets/Costs/Finance | 5 | `budgetService`, `costService`, `financeService` |
| Agents | 8 | `agentService(db)` |
| Access/Auth | 5 | `accessService(db)`, `boardAuthService(db)` |
| Attachments | 3 | `attachmentContext`, `attachmentResolver` |
| Plugins/MCP/Connectors | 3 | `pluginsService`, `mcpServersService` |
| Core (approvals, goals, projects, etc.) | 17 | Various |
| **Total** | **89** | |

### Database (76 tables)

| Domain | Tables |
|---|---|
| Core entities | companies, agents, projects, issues, goals |
| Run lifecycle | heartbeat_runs, run_events, runtime_state, wakeup_requests, task_sessions |
| Access & auth | memberships, api_keys, invites, cli_auth_challenges, permission_grants |
| Skills | skills, company_skills, skill_versions, evolution_events, skill_metrics |
| Finance | approvals, budget_policies, cost_events, finance_events |
| Plugins/MCP | plugins, mcp_server_configs, connectors + junction tables |
| Capability Swarm | swarm_sources, swarm_capabilities, swarm_installs, swarm_audit_log |
| Workspace | execution_workspaces, project_workspaces, workspace_operations |
| Content | documents, attachments, issue_comments, activity_log, scheduled_jobs |

---

## Diagrams in This Folder

| File | What it shows |
|---|---|
| `sanad-bigpicture-v2.html` | Full system big picture — open in browser |
| `sanad-sequence-v2.html` | Sequence diagrams — agent flows, MCP flows |
| `sanad-complete-v2.drawio` | Full draw.io diagram — open in draw.io |

---

## Related Docs

- [Roadmap](roadmap.md) — what's built, what's next, phase sequence
- [knowledge-base.md](knowledge-base.md) — all architectural decisions
- [File Reference Matrix](../01-backend/file-reference-matrix.md) — every file mapped
- [Database Schema](../01-backend/database-schema.md) — all 76 tables

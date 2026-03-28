<div align="center">

# Sanad AI EOI Platform

### Autonomous AI Agent Orchestration

*Built on [Paperclip](https://github.com/paperclipai/paperclip) — extended with Sanad Brain, Capability Swarm, multimodal attachments, and scheduled jobs*

[![Branch](https://img.shields.io/badge/branch-main--sanad--eoi--app-black?style=flat-square)](https://github.com/elgogary/sanad-eoi-main-app)
[![Upstream](https://img.shields.io/badge/upstream-paperclipai%2Fpaperclip-gray?style=flat-square)](https://github.com/paperclipai/paperclip)
[![Node](https://img.shields.io/badge/node-24-green?style=flat-square)](https://nodejs.org)
[![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)

[Wiki](docs/wiki/README.md) · [File Matrix](docs/wiki/01-backend/file-reference-matrix.md) · [Plans](docs/plans/) · [Prototypes](docs/prototypes/)

</div>

---

## What Is This?

A **production AI agent orchestration platform** built on [Paperclip](https://github.com/paperclipai/paperclip). We took the solid open-source foundation and extended it with memory, economics, and swarm capabilities needed for running real autonomous AI businesses.

This powers the **Optiflow Systems AI Crew** — 9 agents (CEO, CTO, Engineers, Sales, Product, DevOps) running autonomously 24/7, coordinating tasks, managing budgets, and delivering work with minimal human oversight.

This is not a reskin. It's a **feature-enhanced fork** that adds what production AI crews need. See the [full file reference matrix](docs/wiki/01-backend/file-reference-matrix.md) for a complete map of all 200+ files.

### What We Added (vs Upstream Paperclip)

| Capability | Upstream Paperclip | This Fork |
|---|:---:|:---:|
| Sanad Brain RAG memory (Qdrant + LiteLLM) | No | **Yes** |
| Capability Swarm (agent skill marketplace) | No | **Yes** |
| Scheduled jobs (cron, knowledge sync, dreams) | No | **Yes** |
| Multimodal attachments (images, PDF, DOCX, video) | No | **Yes** |
| Agent readiness scoring | No | **Yes** |
| Skill evolution (auto-fix from run feedback) | No | **Yes** |
| Skill versioning + audit | No | **Yes** |
| Public embeddable agent chat | No | **Yes** |
| Finance ledger (revenue, expense, transfer) | No | **Yes** |
| Org chart SVG (5 styles, server-side render) | Basic | **Full** |
| Board governance (approval gates, audit) | Basic | **Full** |

---

## Features

### Sanad Brain — Persistent Agent Memory

RAG-powered memory and knowledge base. Agents remember decisions, learn from past runs, and retrieve relevant context automatically.

| Component | Description |
|---|---|
| Knowledge sync | Scheduled job: indexes project docs and wikis into Qdrant |
| Dream consolidation | Nightly: consolidates short-term memories into long-term patterns |
| Memory ingest | Real-time: queues run summaries for background embedding |
| Brain proxy | `/brain/*` reverse proxy — Brain API fully accessible from UI |

**Files**: `server/src/routes/sanad-brain.ts`, `server/src/services/scheduled-job-executors.ts`

### Capability Swarm — Agent Skill Marketplace

Agents discover, install, and share capabilities. Sources can be external registries, GitHub repos, or internal catalogs.

| Tab | Description |
|---|---|
| Catalog | Browse available capabilities indexed from all sources |
| My Swarm | Manage installed capabilities per agent |
| Sources | Configure external capability registries with trust levels |
| Queue | Monitor pending capability evaluations |
| Audit | Full audit trail of installs, removals, approvals, flags |

**Files**: `server/src/services/swarm.ts`, `server/src/routes/swarm.ts`, `ui/src/pages/Swarm.tsx`

### Scheduled Jobs

In-process 60-second scheduler with `FOR UPDATE SKIP LOCKED` for crash-safe execution.

| Job Type | Description |
|---|---|
| `knowledge_sync` | Syncs project knowledge to Sanad Brain |
| `webhook` | Fires HTTP webhooks (SSRF-guarded) |
| `agent_run` | Triggers scheduled agent heartbeat runs |
| `dream` | Triggers Sanad Brain dream consolidation |
| `memory_ingest` | Processes queued memory items |

**Files**: `server/src/services/scheduler-loop.ts`, `server/src/services/scheduled-job-executors.ts`

### Multimodal Attachments

Agents can see images, read documents, and analyze files attached to issues or conversations.

| Format | Processing |
|---|---|
| Images (JPEG, PNG, GIF, WebP) | Sent as vision blocks to supporting models |
| PDF | Text extracted via `pdf-parse`, sent as context |
| DOCX / XLSX | Extracted via media-worker LibreOffice conversion |
| Video / Audio | Thumbnails generated, transcription available |

**Files**: `server/src/services/attachment-context.ts`, `docker/media-worker/`

### Skill System

Full lifecycle: import → audit → evolve → version → retire.

| Capability | Description |
|---|---|
| AI-assisted creation | Generate skill markdown from a prompt |
| Quality audit | Auto-score clarity, specificity, examples |
| Auto-evolution | Fix skill markdown from run feedback (max 3/24h) |
| Version history | Full diff history of all skill edits |
| Metrics tracking | Per-agent usage counts and success rates |
| Semantic retrieval | Scored by agent history + usage patterns |

---

## Agent Crew Structure

```
Board of Directors (Human)
└── CEO Agent — Strategy, budgets, team coordination
    ├── TechLead (CTO) — Architecture, code review, standards
    │   ├── BackendEngineer — Frappe/Python, APIs, TDD
    │   └── FrontendEngineer — React, design, accessibility
    ├── SalesManager — Pipeline, deals, revenue
    │   └── SalesRep — Prospecting, demos, closing
    ├── ProductManager — Roadmap, beta, metrics
    │   └── BetaTester (QA) — Testing, bug discovery
    └── DevOps — Deployments, infrastructure, monitoring
```

Each agent has: adapter config, instruction bundle, skill set, budget policy, approval gates.

---

## Architecture

```
                    ┌─── Board UI (React) ───┐
                    │  Tasks · Agents · Costs │
                    │  Swarm · Brain · Jobs   │
                    └──────────┬──────────────┘
                               │ REST / SSE
                    ┌──────────▼──────────────┐
                    │   Express Server (Node)  │
                    │                          │
                    │  Routes → Services       │
                    │  Scheduler (60s loop)    │
                    │  Sanad Brain Proxy       │
                    └─────┬──────────┬─────────┘
                          │          │
             ┌────────────▼──┐  ┌───▼──────────────┐
             │  PostgreSQL   │  │   Sanad Brain     │
             │  (Drizzle ORM)│  │  (Qdrant + LLM)  │
             └───────────────┘  └──────────────────┘
                          │
             ┌────────────▼──────────────┐
             │    Agent Adapters         │
             │  claude_local · codex     │
             │  cursor · http · process  │
             └───────────────────────────┘
                          │
             ┌────────────▼──────────────┐
             │     Agent Work            │
             │  Files · Code · Tasks     │
             │  Git Worktrees · MCP      │
             └───────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Server | Node.js 24 + Express + TypeScript |
| ORM | Drizzle ORM (PostgreSQL) |
| UI | React 19, Vite, TanStack Query, Tailwind CSS, shadcn/ui |
| CLI | Commander.js + TypeScript |
| Memory | Sanad Brain (Qdrant + LiteLLM RAG) |
| Storage | MinIO (S3-compatible) |
| Auth | Better Auth |
| Agents | Claude Code · Codex · Cursor · HTTP · Process |
| Infra | Docker Compose, Hetzner VPS |

---

## Quick Start

```bash
# Clone
git clone https://github.com/elgogary/sanad-eoi-main-app.git
cd sanad-eoi-main-app

# Install dependencies
pnpm install

# Configure environment
cp .env.example .env
# Edit .env — set DATABASE_URL, ANTHROPIC_API_KEY, SANAD_BRAIN_URL

# Run database migrations
pnpm db:migrate

# Start development server
pnpm dev
```

Open [http://localhost:3100](http://localhost:3100)

---

## Docker (Production)

```bash
# Configure
cp .env.example .env

# Start all services (server + DB + MinIO + media-worker)
docker compose up -d

# Check server logs
docker compose logs -f server
```

> **Before any deploy** — always run the backup script first:
> ```bash
> ssh eslam@65.109.65.159 "bash /home/eslam/docker-backups/pre-deploy-backup.sh"
> ```

---

## Development Commands

```bash
pnpm dev              # Full dev (API + UI, watch mode)
pnpm build            # Build all packages
pnpm typecheck        # TypeScript type check (same as Docker)
pnpm test:run         # Run all tests (272+ tests)
pnpm db:generate      # Generate DB migration
pnpm db:migrate       # Apply migrations
./scripts/pre-deploy.sh  # Pre-deploy verification (21 groups, 272+ tests)
```

---

## What We Changed (vs Upstream Paperclip)

| File / Area | What Changed |
|---|---|
| `server/src/routes/sanad-brain.ts` | New: Brain API reverse proxy |
| `server/src/services/scheduler-loop.ts` | New: in-process 60s scheduler |
| `server/src/services/scheduled-job-executors.ts` | New: 5 job type executors |
| `server/src/services/swarm.ts` | New: Capability Swarm service |
| `server/src/routes/swarm.ts` | New: Swarm REST API |
| `server/src/services/attachment-context.ts` | New: vision blocks for agents |
| `server/src/services/attachment-resolver.ts` | New: attachment storage resolver |
| `server/src/services/skill-evolution.ts` | New: auto-fix skill markdown |
| `server/src/services/skill-versions.ts` | New: versioned skill history |
| `server/src/services/agent-readiness.ts` | New: readiness scoring |
| `packages/db/src/schema/swarm_*.ts` | New: 4 swarm tables |
| `packages/db/src/schema/scheduled_jobs.ts` | New: scheduled job tables |
| `packages/db/src/schema/attachments.ts` | New: attachment tables |
| `docker/media-worker/` | New: LibreOffice document processor |
| All service files | Split into modules using `$` bag pattern |
| All large route files | Split into sub-routers |

---

## Roadmap

| Status | Feature |
|---|---|
| ✅ | Agent crew orchestration (9-agent Optiflow crew) |
| ✅ | Sanad Brain RAG memory integration |
| ✅ | Multimodal attachments (images, documents, video) |
| ✅ | Scheduled jobs (5 job types) |
| ✅ | Capability Swarm (agent skill marketplace) |
| ✅ | Skill evolution, versioning, audit |
| ✅ | Agent readiness scoring |
| ✅ | Public embeddable agent chat |
| ⚪ | Full agent runtime E2E (execution adapter connected) |
| ⚪ | Agent email sending + conversation threading |
| ⚪ | Cross-agent delegation + coordination |
| ⚪ | Economics engine (ledger + cost/value tracking) |
| ⚪ | File split Phase 2 (18 large files remaining) |

---

## Documentation

| Section | Content |
|---|---|
| [Wiki](docs/wiki/README.md) | Full developer wiki |
| [File Reference Matrix](docs/wiki/01-backend/file-reference-matrix.md) | Complete map of all 200+ files |
| [Architecture](docs/wiki/00-getting-started/architecture.md) | System design, data flow, module map |
| [Database Schema](docs/wiki/01-backend/database-schema.md) | All 76 tables with relationships |
| [Routes Map](docs/wiki/01-backend/routes-map.md) | All REST API endpoints |
| [Services Map](docs/wiki/01-backend/services-map.md) | All service modules by domain |
| [Deployment Guide](docs/wiki/03-deployment/deployment-guide.md) | Docker, backups, server info |
| [Plans](docs/plans/) | Feature design documents |

---

## Built On

This platform is a production fork of [Paperclip](https://github.com/paperclipai/paperclip) — the open-source AI agent orchestration framework by [paperclipai](https://github.com/paperclipai). Core architecture, database schema, adapter runtime, and agent coordination patterns are inherited from Paperclip. All additions are our own.

---

<div align="center">

**Built by [Sanad AI](https://github.com/elgogary) / Optiflow Systems**

<sub>Autonomous AI agent orchestration — built on Paperclip, extended for production AI crews</sub>

</div>

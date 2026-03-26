---
title: Architecture
summary: Full system architecture including Sanad Brain, media worker, and MinIO storage
---

Sanad AI EOI is a multi-service system. The core server is extended with Sanad Brain (memory), MinIO (storage), and a media worker (file processing).

## System Diagram

```
┌─────────────────────────────────────────────────────────┐
│  Browser / CLI                                           │
│  React UI (Vite) · REST client                          │
└──────────────────────┬──────────────────────────────────┘
                       │ :3100
┌──────────────────────▼──────────────────────────────────┐
│  Sanad AI EOI Server (Express.js / Node.js)             │
│  ├── REST API (/api/*)                                   │
│  ├── Auth (Better Auth — sessions + API keys)           │
│  ├── Scheduler Loop (60s — scheduled jobs)              │
│  ├── Heartbeat Monitor (30s)                            │
│  ├── Attachment Pipeline (chunked upload → MinIO)       │
│  └── Agent Adapters (claude_local, openclaw, codex)     │
└────────┬──────────┬──────────┬───────────────┬──────────┘
         │          │          │               │
   :5432 │    :9000 │    :3200 │         :8100 │
┌────────▼─┐ ┌──────▼──┐ ┌────▼───────┐ ┌─────▼────────────┐
│PostgreSQL│ │  MinIO   │ │   Media    │ │  Sanad Brain     │
│(Drizzle) │ │  (S3)    │ │  Worker    │ │  (FastAPI)       │
│44 migs   │ │sanad-eoi │ │ ├─ ffmpeg  │ │  ├─ Memory API   │
│          │ │-files    │ │ └─ LibreOff│ │  ├─ Knowledge    │
└──────────┘ └──────────┘ └───────────┘ │  ├─ Dream Engine │
                                         │  └─ Tool Loader  │
                                         └─────────────────┘
                                                │
                                     ┌──────────┴──────────┐
                                     │ Qdrant · Neo4j      │
                                     │ SQLite · Ollama     │
                                     └─────────────────────┘
```

## Services

| Service | Port | Technology | Purpose |
|---------|------|-----------|---------|
| Server | 3100 | Express.js + TypeScript | Control plane, API, UI |
| PostgreSQL | 5432 | PostgreSQL 16 | Primary database |
| MinIO | 9000/9001 | MinIO (S3-compatible) | File attachments |
| Media Worker | 3200 | Express.js + ffmpeg + LibreOffice | File processing, thumbnails |
| Sanad Brain | 8100 | FastAPI (Python) | Persistent agent memory |

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite, React Router 7, Radix UI, Tailwind CSS 4, TanStack Query |
| Backend | Node.js 20+, Express.js 5, TypeScript 5 |
| Database | PostgreSQL 16, Drizzle ORM, 44+ migrations |
| Auth | Better Auth (sessions + API keys) |
| Storage | MinIO (S3-compatible) — swappable to AWS S3 / Cloudflare R2 |
| Media | ffmpeg (video thumbnails), LibreOffice (Office → HTML) |
| Memory | Sanad Brain — Mem0 + Qdrant + Neo4j + Ollama |
| Package manager | pnpm 9 with workspaces |

## Repository Structure

```
sanad-ai-eoi/
├── ui/src/
│   ├── pages/           # Toolkit, Skills, Brain, Chat, Docs, ScheduledJobs…
│   ├── components/      # React components (AttachmentCard, JobDialog…)
│   └── api/             # Typed API clients
│
├── server/src/
│   ├── routes/          # attachments, plugins, scheduled-jobs, skills, mcp-servers…
│   ├── services/        # business logic (scheduler-loop, attachment-context…)
│   └── adapters/        # claude_local, openclaw, codex_local, gemini
│
├── packages/
│   ├── db/              # Drizzle schema + 44 migrations (including attachments)
│   └── shared/          # API types, constants
│
├── docker/
│   └── media-worker/    # ffmpeg + LibreOffice processing service
│
├── skills/              # Skill files deployed to /workspace/skills
├── plugins/             # Plugin definitions
├── mcp-servers/         # MCP server configs
└── docs/                # This documentation
```

## Attachment Pipeline

```
Browser → POST /attachments/init
  → POST /chunk (N × 5MB)
  → POST /complete
    → MinIO compose (assemble chunks)
    → Media worker: POST /process
      ├── image → thumbnail (sharp)
      ├── video → thumbnail (ffmpeg)
      ├── Office → HTML (LibreOffice)
      └── PDF → text extract
    → status = "ready"
  → Agent run context builder
    ├── image/video → vision blocks (base64, 5MB/image)
    └── document → extracted text (10MB total budget)
```

## Scheduled Job Pipeline

```
Scheduler (every 60s) → SELECT due jobs FOR UPDATE SKIP LOCKED
  ├── knowledge_sync → pull docs from source
  ├── webhook → POST to URL (SSRF-guarded)
  └── agent_run → trigger heartbeat
→ Update next_run_at
→ Write run log
```

## Sanad Brain Memory Flow

```
Agent run completes
  → POST /memory/remember (Sanad Brain)
    → PII Guard (strip credentials)
    → Mem0 → entity extraction (glm-4.5-air)
    → Qdrant upsert (768-dim, nomic-embed-text)
    → Neo4j (entity relations)

Agent next run
  → GET /memory/recall?query=...
    → Top-k memories injected into prompt context
```

See [Sanad Brain Architecture](/guides/board-operator/brain-architecture) for the full memory system diagram.

## Key Design Decisions

- **Control plane, not execution plane** — orchestrates agents, doesn't run them
- **Company-scoped** — all data isolated per company; strict boundaries
- **S3 for all uploads** — MinIO by default; ENV swap to AWS S3 or R2
- **In-process scheduler** — no Redis/Celery; runs inside the server process
- **Adapter-agnostic** — any runtime that calls the REST API works as an agent

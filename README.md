<p align="center">
  <img src="docs/assets/header.png" alt="Sanad AI EOI Platform" width="720" />
</p>

<p align="center">
  <strong>Sanad AI EOI Platform</strong>
</p>

<p align="center">
  <a href="#quickstart"><strong>Quickstart</strong></a> &middot;
  <a href="docs/wiki/README.md"><strong>Docs</strong></a> &middot;
  <a href="https://github.com/elgogary/sanad-eoi-main-app"><strong>GitHub</strong></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT License" />
  <img src="https://img.shields.io/badge/built%20on-Paperclip-black" alt="Built on Paperclip" />
  <img src="https://img.shields.io/badge/powered%20by-Claude%20Code-orange" alt="Powered by Claude Code" />
</p>

<br/>

## What is Sanad AI EOI Platform?

**Sanad AI EOI** is an AI agent orchestration platform for running autonomous business operations — built and extended on top of the open-source [Paperclip](https://github.com/paperclipai/paperclip) framework.

It powers the **Optiflow Systems AI Crew** — a fully autonomous team of 9 AI agents (CEO, CTO, Engineers, Sales, Product, DevOps) that coordinates strategy, executes tasks, manages budgets, and delivers work 24/7 with minimal human oversight.

> **Built on Paperclip** — We forked and extended Paperclip with Sanad Brain (RAG memory), multimodal attachments, scheduled jobs, capability swarm, and deep integrations with our agent crew.

<br/>

## Core Capabilities

| Capability | Description |
|---|---|
| **Agent Crew** | Hire and coordinate teams of AI agents — Claude Code, Codex, Cursor, HTTP agents |
| **Task Management** | Assign goals, track work, review output — like a task manager for AI teams |
| **Sanad Brain** | RAG-powered memory and knowledge for agents — persistent context across sessions |
| **Capability Swarm** | Marketplace for agent capabilities — install, share, and monetize agent skills |
| **Scheduled Jobs** | Automated recurring tasks — knowledge sync, webhooks, agent runs |
| **Multimodal** | Attach images, documents, and files to agent conversations |
| **Budget Control** | Set per-agent and company-wide budgets with real-time cost tracking |
| **Board Governance** | Approval gates, escalation chains, audit logs — AI company governance |

<br/>

## Agent Crew Structure

```
Board of Directors (Human)
└── CEO Agent → Strategy, budgets, coordination
    ├── TechLead (CTO) → Architecture, code review, standards
    │   ├── BackendEngineer → Frappe/Python, APIs, TDD
    │   └── FrontendEngineer → React, design, a11y
    ├── SalesManager → Pipeline, deals, revenue
    │   └── SalesRep → Prospecting, demos, closing
    ├── ProductManager → Roadmap, beta, metrics
    │   └── BetaTester (QA) → Testing, bug discovery
    └── DevOps → Deployments, infrastructure, monitoring
```

<br/>

## Tech Stack

- **Server**: Node.js + Express + TypeScript, Drizzle ORM, PostgreSQL
- **UI**: React 19, Vite, TanStack Query, Tailwind CSS, shadcn/ui
- **CLI**: Commander.js, TypeScript
- **Memory**: Sanad Brain (Qdrant + LiteLLM RAG)
- **Infra**: Docker Compose, MinIO (S3-compatible storage)
- **Agents**: Claude Code, Codex, Cursor, HTTP — any agent that accepts a heartbeat

<br/>

## Quickstart

```bash
# Clone
git clone https://github.com/elgogary/sanad-eoi-main-app.git
cd sanad-eoi-main-app

# Install dependencies
pnpm install

# Configure environment
cp .env.example .env
# Edit .env with your DATABASE_URL, ANTHROPIC_API_KEY, etc.

# Start development server
pnpm dev
```

Open [http://localhost:3100](http://localhost:3100)

<br/>

## Docker (Production)

```bash
# Copy and configure environment
cp .env.example .env

# Start all services
docker compose up -d

# Check logs
docker compose logs -f server
```

<br/>

## Development Commands

```bash
pnpm dev              # Full dev (API + UI, watch mode)
pnpm build            # Build all packages
pnpm typecheck        # TypeScript type check
pnpm test:run         # Run all tests
pnpm db:generate      # Generate DB migration
pnpm db:migrate       # Apply migrations
```

<br/>

## Project Structure

```
server/src/
  services/         # Business logic (heartbeat, skills, portability, swarm)
  routes/           # Express REST API routes
  adapters/         # Agent runtime adapters
  __tests__/        # Test suites

ui/src/
  pages/            # React pages (AgentDetail, Issues, Swarm, ScheduledJobs...)
  components/       # Shared UI components
  api/              # API client layer

packages/
  db/               # Drizzle schema + migrations
  shared/           # Shared types + YAML parser

docs/
  plans/            # Feature design documents
  wiki/             # Full developer wiki
  prototypes/       # UI prototypes
```

<br/>

## Roadmap

- ✅ Agent crew orchestration (9-agent Optiflow crew)
- ✅ Sanad Brain RAG memory integration
- ✅ Multimodal attachments (images, documents)
- ✅ Scheduled jobs (knowledge sync, webhooks, agent runs)
- ✅ Capability Swarm (agent skill marketplace)
- ⚪ Full agent runtime execution (E2E autonomous flow)
- ⚪ Agent email sending + conversation threading
- ⚪ Cross-agent delegation + coordination
- ⚪ Economics engine (ledger + cost/value tracking)
- ⚪ File split backlog (18 large files, Phase 2)

<br/>

## Built On

This platform is a production fork of [Paperclip](https://github.com/paperclipai/paperclip) — the open-source AI agent orchestration framework. We extend it with Sanad Brain, custom agent integrations, and EOI-specific capabilities. Core architecture, database schema, and agent runtime patterns are inherited from Paperclip.

<br/>

## License

MIT &copy; 2026 Sanad AI / Optiflow Systems

<br/>

---

<p align="center">
  <img src="docs/assets/footer.jpg" alt="" width="720" />
</p>

<p align="center">
  <sub>Built on Paperclip. Extended for autonomous business operations.</sub>
</p>

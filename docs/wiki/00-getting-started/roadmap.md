# Sanad AI — Roadmap

> If you lose direction, read this. It tells you where we are and what comes next.
> See also: `architecture.md` (full system design), `knowledge-base.md` (all decisions)

---

## Current State (2026-03-28)

**Platform**: Sanad EOI running on Hetzner (65.109.65.159:3100)
**Branch**: `main-sanad-eoi-app` on `github.com/elgogary/sanad-eoi-main-app`
**Agent Crew**: 9 agents configured in Optiflow company (OPT)
**ERP**: ERPNext live for AccuBuild via MCP connector

---

## What Is Built ✅

### Platform Core (Paperclip base)
- ✅ Agent orchestration — hire, configure, run, monitor agents
- ✅ Task/issue management — kanban, comments, attachments, checkout
- ✅ Projects, goals, routines
- ✅ Budget policies + cost tracking
- ✅ Approval workflow (hire, budget, action gates)
- ✅ Company import/export (COMPANY.md packages)
- ✅ Multi-tenant (multiple companies, isolated data)
- ✅ CLI tool (configure, onboard, doctor, worktree commands)
- ✅ Plugin system (MCP + webhook transport)
- ✅ Git worktrees for execution workspaces

### Our Additions (beyond Paperclip)
- ✅ **Sanad Brain** — RAG memory (Qdrant + LiteLLM), knowledge sync, dream consolidation
- ✅ **Capability Swarm** — agent skill marketplace (Catalog, My Swarm, Sources, Queue, Audit)
- ✅ **Scheduled Jobs** — 5 job types: knowledge_sync, webhook, agent_run, dream, memory_ingest
- ✅ **Multimodal attachments** — images (vision), PDF, DOCX/XLSX, video thumbnails
- ✅ **Skill evolution** — auto-fix from run feedback, versioning, audit, metrics
- ✅ **Agent readiness scoring** — config + activity + cost dimensions
- ✅ **Public embeddable chat** — unauthenticated chat with any agent
- ✅ **Org chart** — server-side SVG, 5 visual styles
- ✅ **File split refactor** — all 700+ line files split into modules ($ bag pattern)

### Infrastructure
- ✅ Docker Compose stack on Hetzner (server + DB + MinIO + Brain + media-worker)
- ✅ Backup system (`pre-deploy-backup.sh` — PostgreSQL + MinIO + app data)
- ✅ Pre-deploy smoke test suite (272+ tests, 21 groups)
- ✅ Sanad Brain running alongside (Qdrant + LiteLLM)

---

## What Is Pending ⚪

### Phase 1 — Agent Runtime (Biggest Gap)
Connect the execution adapter so agents actually DO work end-to-end:
- ⚪ Full E2E agent run: wakeup → execute → output → issue update
- ⚪ Agent email sending (reply to clients)
- ⚪ Conversation threading (watcher → agent handoff)
- ⚪ Agent knowledge access (Brain/wiki/codegraph wired to runtime)
- ⚪ Cross-agent delegation (CEO → TechLead → BackendEng)
- ⚪ Quality gate (review before agents email clients)

### Phase 2 — Safety Core (Built by Humans)
- ⚪ Permission system (SRS written, 18 tests)
- ⚪ LLM Router (Python FastAPI, 4+ models)
- ⚪ QA + Eval pipeline on GitHub Actions
- ⚪ PentAGI security scanning on new endpoints

### Phase 3 — Sandbox Infrastructure
- ⚪ E2B SDK integration (sandbox per agent task)
- ⚪ Provisioner API (POST + DELETE endpoints)
- ⚪ Data masking pipeline (Greenmask + frappe_docker)
- ⚪ Dev clone environment (docker-compose.dev.yml)

### Phase 4 — Agents Build Sanad
- ⚪ OpenHands deployed on Hetzner
- ⚪ OpenHands → LLM Router → Claude
- ⚪ Agents build ShipLog backend
- ⚪ Whisper STT voice integration
- ⚪ QA Agent tests every PR
- ⚪ Eval Engine judges every PR

### Phase 5 — Full Product
- ⚪ Twin Agent (human → agent → sandbox → output → approve → MCP → ERP)
- ⚪ Mentor Layer (Eval Engine graduation signals)
- ⚪ ShipLog live for all teams
- ⚪ Microsandbox (swap from E2B)
- ⚪ Multi-company CEO cross-view

### Phase 6 — Full ERP Expansion
- ⚪ Odoo MCP connector
- ⚪ SAP connector
- ⚪ MS Dynamics connector
- ⚪ All companies onboarded
- ⚪ Cross-company CEO dashboard

---

## Technical Debt (File Splits)

18 files still over 700 lines — deferred from Phase 1 refactor.
See: [docs/plans/2026-03-28-file-split-backlog.md](../../plans/2026-03-28-file-split-backlog.md)

| Priority | File | Lines |
|---|---|---|
| High | `server/src/routes/access-helpers.ts` | 1,556 |
| High | `server/src/services/routines.ts` | 1,268 |
| High | `server/src/services/issues.ts` | 1,173 |
| High | `ui/src/pages/docs-content.ts` | 4,343 |
| High | `ui/src/components/AgentConfigForm.tsx` | 1,447 |
| High | `cli/src/commands/client/company.ts` | 1,456 |
| Medium | 12 more files | 700-1,350 each |

---

## Open Questions / Gaps

| # | Gap | Blocks |
|---|---|---|
| 1 | **Other companies?** — list all companies beyond AccuBuild + Sales Force App | Multi-tenant scope |
| 2 | **Odoo status** — live today or planned? | MCP layer |
| 3 | **LLM default per company** — Claude API / local Ollama / switchable? | Cost + privacy |
| 4 | **Mobile app** — React Native or web-only (PWA)? | Voice capture + ShipLog |
| 5 | **Evaluation Engine SRS** — needs to be written before Phase 1C | Phase 1C build |

---

## Immediate Next Steps (This Week)

1. **Agent runtime E2E** — connect execution adapter, test full loop
2. **Email watcher redesign** (OPT-51) — 6-step flow (auto-ack → enhance → classify → clarify → task → deliver)
3. **File split Phase 2** — start with `access-helpers.ts` (1,556 lines)
4. **Monitoring stack** — deploy Traefik + Prometheus + Grafana on Hetzner (Phase 1A)

---

## Key Files to Never Break

| File | Why |
|---|---|
| `server/src/routes/sanad-brain.ts` | Brain proxy — all memory flows through here |
| `server/src/services/scheduler-loop.ts` | Scheduled job heartbeat |
| `server/src/services/scheduled-job-executors.ts` | Brain sync, dreams, memory ingest |
| `server/src/app.ts` | Mounts all routes + Brain proxy at line 149 |
| `docker-compose.yml` | Production stack — volume paths are absolute, update on folder move |

---

## Decision Log (Confirmed, Do Not Change Without Discussion)

| Decision | Why |
|---|---|
| TypeScript + Python only — no other languages | Team unity, avoids fragmentation |
| Agents propose, humans approve — always | Safety core principle |
| Agents never build the safety layer | Can't trust agents to govern themselves |
| Additive-only DB migrations | Rollback safety |
| No upstream Paperclip sync | We've diverged significantly, manual cherry-pick only |
| One Sanad instance, multi-company via tenant isolation | Simpler ops, shared Brain |
| Hetzner on-premise, Cloudflare DNS-only | Data sovereignty |

---

*Update this file whenever a phase completes or a major decision changes.*

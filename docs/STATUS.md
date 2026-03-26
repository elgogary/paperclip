# Sanad AI EOI — Master Status

> Last updated: 2026-03-26
> Repos: `paperclip` (main-sanad-eoi-app) + `optiflow` (main)

---

## Legend

| Symbol | Meaning |
|--------|---------|
| DONE | Shipped, merged, working |
| DESIGN | Design doc / prototype complete, not yet built |
| PLAN | Implementation plan written, not started |
| NOT STARTED | No plan or design yet |

---

## 1. PAPERCLIP PLATFORM (Shipped Features)

| Feature | Status | Branch/Commit | Notes |
|---------|--------|---------------|-------|
| Sanad AI EOI rebrand (15 files) | DONE | `5094b0ed` | All Paperclip refs → Sanad AI EOI |
| Project Knowledge Base (OPT-50) | DONE | `d7fc2b10` | Documents linked to projects, Sanad Brain integration |
| Office doc preview (mammoth.js) | DONE | `69a788e8` | Client-side .docx → HTML conversion |
| Attachment preview (popup modal) | DONE | `caa6a6db` | Inline preview in issue detail |
| Capability Swarm prototype (6 tabs) | DONE | `bf274268`→`0236cbe2` | HTML prototype with Economics, Agents, Knowledge Library |
| Capability Swarm design doc (561 lines) | DONE | `8d7922c4` | 4-phase architecture, 18 gaps patched |
| Ephemeral Agent Chat (full stack) | DONE | `583b0cdc` | DB table + token service + API routes + WebSocket + React UI |
| Scheduled Jobs system | DONE | (prior merge) | Scheduler loop, 3 executors, UI with filters |
| 9 Agent configs (SOUL/HEARTBEAT/SKILLS) | DONE | `5abc2348` | CEO, TechLead, BackendEng, FrontendEng, ProductMgr, SalesMgr, SalesRep, BetaTester, DevOps |
| Email MCP server | DONE | `5abc2348` | IMAP/SMTP, 7 tools, guardrails, rate limiting |
| Email Watcher v2 | DONE | `5abc2348` | Auto-ack → classify → task → chat invite → track |
| Company Law document | DONE | `5abc2348` | 7 Islamic principles for agent governance |
| LiteLLM config reference | DONE | `5abc2348` | 3-model setup (qwen3-8b, qwen2.5-coder, glm-4.5-air) |
| Prompt Enhancer + SDD Writer skills | DONE | `1f79e0e3` | Added to skills library |

---

## 2. OPTIFLOW INFRASTRUCTURE (Shipped)

| Feature | Status | Commit | Notes |
|---------|--------|--------|-------|
| 9 agent identities + IGNITE personas | DONE | `cced006` | All agents have SOUL, HEARTBEAT, SKILLS, LESSONS |
| Company Law wired to all agents | DONE | `cced006` | 7 principles in every SOUL.md |
| LiteLLM budget keys + Sanad Brain guards | DONE | `4c3deac` | Per-agent rate limits |
| Email MCP server (IMAP/SMTP) | DONE | `de3a3fc` | 7 tools for agent email access |
| Email Watcher v2 (full pipeline) | DONE | `c9bd717` | Auto-reply + tracking + chat invites |
| 3 CRITICAL + 4 HIGH security fixes | DONE | `f5ff80f` | Email MCP hardened |
| Agent Readiness Enforcement spec | DONE | `4c64e35` | 199-line implementation spec |
| AccuBuild knowledge loaded | DONE | `43412eb` | Project knowledge index for agents |

---

## 3. NOT YET BUILT — By Priority

### Priority 1: Ready to Execute (Plan exists, approved)

| Feature | Plan Location | Scope | Blocked By |
|---------|--------------|-------|------------|
| Agent Readiness API + Enforcement | `optiflow/docs/plans/2026-03-26-agent-readiness-enforcement.md` | GET /agents/:id/readiness, agent_metrics table, 9 SOUL updates, radar chart UI | Nothing — ready |
| Email Watcher classification fix + restart | Last session context | Fix watcher AI classification, restart systemd service | Nothing — ready |
| IGNITE Guardrails (LiteLLM callbacks) | `paperclip/docs/plans/2026-03-26-ignite-fast-ship.md` (Task 2.1) | Add content moderation callbacks to LiteLLM config | SSH to Hetzner |
| IGNITE Outreach via Email (Gmail OAuth) | `paperclip/docs/plans/2026-03-26-ignite-fast-ship.md` (Task 5.x) | Gmail MCP + OAuth2 per agent | Guardrails first |
| IGNITE Research MCP | `paperclip/docs/plans/2026-03-26-ignite-fast-ship.md` (Task 4.x) | Wrap scrape-leads/gmaps-leads as MCP tools | Nothing |

### Priority 2: Design Complete, Needs Implementation Plan

| Feature | Design Location | Scope |
|---------|----------------|-------|
| Capabilities Swarm (full system) | `paperclip/docs/plans/2026-03-26-capabilities-swarm-design.md` | 4 phases: Infrastructure → Economics → Brain Tools → Director Agent |
| OpenSpace Architecture | Swarm design doc (section) | Virtual workspace for sub-agent spawning |
| Sub-Agent Runtime | Swarm design doc (section) | Ephemeral agents spawned by parent agents |
| Multimodal Attachments | `paperclip/docs/plans/2026-03-25-multimodal-attachments-*.md` | Image/PDF/audio in agent conversations |
| Skills UI Evolution | `paperclip/docs/plans/2026-03-25-skills-ui-evolution-plan.md` | Skill marketplace, versioning, discovery UI |
| Brain Roadmap F16 Alignment | `paperclip/docs/plans/2026-03-25-brain-roadmap-f16-alignment.md` | Align Sanad Brain with F16 architecture |
| F16 Skill Evolution | `paperclip/docs/plans/2026-03-25-f16-skill-evolution-design.md` | Auto-evolving skills via feedback loops |
| Agent User ACL | `paperclip/docs/plans/2026-03-21-agent-user-acl-implementation.md` | Per-agent permission system |
| Chat Phase 1.5 | `paperclip/docs/plans/2026-03-21-chat-phase1.5-implementation.md` | Enhanced chat features beyond ephemeral |

### Priority 3: Master Plan Tasks (96 total, 0 checked)

From `optiflow/docs/plans/2026-03-23-master-todo-all-plans.md`:

| Track | Tasks | Status | Key Items |
|-------|-------|--------|-----------|
| **A: Memory Layer** | A1-A14 (14 tasks) | NOT STARTED | Sanad Brain v2 replaces this — 4-type memory, SQLite+Qdrant, MemoryExtractor |
| **B: IGNITE L0-L3** | B1-B15 (15 tasks) | PARTIAL | B12 (Company Law) DONE, B13 (agent identities) DONE, B3 (LiteLLM) DONE. Rest NOT STARTED |
| **C: FORGE P0-P1** | C1-C13 (13 tasks) | NOT STARTED | Agent schema audit, DB changes, Security/QA/Analytics agents, lazy tools |
| **X: Convergence** | X1-X3 (3 tasks) | NOT STARTED | Wire memory into FORGE + IGNITE agents |
| **D: FORGE P2** | D1-D11 (11 tasks) | NOT STARTED | Per-workflow models, context compaction, lessons, skill versioning |
| **E: IGNITE L4-5** | E1-E7 (7 tasks) | NOT STARTED | Research agent, filtration, WhatsApp outreach |
| **F: FORGE P3** | F1-F5 (5 tasks) | NOT STARTED | Self-critique, focus scoring, checkpoints |
| **G: FORGE P4** | G1-G6 (6 tasks) | NOT STARTED | Knowledge graph, CEO agent, skill auto-rebuild |
| **H: IGNITE L6** | H1-H4 (4 tasks) | NOT STARTED | Marketing agent, inbound capture, analytics |
| **T: Testing** | T1-T12 (12 tasks) | NOT STARTED | Integration, E2E, performance, acceptance |

### Priority 4: Other Plans (design/research phase)

| Plan | Location | Status |
|------|----------|--------|
| AccuBuild Market Research | `optiflow/docs/plans/2026-03-21-accubuild-market-research-plan.md` | PLAN |
| AccuBuild Bid Portal SRS | `optiflow/docs/plans/accubuild-bid-portal-srs.md` | PLAN |
| AccuBuild Mobile App PRD/SRS | `optiflow/docs/plans/accubuild-mobile-app-*.md` | PLAN |
| Agent Evolution System Design | `optiflow/docs/plans/2026-03-21-agent-evolution-*.md` | DESIGN |
| Optiflow Agent Crew Design | `optiflow/docs/plans/2026-03-21-optiflow-agent-crew-design.md` | DESIGN |
| Codegraph Sanad AI Design | `optiflow/docs/plans/2026-03-22-codegraph-sanad-ai-*.md` | DESIGN |
| Codegraph Depth Levels | `optiflow/docs/plans/2026-03-22-codegraph-depth-levels-seed.md` | DESIGN |
| FORGE Platform Implementation | `optiflow/docs/plans/2026-03-22-forge-platform-implementation.md` | PLAN |
| Sanad Brain v2 Architecture | `optiflow/docs/plans/2026-03-23-sanad-brain-*.md` (6 docs) | DESIGN |
| Sanad Dream SRS v2 | `optiflow/docs/plans/2026-03-24-sanad-dream-srs-v2.md` | DESIGN |
| Sanad Tool Lazy Loading SRS | `optiflow/docs/plans/2026-03-24-sanad-tool-lazy-loading-srs.md` | DESIGN |
| Sanad Unified Architecture | `optiflow/docs/plans/2026-03-24-sanad-unified-architecture.md` | DESIGN |
| Agent Stress Test | `paperclip/docs/plans/2026-03-25-agent-stress-test.md` | PLAN |
| Toolkit Capabilities | `paperclip/docs/plans/2026-03-25-toolkit-capabilities.md` | DESIGN |
| Issue Documents | `paperclip/docs/plans/2026-03-13-issue-documents-plan.md` | PLAN |
| Scheduled Jobs (plan) | `paperclip/docs/plans/2026-03-24-scheduled-jobs.md` | DONE (shipped) |

---

## 4. SUMMARY

| Category | Count |
|----------|-------|
| Features shipped (Paperclip) | 14 |
| Features shipped (Optiflow) | 8 |
| Plans: ready to execute (Priority 1) | 5 |
| Plans: design complete, needs impl plan (Priority 2) | 9 |
| Master plan tasks (Priority 3) | 96 (3 done, 93 remaining) |
| Other plans in design/research (Priority 4) | 15 |
| **Total plan docs** | **45 files** |

---

## 5. RECOMMENDED NEXT ACTIONS

1. **Agent Readiness API** — spec is written, blocks safe agent execution
2. **Email Watcher restart** — fix classification, get it running on Hetzner
3. **IGNITE Guardrails** — config-only change on LiteLLM, protects all agents
4. **Process Mohammed's SDD request** — test email watcher end-to-end
5. **Capability Swarm Phase 1 (Infrastructure)** — registry + source adapters

# Project Knowledge Index

**Purpose:** Single entry point for all project docs, plans, research, and wikis. Read the relevant section for your role and task — then navigate to the specific file.

**Working directory:** `/workspace/`

---

## Quick Lookup by Role & Task

| I need to know... | Read this |
|---|---|
| Company principles and ethics | `docs/company-law.md` |
| Agent crew structure and escalation | `docs/AGENT-CONFIG-SUMMARY.md` |
| AccuBuild pricing to quote to leads | `knowledge/areas/accubuild-pricing-decision.md` |
| KSA competitors to handle objections | `knowledge/areas/ksa-construction-competitors.md` |
| Active sales leads and pipeline | `knowledge/areas/sales-leads.md` |
| AccuBuild codebase architecture | `knowledge/resources/accubuild-architecture.md` |
| Lipton codebase architecture | `knowledge/resources/lipton-architecture.md` |
| Which projects are active vs archived | `knowledge/projects/PROJECT-CLASSIFICATION.md` |
| What the strategic roadmap is | `docs/plans/2026-03-23-master-todo-all-plans.md` |
| Current fast-ship priorities | `docs/plans/2026-03-26-ignite-fast-ship.md` |
| AccuBuild market research summary | `docs/research/accubuild-market-research.md` |
| AccuBuild product audit | `docs/research/01-accubuild-product-audit.md` |
| Sanad Brain security status | `docs/reports/2026-03-25-sanad-brain-security-audit-phase2.md` |

---

## 1. Core Governance

| File | Description |
|---|---|
| `docs/company-law.md` | 7 Islamic business principles all agents follow (Amanah, Itqan, Sidq, Ihsan, Adl, Tawadu, Shura) |
| `docs/AGENT-CONFIG-SUMMARY.md` | Full agent crew — org chart, who reports to whom, escalation matrix, rules inheritance |

---

## 2. Knowledge Base (`/workspace/knowledge/`)

Curated, living knowledge. **Read before doing tasks in these areas.**

### Projects
| File | Description |
|---|---|
| `knowledge/projects/PROJECT-CLASSIFICATION.md` | All repos classified: product, client-app, infra, internal-tool. Status: active/stable/paused/archived |

### Areas (Ongoing Intelligence)
| File | Description | Who uses it |
|---|---|---|
| `knowledge/areas/accubuild-pricing-decision.md` | Approved pricing tiers for AccuBuild SaaS. Use as baseline for quotes. | Sales, PM |
| `knowledge/areas/ksa-construction-competitors.md` | KSA/MENA competitors analysis. Our differentiators vs each. | Sales, PM |
| `knowledge/areas/sales-leads.md` | Active leads pipeline — status, notes, last contact. | Sales |

### Resources (Reference Architectures)
| File | Description | Who uses it |
|---|---|---|
| `knowledge/resources/accubuild-architecture.md` | AccuBuild module map, DocTypes, relationships — auto-generated | TechLead, BE, FE |
| `knowledge/resources/lipton-architecture.md` | Lipton app module map — auto-generated | TechLead, BE |

---

## 3. Strategic Plans (`/workspace/docs/plans/`)

Key planning documents. Check these for context before starting large tasks.

| File | Summary |
|---|---|
| `2026-03-26-ignite-fast-ship.md` | **CURRENT** — 4 IGNITE layers: guardrails, agent identity, email outreach, research MCP |
| `2026-03-23-master-todo-all-plans.md` | Master checklist across FORGE + IGNITE + Memory Layer (3 parallel tracks) |
| `2026-03-23-ignite-revenue-engine-implementation.md` | Full IGNITE Layer-by-Layer implementation spec |
| `2026-03-23-ignite-layered-execution-plan.md` | IGNITE execution plan with week-by-week breakdown |
| `2026-03-21-optiflow-agent-crew-design.md` | Original agent crew design — org chart, roles, success metrics |
| `2026-03-21-agent-evolution-system-design.md` | Agent career paths (L1-L4), evaluation system, leveling criteria |
| `2026-03-21-skills-mapping-plan.md` | Skills matrix — which skills belong to which roles |
| `2026-03-21-agent-user-acl-design.md` | Access control design — agent permissions and board user grants |
| `2026-03-22-forge-platform-implementation.md` | FORGE platform full spec (software delivery + revenue) |
| `2026-03-23-sanad-brain-architecture-v2.md` | Sanad Brain (memory system) architecture v2 |
| `2026-03-23-memory-layer-production-plan.md` | Sanad Brain production deployment plan |
| `2026-03-21-paperclip-chat-ui-design.md` | Paperclip chat UI design spec |
| `2026-03-24-sanad-unified-architecture.md` | Unified Sanad architecture combining Brain + IGNITE + FORGE |

---

## 4. Research (`/workspace/docs/research/`)

| File | Description |
|---|---|
| `accubuild-market-research.md` | Full AccuBuild market research (MENA construction ERP) — pricing, segments, TAM |
| `01-accubuild-product-audit.md` | Product audit — feature gaps, strengths, what to build next |
| `02-erpnext-construction-ecosystem.md` | ERPNext ecosystem for construction — modules, integrations |
| `03-egypt-mena-competitors.md` | Egypt + MENA competitor landscape |
| `04-procore-global-comparison.md` | Procore global benchmark vs AccuBuild |
| `05-ksa-uae-construction-market.md` | KSA/UAE construction market sizing and entry strategy |
| `ksa-competitors-deep-research.md` | Deep-dive: KSA-specific software competitors |

---

## 5. Security Reports (`/workspace/docs/reports/`)

| File | Description |
|---|---|
| `2026-03-25-sanad-brain-security-audit-phase1.md` | Sanad Brain security audit phase 1 — threat model |
| `2026-03-25-sanad-brain-security-audit-phase2.md` | Sanad Brain security audit phase 2 — findings + remediation status |

---

## 6. Agent Configuration (`/workspace/.agents/`)

Each agent directory has 4 standard files:

| File | Purpose |
|---|---|
| `SOUL.md` | Identity, role, rules, authority level, skills |
| `HEARTBEAT.md` | Daily/weekly task checklist and priorities |
| `SKILLS.md` | Assigned skills list |
| `LESSONS.md` | Lessons learned — read before starting tasks |

### Agent Directories
```
.agents/
├── _common/              ← Shared: CAPABILITIES.md, EXECUTION-RULES.md, INFISICAL.md
├── ceo/                  ← CEO: strategic decisions, budget, team coordination
├── tech-lead/            ← Tech Lead: code review, architecture, quality standards
├── backend-engineer/     ← Backend: Frappe/Python, APIs, business logic
├── frontend-engineer/    ← Frontend: Frappe JS, Jinja, UI components
├── sales-manager/        ← Sales Manager: pipeline, deals, team coordination
├── sales-rep/            ← Sales Rep: prospecting, demos, outreach
├── product-manager/      ← Product Manager: roadmap, metrics, customer feedback
├── beta-tester/          ← Beta Tester: QA, bug discovery, user feedback
└── devops/               ← DevOps: deployments, monitoring, infra
```

---

## 7. Skills Library (`/workspace/skills/`)

**108+ reusable skills** — always check before writing custom code.

Navigate by reading `/workspace/skills/README.md` or browse by category:
- `erpnext-syntax-*/` — Frappe/ERPNext syntax reference (8 skills)
- `erpnext-impl-*/` — Implementation workflows (8 skills)
- `erpnext-errors-*/` — Error handling patterns (7 skills)
- `code-review/`, `clean-code/`, `security-review/` — Quality gates
- `create-doctype/`, `create-controller/`, `create-client-script/` — Frappe creation
- `research-architect/`, `recommend-improvements/` — Architecture
- `scrape-leads/`, `classify-leads/`, `create-proposal/` — Sales
- `press-provision/`, `modal-deploy/`, `sync-fork/` — DevOps

---

## 8. Memory System (Sanad Brain)

Key memories can be retrieved at runtime via `recall` MCP tool. Useful prefixes:
- `FACT:` — static facts (pricing, architecture, competitor data)
- `LESSON:` — things that went wrong and how to fix them
- `DECISION:` — approved decisions (don't re-debate)
- `PATTERN:` — code or workflow patterns that work
- `EVENT:` — milestones completed

**Before any task:** `recall("relevant topic")` — check what the brain already knows.
**After any task:** `remember("LESSON/FACT/DECISION: ...")` — add what you learned.

---

## How to Navigate

1. **Start task** → look up your role in Section 2 Quick Lookup
2. **Need architecture info** → read `knowledge/resources/<project>-architecture.md`
3. **Need market/sales info** → read `knowledge/areas/<topic>.md`
4. **Need strategic context** → read relevant doc from Section 3
5. **Writing code** → check `skills/` first, then `erpnext-syntax-*` for patterns
6. **Unsure about decisions** → `recall` in Sanad Brain before re-deciding

# Sanad AI — Knowledge Base
> **Last Updated:** March 2026  
> **Maintained by:** Accurate Systems  
> **Purpose:** Single source of truth for all architectural decisions, design principles, and implementation plans discussed across sessions.

---

## Table of Contents

1. [The Vision](#1-the-vision)
2. [Companies & Context](#2-companies--context)
3. [Tech Stack](#3-tech-stack)
4. [Infrastructure — Hetzner + DNS](#4-infrastructure--hetzner--dns)
5. [Monitoring Layer](#5-monitoring-layer)
6. [Security Layer — PentAGI](#6-security-layer--pentagi)
7. [Evaluation Engine](#7-evaluation-engine)
8. [Sanad Platform — Core Modules](#8-sanad-platform--core-modules)
9. [Agent Architecture](#9-agent-architecture)
10. [Sandbox Infrastructure](#10-sandbox-infrastructure)
11. [CI/CD + QA Pipeline](#11-cicd--qa-pipeline)
12. [ERP Connectors — MCP Layer](#12-erp-connectors--mcp-layer)
13. [Build Sequence — Phase by Phase](#13-build-sequence--phase-by-phase)
14. [Open Gaps](#14-open-gaps)
15. [Design Principles](#15-design-principles)

---

## 1. The Vision

Sanad AI is **not another ERP**. It is the intelligent operating layer that sits on top of ERPs.

Every person in the organization (CEO → Manager → Employee) gets a **Twin Agent** that:
- Thinks with them
- Captures voice while driving → structured ideas before they arrive at the office
- Routes work to the correct ERP automatically
- Escalates when blocked
- Never loses a thought

> **The ERP is infrastructure. Sanad is the operating layer on top.**

### What Sanad is NOT
- Not a chatbot
- Not a replacement for ERPNext
- Not a single-company tool
- Not locked to one AI model

---

## 2. Companies & Context

| Company | Role | ERP | Status |
|---|---|---|---|
| Accurate Systems | Holding company · CEO: Eslam | — | Running |
| AccuBuild | Subsidiary · Construction domain | ERPNext | Running |
| Sales Force App | Subsidiary · Sales domain | TBD | Running |
| _(others TBD)_ | — | — | Gap |

**Multi-company principle:** One Sanad instance serves all companies. Each company has its own data scope, its own permission grants, its own ERP connector. The CEO has a cross-company view.

---

## 3. Tech Stack

### Languages — 2 Only
| Language | Used For |
|---|---|
| **TypeScript** | Frontend (React), Backend API (Node.js / Fastify), BullMQ queues |
| **Python** | All agent logic, LLM Router, Provisioner API, Eval Engine, Greenmask scripts |

**No other backend languages.** Rust only if building custom sandbox layer in the future. Go avoided to keep team unified.

### Core Services
| Service | Role | License |
|---|---|---|
| Paperclip | Agent orchestration base, org chart, budgets | MIT |
| PostgreSQL | Sanad core data (users, perms, tasks, ShipLog, eval logs) | Open source |
| MariaDB | ERPNext data (invoices, stock, HR, projects) | GPL |
| Qdrant | Vector memory (agent skill fingerprints, Mentor style) | Apache-2.0 |
| Redis + BullMQ | Job queues, sandbox backpressure, retry | MIT |

### Infrastructure
| Tool | Role | License |
|---|---|---|
| Traefik v3 | Reverse proxy, 3-zone routing, auto wildcard SSL | MIT |
| Portainer | Docker management UI — Eslam manages without SSH | Zlib |
| Prometheus | Metrics collection, scrapes all services | Apache-2.0 |
| Grafana | Dashboards + alerts | AGPL (self-hosted free) |
| PentAGI | Autonomous security scanner | MIT (see §6) |
| DeepEval | Evaluation sidecar | Apache-2.0 |
| E2B | Sandbox engine (prototype) | Apache-2.0 |
| Microsandbox | Sandbox engine (production) | Apache-2.0 |
| Greenmask | Database masking | Apache-2.0 |
| frappe_docker | ERPNext sandbox cloning | MIT |
| OpenHands | Coding agent (builds Sanad) | MIT |
| Whisper STT | Voice capture | MIT |

---

## 4. Infrastructure — Hetzner + DNS

### Server
- **Provider:** Hetzner
- **RAM:** 16GB
- **Docker:** Installed and running
- **Anthropic API Key:** Ready

### Cloudflare — 3-Zone Wildcard DNS

```
DNS Records (Cloudflare dashboard):

Type  Name                      Value         Proxy
A     sanadai.com               HETZNER_IP    🟠 ON  (WAF + DDoS)
A     *.sanadai.com             HETZNER_IP    🟠 ON  (WAF + DDoS)
A     *.dev.sanadai.com         HETZNER_IP    ⚫ OFF (Traefik handles SSL)
A     *.sandbox.sanadai.com     HETZNER_IP    ⚫ OFF (Traefik handles SSL)

SSL/TLS Mode: Full (strict)
```

**Why grey cloud for dev + sandbox:**  
Traefik handles SSL via Let's Encrypt DNS-01 challenge. Cloudflare proxied mode on deep subdomains causes `ERR_TOO_MANY_REDIRECTS`. Grey = DNS only, Traefik terminates SSL directly.

**Cloudflare API Token permissions:**
- Zone → Zone → Read
- Zone → DNS → Edit

### Traefik Wildcard Cert Config

```yaml
certificatesResolvers:
  cloudflare:
    acme:
      email: eslam@sanadai.com
      storage: /certs/acme.json
      dnsChallenge:
        provider: cloudflare
        delayBeforeCheck: 60
        resolvers:
          - "1.1.1.1:53"
          - "8.8.8.8:53"
```

One cert request covers all three zones simultaneously.

### Zone Map

| Zone | URL Pattern | Security | Purpose |
|---|---|---|---|
| Production | `*.sanadai.com` | Cloudflare WAF + DDoS | Real users, Eslam, managers |
| Development | `*.dev.sanadai.com` | basicAuth password | Development team only |
| Sandbox | `*.sandbox.sanadai.com` | Split (see below) | Agent task environments |

#### Sandbox Zone — Split Design
Each agent task gets **two** containers:

```
INTERNAL (agent works here — never public):
  sandbox-task-001        → Docker internal network (internal: true)
  Agent reads/writes freely, no external access

PUBLIC OUTPUT (human reviews result before approving):
  output-task-001.sandbox.sanadai.com  → HTTPS, Traefik routed
  Eslam or client sees the result here
  Approved → MCP pushes diff to real ERP
  Both containers destroyed after approval
```

### Production URLs (after Phase 1 deployment)

```
https://portainer.sanadai.com      Docker UI — Eslam manages everything
https://grafana.sanadai.com        Monitoring dashboards
https://pentagi.sanadai.com        Security scanner
https://traefik.sanadai.com        Routing dashboard

# Auto-created per developer:
https://eslam.dev.sanadai.com      CEO dev clone
https://dev1.dev.sanadai.com       Developer 1

# Auto-created per agent task:
https://output-task-001.sandbox.sanadai.com   Task result (public, short-lived)
```

---

## 5. Monitoring Layer

> **Passive · Always-On · Real-Time · Never Triggers Anything**

### Stack
- **Prometheus** — collects all metrics, scrapes every 15s
- **Grafana** — dashboards + alerts
- **cAdvisor** — Docker container metrics
- **node-exporter** — Hetzner server metrics (CPU, RAM, disk, network)
- **AlertManager** — fires alerts to Slack/channel

### Key Metrics

```
agent_task_latency_seconds      # How long each agent task takes
agent_token_usage_total         # Tokens consumed per agent/model
agent_error_rate                # Failure rate per agent
agent_cost_usd                  # Cost per agent run
model_calls_total               # Calls per skill per model
sandbox_active_count            # How many sandboxes running now
sandbox_cpu_usage               # Per-sandbox CPU
sandbox_lifetime_seconds        # How long each sandbox has been running
provisioner_api_latency_ms      # Time to spin up a sandbox
queue_depth                     # Redis/BullMQ pending jobs
```

### Grafana Dashboards to Import

| ID | Name | Purpose |
|---|---|---|
| 1860 | Node Exporter Full | Hetzner server health |
| 893 | Docker + system | Container overview |
| 14282 | cAdvisor | Detailed container metrics |

### Important Distinction

| | Monitoring | Evaluation Engine |
|---|---|---|
| **When** | Always-on | Triggered on code change |
| **Mode** | Passive observer | Active judge |
| **Triggers** | Nothing | Promote or rollback verdict |
| **Purpose** | Stability | Quality |

---

## 6. Security Layer — PentAGI

### What It Is
Fully autonomous AI security agent. 13,750 GitHub stars. MIT license. Deployed as-is on Hetzner via Docker.

**GitHub:** https://github.com/vxcontrol/pentagi

### What It Does
- 20+ built-in security tools: nmap, metasploit, sqlmap, and more
- Multi-agent system: researcher + developer + executor agents
- Long-term memory via Neo4j knowledge graph
- PostgreSQL + pgvector for persistent results
- Grafana dashboard built-in (scan results + agent performance)
- Uses Claude via Anthropic API key

### What PentAGI Scans for Sanad
- Sanad API — authentication vulnerabilities
- Paperclip — permission bypass attempts
- ERPNext — SQL injection, exposed endpoints
- Hetzner server — open ports, misconfigurations
- PostgreSQL — access control gaps
- Redis — authentication gaps
- Each new service added in every phase

### ⚠️ License Rule — Critical

```
MIT license  = run as-is on Docker ✅ Free, no restrictions
AGPL license = applies if you FORK or embed the code ⚠️

SAFE PATTERN for Sanad (commercial product):
✓ Run PentAGI standalone as Docker container
✓ Connect Sanad via REST API only
✓ Paperclip adapter → PentAGI API → Sanad → ERPNext report
✗ Never fork PentAGI
✗ Never embed PentAGI code into Sanad codebase
```

---

## 7. Evaluation Engine

> **Triggered · Active · On Change · Like CI/CD but for Agent Quality**

### Purpose
When a developer changes anything — prompt, model, skill logic, tool — the engine:
1. Runs automatically
2. Pulls baseline from PostgreSQL
3. Runs DeepEval sidecar
4. Compares before vs after across 5 dimensions
5. Produces verdict: **promote** or **rollback**

### Stack
- Custom service (Python)
- DeepEval sidecar (Docker, REST API, Apache-2.0)
- PostgreSQL (baseline storage)
- Qdrant (skill progression vectors)

### 5 Evaluation Dimensions

#### Dimension 1 — Task Eval
Did this specific task succeed?
- Tool correctness
- Plan adherence
- Output quality score

#### Dimension 2 — Skill Eval
Is the agent improving across tasks?
- Rolling score per skill
- `skill_level` stored in Qdrant
- Progression over time visible

#### Dimension 3 — Agent Eval
Is this agent trustworthy overall?
- `trust_score`
- Failure patterns
- Weak vs strong skills mapped

#### Dimension 4 — System Eval
Infrastructure health (fed from Prometheus):
- Latency p50 / p95 / p99
- Error rate
- Retry rate

#### Dimension 5 — Model Comparison
Same task, different LLM providers:
- Compare `quality_score` + `cost` + `latency`
- `cost_efficiency = quality_score / cost`
- Output: updated routing table

### Model Routing Table (auto-updated by Eval Engine)

```
skill: invoice_processing  → GLM-4   (score: 0.91, cost: $0.02)
skill: legal_contract      → Claude  (score: 0.95, cost: $0.10)
skill: data_extraction     → Gemini  (score: 0.89, cost: $0.01)
skill: hr_policy_query     → Ollama  (score: 0.84, cost: $0.00)
```

Sanad auto-routes each task to the **cheapest model that meets the quality threshold**. LLM Router reads this table on every call.

### Full Eval Flow

```
Developer makes change (prompt / model / skill / tool)
        ↓
Eval Engine triggers automatically
        ↓
Pulls baseline run logs from PostgreSQL
        ↓
Runs DeepEval sidecar via REST API
        ↓
Compares 5 dimensions: before vs after
        ↓
Produces change report:
  - quality_score delta
  - skill_level delta
  - cost delta
  - latency delta
  - final verdict: PROMOTE or ROLLBACK
        ↓
Developer promotes or rolls back
        ↓
If promoted → skill_level + trust_score written to Qdrant
        ↓
Mentor reads updated scores → triggers graduation or coaching
```

### Integration with Mentor

```
Eval Engine  →  skill_level delta  →  Mentor
Eval Engine  →  trust_score        →  Mentor

Mentor logic:
  if trust_score >= graduation_threshold:
    promote agent: trainee → autonomous
  if skill_level regresses:
    trigger coaching session
```

### Shared Storage

| Store | Used By | Contents |
|---|---|---|
| **PostgreSQL** | Monitoring + Eval Engine | Raw agent run logs, baseline snapshots, eval reports, skill scores, model comparison results |
| **Qdrant** | Eval Engine + Mentor | skill_progression vectors, agent_style_fingerprints, trust_score history, coaching records |

> **Rule:** Data is never duplicated between stores. PostgreSQL = operational logs. Qdrant = vector memory.

### Next Step
> **Write the full SRS for the Evaluation Engine:**  
> Schema · API endpoints · Change detection trigger · Scoring system · Model comparison logic · Mentor integration contract

---

## 8. Sanad Platform — Core Modules

### Paperclip Core
**Status:** ✅ Running on Hetzner today  
**GitHub:** https://github.com/paperclipai/paperclip  
Node.js + React + PGlite/PostgreSQL. 14,200 GitHub stars. Agent orchestration, org charts, budgets, governance. better-auth IAM. `req.actor` pattern (user / agent / mentor / instance_admin).

Sanad is built **on top of** Paperclip, not a fork.

### Permission System (SOD)
**Status:** 📐 SRS Written — ready to implement  

Segregation of Duties layer. No agent can act without a permission grant. No action commits without a human approval chain.

```
Key tables:
  principal_permission_grants    (who can do what)
  company_memberships            (who belongs to which company)
  permission_audit_log           (append-only, every action)

Key functions:
  hasPermission(actor, key, companyId)
  assertPermission(actor, key, companyId)   // throws if denied
  grantPermission(grantor, grantee, key)
  revokePermission(revoker, grantee, key)

Migrations:
  0038 — new permission keys
  0039 — permission_audit_log table

REST API: 7 endpoints on /api/companies/:id/permissions/
UI: 5 tabs — Members, Grants, Scope, SOD Conflicts, Audit Log
Tests: 18 test cases written — all must pass green
```

**Rule:** Agents never bypass the permission system. The permission system governs agents. Agents cannot govern themselves.

### ShipLog
**Status:** 📐 UI Mockups Done — backend to build in Phase 5  

Crew-based execution tracker. Solves the problem of losing ideas and plans across sessions.

```
Core loop:
  Thought → Idea → Plan → Daily Log Tasks → Completed/Blocked → Archive

3 Views:
  Daily Log    — planned / completed / blocked columns, crew assignment
  Ideas Board  — 3-column sticky note system with promote buttons
  Plans View   — progress bars, crew roster, task checklists

Voice capture:
  CEO speaks while driving → Whisper STT → LLM Router structures idea
  → auto-saved to Ideas Board
  → CEO arrives at office, idea already structured

Language rule:
  Universal business language (not tech-specific)
  ✓ "Completed / Blocked"     not "Deployed / Shipped"
  ✓ "Site inspection"          not "Pull request"
  Works for construction companies, not just software teams
```

### Sanad Brain + LLM Router
**Status:** 📐 Decided — build in Phase 2  

The LLM Router is a Python FastAPI service. Every agent calls one endpoint. The router decides which model to use based on:
- Company configuration
- Agent role (CEO agent → best model, employee agent → cheaper model)
- Eval Engine routing table (updated automatically by model comparison)

```python
# Single interface for all agents
POST /api/llm/complete
{
  "agent_id": "ceo-twin",
  "company_id": "accubuild",
  "skill": "invoice_processing",
  "prompt": "..."
}

# Supported models
Claude    (Anthropic)  — best reasoning, long context
GPT-4     (OpenAI)     — broad capability, tool use
Gemini    (Google)     — multimodal, fast
GLM-4     (Zhipu)      — good score/cost ratio
Ollama    (local)      — on-premise, zero cost, full privacy

# Fallback chain
Claude → GPT-4 → Gemini → Ollama
```

### Mentor Layer
**Status:** 📐 Designed — build in Phase 5  
**Unique:** No open-source equivalent exists (confirmed via GitHub research)

Each domain agent (AP, HR, Inventory, etc.) is paired with a Mentor agent modeled after a senior human in that role.

```
Mentor watches every tool call the domain agent makes
        ↓
Logs corrections and observations
        ↓
Builds style fingerprint stored in Qdrant
        ↓
Transfers reasoning patterns via memory retrieval (not fine-tuning)
        ↓
Trust scoring system:
  trainee mode    → Mentor reviews every action
  intermediate    → Mentor reviews important actions
  graduate        → Agent operates autonomously
        ↓
Graduation trigger: Eval Engine trust_score >= threshold
Coaching trigger:   Eval Engine detects skill regression
```

---

## 9. Agent Architecture

### Multi-Agent Patterns (All Decided — Build Phase 5)

#### Pattern 1: Maker → Checker
```
Maker Agent  →  works in own sandbox microVM
                writes output to shared volume
                ↓
Checker Agent → reads shared output volume (READ-ONLY)
                approves or sends back to Maker
                ↓
Human         → reviews approved output
                approves → MCP → real ERP
                rejects → back to Maker
```

#### Pattern 2: Parallel Makers
Multiple agents work on the same task simultaneously in separate sandboxes. Results compared. Best output wins. Checker reviews the winner.

#### Pattern 3: Supervisor Agent
Watches all agents. Reads output volumes only. Lives in Sanad server — **no sandbox**. No direct ERP access ever.

#### Pattern 4: Agent Handoff
```
Agent A  →  writes result.json to output volume
Agent B  →  mounts result.json as READ-ONLY input
            continues the work chain
```

#### Pattern 5: Escalation Chain
```
Agent nudges human × 2
        ↓ (no response)
Escalates to dept agent
        ↓ (no action)
Dept agent alerts manager
        ↓ (no action)
CEO agent flags
        ↓
CEO sees in dashboard + notification
```

### LLM Models

| Model | Provider | Best For | Cost |
|---|---|---|---|
| Claude Sonnet | Anthropic | Reasoning, long context | $$ |
| GPT-4o | OpenAI | Broad capability, tools | $$ |
| Gemini 2.0 Flash | Google | Multimodal, speed | $ |
| GLM-4 | Zhipu | Cost-efficient tasks | $ |
| Llama 3.3 / Mistral | Ollama (local) | Privacy-sensitive, free | $0 |

**Rule:** Agents never have a hardcoded model. Always go through LLM Router.

---

## 10. Sandbox Infrastructure

### The Sandbox Concept

Every agent task runs in an **ephemeral isolated environment**:

```
Task arrives
     ↓
Provisioner API spins up:
  - Isolated microVM (own kernel, no shared host)
  - Masked clone of ERPNext (real structure, fake PII)
  - Agent works freely inside
     ↓
Output written to shared volume
     ↓
Checker reviews output
     ↓
Human approves
     ↓
MCP pushes ONLY the approved diff → real ERP
     ↓
Sandbox destroyed (both containers)
No trace left
```

### Sandbox Engine

| Stage | Tool | Notes |
|---|---|---|
| **Prototype** | E2B Cloud | Apache-2.0, free $100 credit, ~200ms startup |
| **Production** | Microsandbox on Hetzner | Apache-2.0, libkrun microVMs, own kernel per agent |

SDK interface is identical between E2B and Microsandbox. **Zero agent code change** when switching.

### Provisioner API

```python
POST /api/sandbox/create
  body: { task_id, company, agent_role }
  returns: {
    sandbox_id: "task-001",
    internal_url: "http://sandbox-task-001:8080",  # agent uses this
    output_url: "https://output-task-001.sandbox.sanadai.com",  # human reviews here
    grafana_url: "https://grafana.sanadai.com/d/sandbox?var-id=task-001",
    status: "ready"
  }

DELETE /api/sandbox/{task_id}
  → destroys both internal sandbox and public output container
  → Traefik automatically removes route
  → No DNS cleanup needed
```

### Data Masking Pipeline

```
Production ERPNext
      ↓
bench backup --with-files --compress
      ↓
Greenmask (Apache-2.0):
  MASKS:  employee names, salaries, national IDs
          customer names, phones, emails
          supplier bank details
          user passwords
  KEEPS:  invoice amounts and dates
          stock quantities
          project structures and workflows
          chart of accounts
          all relationships and foreign keys
      ↓
frappe_docker spins ERPNext clone
      ↓
bench restore masked-data.sql.gz
bench migrate
bench clear-cache
      ↓
Agent gets realistic ERPNext with no real PII
```

### Dev Clone Environment

For developers (not agents):

```bash
# One command — full Sanad with all services
make dev-up

# What starts:
# PostgreSQL    → seed.sql (fake companies, users, tasks)
# ERPNext       → masked-demo.sql.gz (committed to git, refreshed periodically)
# Qdrant        → empty (rebuilds as agents run)
# Redis         → empty (ephemeral)
# Sanad app     → hot reload on code change

# Access: https://eslam.dev.sanadai.com

make dev-down   # stop
make reset      # wipe and restart fresh
make refresh-erp  # pull new masked ERPNext data from production
```

### RAM Budget on Hetzner 16GB

```
Traefik + Portainer           ~300MB
Prometheus + Grafana          ~500MB
cAdvisor + node-exporter      ~200MB
PentAGI stack                 ~4GB
Sanad + ERPNext (existing)    ~6GB
Eval Engine + DeepEval        ~1GB
Free headroom                 ~4GB
                              ──────
Total                          16GB ✅
```

---

## 11. CI/CD + QA Pipeline

### The Self-Build Loop

Sanad uses its own agent + sandbox to build Sanad. This is called **dogfooding with agents**.

```
Eslam creates GitHub issue (or SRS document)
        ↓
OpenHands coding agent picks it up
        ↓
Gets dev clone sandbox from Provisioner API
        ↓
Reads issue + SRS → writes code
        ↓
QA Agent triggers (GitHub Actions)
        ↓
Level 1: pytest / vitest — unit tests (seconds)
Level 2: API integration tests (minutes)
Level 3: Playwright E2E browser tests (minutes)
All run in dev clone sandbox
        ↓
Eval Engine also triggers:
  - quality_score before vs after
  - cost delta
  - latency delta
        ↓
✅ All pass → PR marked "QA Approved + Eval: PROMOTE"
❌ Any fail → agent auto-fixes → re-runs
        ↓
Eslam reviews clean PR → merges
        ↓
CI/CD deploys to staging → production
```

### The Critical Rule

> **Agents never build the safety layer.**  
> Phase 2 (Permissions + SOD + LLM Router) = built by humans.  
> Everything after Phase 2 = agents can build.  
> The permission system governs agents. Agents cannot govern themselves.

### Tools

| Layer | Tool | License |
|---|---|---|
| Coding agent | OpenHands (MIT, 65k⭐) | MIT |
| Unit tests | pytest (Python) + vitest (TypeScript) | MIT |
| E2E tests | Playwright (Microsoft) | MIT |
| Eval quality | DeepEval | Apache-2.0 |
| CI/CD trigger | GitHub Actions | — |
| Sandbox | Dev clone (docker-compose.dev.yml) | — |

---

## 12. ERP Connectors — MCP Layer

### The Rule
> **Agents NEVER touch ERP directly. Every ERP action goes through Sanad MCP. Always.**

The MCP layer is the only door. Agents propose changes. Humans approve. MCP pushes the approved diff.

### Connector Status

| ERP | Status | Company |
|---|---|---|
| ERPNext | ✅ Live today | AccuBuild |
| Odoo | ⚠️ Confirm status | Sales Force App (TBD) |
| SAP | 📋 Phase 6 | Large enterprise expansion |
| MS Dynamics | 📋 Phase 6 | Microsoft ecosystem companies |
| Custom ERP | 📋 Phase 6 | Client-specific via MCP adapter |

---

## 13. Build Sequence — Phase by Phase

### Phase 0 — Done ✅
- Paperclip core running on Hetzner
- ERPNext + MCP connector active (AccuBuild)
- All SRS documents written
- All UI mockups designed
- Build sequence confirmed

### Phase 1A — Infrastructure Monitoring
**Deploy today on Hetzner**

```bash
# Start monitoring stack
cd /opt/sanad && docker compose up -d

# Services started:
# Traefik v3      → handles all 3 DNS zones, auto SSL
# Portainer       → portainer.sanadai.com
# Prometheus      → metrics collection
# Grafana         → grafana.sanadai.com (import dashboards 1860, 893, 14282)
# cAdvisor        → Docker container metrics
# node-exporter   → Hetzner server metrics
# AlertManager    → alerts to channel
```

### Phase 1B — Security Scanning
**Deploy same day as 1A**

```bash
cd /opt/sanad/pentagi
# Edit .env: set ANTHROPIC_API_KEY + PUBLIC_URL
docker compose up -d
# Access: pentagi.sanadai.com
```

### Phase 1C — Evaluation Engine
**SRS to write first, then build alongside 1A+1B**

- Deploy Eval Engine service + DeepEval sidecar
- Configure change detection triggers
- Connect to PostgreSQL (baseline storage)
- Connect to Qdrant (skill vectors)
- Wire output into LLM Router (routing table)
- Wire output into Mentor (graduation triggers)

### Phase 2 — Safety Core
**Built by humans — governs all future agents**

- Implement Permission System (SRS already written, 18 tests)
- Build LLM Router (Python FastAPI, 4+ models)
- Set up QA + Eval pipeline on GitHub Actions
- PentAGI scans all new endpoints

### Phase 3 — Sandbox Infrastructure

- Wire E2B SDK into Sanad (Python)
- Build Provisioner API (POST + DELETE endpoints)
- Build data masking pipeline (Greenmask + frappe_docker)
- Set up dev clone environment (docker-compose.dev.yml)
- Verify 3-zone URLs work (dev + sandbox zones)

### Phase 4 — Agents Build Sanad

- Deploy OpenHands on Hetzner (self-hosted)
- Connect OpenHands → LLM Router → Claude (default)
- Create first GitHub issues from SRS documents
- OpenHands builds: ShipLog backend
- OpenHands builds: Whisper STT voice integration
- QA Agent tests every PR
- Eval Engine judges every PR

### Phase 5 — Full Product

- Twin Agent first implementation (full loop: human → agent → sandbox → output URL → approve → MCP → ERP)
- Mentor Layer (Eval Engine feeds it graduation signals)
- All 5 multi-agent patterns active
- ShipLog live for all teams
- Upgrade to Microsandbox on Hetzner (swap from E2B)
- Multi-company CEO view live

### Phase 6 — Full ERP Expansion

- Odoo MCP connector
- SAP connector
- MS Dynamics connector
- All companies fully onboarded
- Cross-company CEO dashboard

---

## 14. Open Gaps

| # | Gap | Impact |
|---|---|---|
| 1 | **Other companies?** You selected "other companies not mentioned" — list them | Affects multi-tenant architecture scope |
| 2 | **Odoo status** — live today or still planned? | Affects what's shown as "built" in MCP layer |
| 3 | **LLM default per company** — Claude API? Local Ollama? Switchable? | Affects cost, privacy, compliance decisions |
| 4 | **Mobile app** — React Native planned or web-only (PWA)? | Affects voice capture + ShipLog design |
| 5 | **Evaluation Engine SRS** — needs to be written before Phase 1C build | Blocks Phase 1C |

---

## 15. Design Principles

These principles were established and confirmed across all sessions. They do not change without a deliberate decision.

### Architecture Principles

1. **The ERP is infrastructure. Sanad is the operating layer on top.**  
   Sanad doesn't replace ERPs. It makes them accessible to agents and humans through a unified operating layer.

2. **Agents propose. Humans approve. Always.**  
   No agent action reaches production without passing through: Maker → Checker → Human → MCP.

3. **Nothing touches production until it passes the full chain.**  
   Agent works on masked clone. Output written to shared volume. Checker reviews. Human approves. Only then does MCP push the diff.

4. **Agents never build the safety layer.**  
   The permission system that governs agents must be built by humans first. Agents cannot be trusted to build the rules that govern themselves.

5. **Never locked to one model.**  
   LLM Router abstracts all models. Eval Engine auto-routes to cheapest model meeting quality threshold. Zero agent code changes when swapping models.

### Data Principles

6. **Additive-only DB migrations.**  
   Never drop or modify existing columns. Always add. Rollback-safe.

7. **Masked data for all non-production environments.**  
   No real PII ever leaves production. Names/phones/bank details → fake. Amounts/structures/workflows → real.

8. **PostgreSQL is the single source of truth.**  
   Both Monitoring and Eval Engine read from PostgreSQL. Never duplicate data between stores.

### Security Principles

9. **On-premise first. Data never leaves your servers.**  
   All services run on Hetzner. Cloudflare DNS-only (grey cloud) for dev + sandbox zones. PentAGI scans before agents go live.

10. **Sandbox isolation before any agent touches real data.**  
    Every agent task gets its own microVM with its own kernel. If a sandbox is compromised, blast radius is limited to that VM only.

11. **Use tools as-is before modifying them.**  
    PentAGI: run via Docker REST API, never fork. Microsandbox: use Apache-2.0 version. Avoid AGPL dependencies in commercial product.

### Development Principles

12. **Two languages only: TypeScript + Python.**  
    TypeScript for frontend + API. Python for agents + AI layer. No new languages without deliberate team decision.

13. **Each phase ships something usable.**  
    No phase produces only infrastructure that sits idle. Phase 1A → Grafana works. Phase 1B → PentAGI scans. Phase 2 → permissions enforced. Every phase = usable product.

14. **SRS documents are agent task specifications.**  
    Every well-written SRS with acceptance criteria becomes a task for the OpenHands coding agent. Write good specs = agents build it correctly.

15. **Monitoring (passive) ≠ Evaluation (active). Never mix them.**  
    Monitoring watches what's happening. Evaluation judges if a change is good or bad. Separate stacks, separate triggers, separate purposes.

---

*This document is maintained in the Sanad project repository under `/docs/KNOWLEDGE_BASE.md`. Update it whenever a significant architectural decision is made or changed.*

---

## 16. Repository & Local Setup (For Claude)

> This section is written for Claude. Read this at the start of every session.

### Repo Locations (Local Machine)

| Folder | Purpose |
|---|---|
| `/home/eslam/data/projects/Sanad EOI - Production/paperclip` | **Production codebase** — this is what runs on Hetzner |
| `/home/eslam/data/projects/Sanad EOI - Development/paperclip` | Development copy — safe to experiment |
| `/home/eslam/data/projects/Sanad EOI - Production/sanad-brain` | Sanad Brain source code |
| `/home/eslam/data/projects/Sanad EOI - Production/sanad-brain-mcp` | Sanad Brain MCP server |
| `/home/eslam/optiflow/` | Agent crew configs, memory, knowledge, tools |

### Git Remote

```
origin  → https://github.com/elgogary/sanad-eoi-main-app.git
branch  → main-sanad-eoi-app (our only branch — no upstream sync)
```

### Production Server

| What | Value |
|---|---|
| Host | `65.109.65.159` (Hetzner) |
| URL | `http://100.109.59.30:3100` |
| SSH | `ssh eslam@65.109.65.159` |
| Stack | Docker Compose |
| Backup | **Always run before deploy**: `ssh eslam@65.109.65.159 "bash /home/eslam/docker-backups/pre-deploy-backup.sh"` |

### Deploy Commands

```bash
# Build and deploy server only
ssh eslam@65.109.65.159 "cd ~ && docker compose build server && docker compose up -d --no-deps server"

# Check logs
ssh eslam@65.109.65.159 "docker compose logs -f server | tail -20"

# Pre-deploy verification (run locally first)
./scripts/pre-deploy.sh
```

### Key Rules (Never Break These)

1. **Always backup before deploy** — Docker rebuilds have caused data loss before
2. **Never modify these files during refactors**: `sanad-brain.ts`, `scheduler-loop.ts`, `scheduled-job-executors.ts`
3. **File size gate**: >700 lines → split first using `$` bag pattern
4. **docker-compose.yml volume paths are absolute** — update if folder moves
5. **Adding a new board page requires TWO steps**: Route in `App.tsx` + add to `BOARD_ROUTE_ROOTS` in `company-routes.ts`
6. **All user-facing strings must use `__()`** — i18n is mandatory
7. **No upstream sync** — we cherry-pick manually only when needed

### Running Locally

```bash
cd "/home/eslam/data/projects/Sanad EOI - Development/paperclip"
pnpm install
cp .env.example .env  # fill in values
pnpm db:migrate
pnpm dev              # starts on :3100
```

### Environment Variables (Key ones)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `ANTHROPIC_API_KEY` | Claude API key |
| `SANAD_BRAIN_URL` | Sanad Brain API URL |
| `SANAD_BRAIN_API_KEY` | Sanad Brain auth key |
| `MINIO_ENDPOINT` | MinIO S3 endpoint |
| `JWT_SECRET` | Auth token signing |
| `AUTH_PUBLIC_BASE_URL` | Public URL (e.g. http://100.109.59.30:3100) |

---

## 17. Agent Crew — Optiflow (For Claude)

> The agent crew we operate via the Sanad platform.

### Company
- **Name**: Optiflow Systems AI Crew
- **Short**: OPT
- **UI**: http://100.109.59.30:3100/OPT/
- **Configs**: `/home/eslam/optiflow/.agents/`

### 9 Agents

| Agent | Role | Adapter |
|---|---|---|
| CEO | Strategy, budgets, team coordination | Claude Code |
| TechLead (CTO) | Architecture, code review, standards | Claude Code |
| BackendEngineer | Frappe/Python, APIs, TDD | Claude Code |
| FrontendEngineer | React, design, accessibility | Claude Code |
| SalesManager | Pipeline, deals, revenue | Claude Code |
| SalesRep1 | Prospecting, demos, closing | Claude Code |
| ProductManager | AccuBuild roadmap, beta, metrics | Claude Code |
| BetaTester (QA) | Testing, bug discovery, feedback | Claude Code |
| DevOps | Deployments, infrastructure, monitoring | Claude Code |

### Task Routing

| Request Type | Route To |
|---|---|
| Sales/leads/proposals | SalesManager or SalesRep1 |
| Code/architecture/review | TechLead → BackendEng or FrontendEng |
| Product/roadmap/beta | ProductManager → BetaTester |
| Deploy/infra/monitoring | DevOps |
| Strategy/planning/hiring | CEO |
| Escalation from any agent | CEO → Board (Eslam) |

### Board Authority (Eslam)
- Approves: hiring >$50k, deals >$100k, product pivots
- Can override any agent decision
- Weekly CEO report review

---

## 18. Sanad Brain (For Claude)

### What It Is
RAG-powered memory system. Agents store and retrieve knowledge, decisions, and patterns across sessions.

### MCP Tools Available
| Tool | When to Use |
|---|---|
| `recall` | Start of session — load relevant past context |
| `remember` | After bug fix, architecture decision, deployment, lesson learned |
| `remember_fact` | Single atomic fact with scope |
| `forget` | Remove wrong or outdated memory |
| `memory_stats` | Check memory usage |

### Memory Rules
- Use `scope: "company"` for team knowledge, `"private"` for personal prefs
- Prefix: `LESSON:`, `FACT:`, `DECISION:`, `PATTERN:`, `EVENT:`
- One fact per `remember` call, 1-3 sentences max
- Never store credentials or secrets

### Brain API
- URL: set in `SANAD_BRAIN_URL` env var
- Proxy: `server/src/routes/sanad-brain.ts` — all `/brain/*` requests proxied here
- **Do NOT modify this file during refactors**

---

*Last updated: 2026-03-28. Update this file whenever significant decisions are made.*

# Capabilities Swarm — Design Document

**Date:** 2026-03-26
**Status:** Approved (prototype reviewed)
**Prototype:** `docs/prototypes/capabilities_swarm_prototype.html`

## What It Is

A unified capability marketplace + autonomous learning system for Sanad AI EOI agents. Agents discover, pull, evaluate, and learn capabilities (skills, MCP servers, connectors, plugins) from external sources — with a dedicated Director agent that mentors and curates.

## Architecture — 3 Layers

```
┌─────────────────────────────────────────────────────┐
│  LAYER 3: SWARM DIRECTOR (Sanad AI EOI Agent)          │
│  Mentoring, knowledge graph, proactive recs,        │
│  cross-agent knowledge transfer                     │
├─────────────────────────────────────────────────────┤
│  LAYER 2: BRAIN DISCOVERY TOOLS (Sanad Brain MCP)   │
│  swarm_discover, swarm_analyze, swarm_pull,         │
│  swarm_evaluate, swarm_feedback                     │
├─────────────────────────────────────────────────────┤
│  LAYER 1: SWARM INFRASTRUCTURE (Sanad AI EOI Server)   │
│  Registry, source adapters, pull pipeline,          │
│  trust engine, install flow, UI                     │
└─────────────────────────────────────────────────────┘
```

## The Autonomous Learning Loop

```
AGENT (working on task)
  │
  ├─ Identifies capability gap ("I don't know how to do X")
  │      │
  │      ▼
  │  SWARM DISCOVERY (Brain MCP tools)
  │  → Search registries for X
  │  → AI analyzes best match
  │  → Pull & adapt capability
  │      │
  │      ▼
  │  SELF-EVALUATION
  │  → Try capability on subtask
  │  → Score: did it work? (1-10)
  │  → What went wrong/right?
  │      │
  │      ▼
  │  Resume original task (with new capability)
  │      │
  │      ▼
  │  FEEDBACK → Swarm Director
  │  "I pulled X, it scored 8/10, here's what happened"
  │
  ▼
SWARM DIRECTOR
  │
  ├─ Receives feedback from ALL agents
  ├─ Tracks: which capabilities work, which don't
  ├─ Mentor: "Next time try Y instead of X"
  ├─ Curates: promotes good capabilities, demotes bad
  ├─ Proactive: "Agent Z, you should learn skill W"
  │
  └─ EVALUATION LOOP (mentor ↔ student)
       Director evaluates agent's capability usage
       Agent evaluates Director's recommendations
       Both improve over time
```

## Capability Types

| Type | Source Format | Install Action |
|---|---|---|
| Skill | Markdown (.md) | Save to company_skills table |
| MCP Server | JSON config + Docker/npx | Save to mcp_servers table, start process |
| Connector | API config + credentials | Save to connectors table, store secrets |
| Plugin | JS bundle + manifest | Save to plugins table, load UI + routes |

## Source Adapters (Expandable from UI)

| Source | Method | Trust Default |
|---|---|---|
| /workspace/skills (local) | Filesystem scan | Trusted |
| mcpservers.org | Scrape + cache | Verified |
| mcpserverhub.com | Scrape + cache | Verified |
| GitHub public repos | API + README parse | Community |
| npm packages | Registry API | Community |
| Private repos | Git clone + manifest | Trusted |
| Custom URLs | Fetch + AI parse | Unknown |
| Peer Swarms (future) | Federation API | Configurable |

## Trust Engine (Configurable Rules)

| Trust Level | Default Behavior | Configurable |
|---|---|---|
| Trusted (your repos) | Auto-install, log only | Can require approval |
| Verified (official registries) | Auto-install with notification | Can require approval |
| Community (public repos) | Agent installs, board notified, can revoke | Can require approval |
| Unknown (raw URLs) | Requires board approval | Can allow auto-install |

Rules are per-company, per-role, per-capability-type.

## Swarm Director — Agent Design

### Identity
- **Name:** Swarm Director
- **Role:** Capability Curator & Agent Mentor
- **Reports to:** CEO (in the org chart)
- **Lives in:** Sanad AI EOI as a regular agent
- **Tools:** Brain MCP discovery tools + Sanad AI EOI API

### Responsibilities
1. **Reactive**: Process feedback from agents, update knowledge graph
2. **Proactive**: Scan agent task patterns, recommend capabilities before they're needed
3. **Curative**: Track capability quality scores, promote/demote/retire capabilities
4. **Mentoring**: Coach agents on better capability choices, cross-pollinate learnings

### Capability Knowledge Graph (stored in Sanad Brain)
```
Agent Competency Map:
┌──────────────┬──────────────┬───────────┬──────────┬─────────┐
│ Agent        │ Capability   │ Proficiency│ Score    │ Last Use│
├──────────────┼──────────────┼───────────┼──────────┼─────────┤
│ TechLead     │ code-review  │ Expert    │ 9.2/10   │ Today   │
│ BackendEng   │ bug-fix      │ Expert    │ 8.8/10   │ Today   │
│ FrontendEng  │ playwright   │ Expert    │ 9.0/10   │ Yest.   │
│ SalesRep     │ gmail-conn   │ Competent │ 7.5/10   │ 3h ago  │
└──────────────┴──────────────┴───────────┴──────────┴─────────┘
```

## Brain MCP Tools (Phase 2)

| Tool | Purpose | Called By |
|---|---|---|
| `swarm_discover` | Search registries by NL query | Any agent |
| `swarm_analyze` | AI evaluates capability fit + compatibility | Any agent |
| `swarm_pull` | Pull and adapt into the system | Any agent (trust engine gates) |
| `swarm_evaluate` | Agent self-scores after using a capability | The agent that pulled it |
| `swarm_feedback` | Report evaluation to Director | Any agent → Director |
| `swarm_recommend` | Director suggests capability to an agent | Director only |
| `swarm_knowledge` | Query the capability knowledge graph | Director + Board |

## Swarm Economics Engine

### The Investment Equation

```
INPUT (Cost)                          OUTPUT (Value)
════════════════════                  ════════════════════
Tokens consumed (discovery,           Capability acquired
  analysis, adaptation)                 (skill/MCP/connector/plugin)

Agent time (opportunity cost)         Agent performance delta
                                        (how much better after)

Money (paid capabilities,             Knowledge base growth
  API costs)                            (patterns, learnings,
                                         cross-agent transfers)
```

### Cost Model: Ledger + Market Hybrid

Every Swarm interaction creates a **SwarmTransaction**:

```
SwarmTransaction {
  id, timestamp, companyId, agentId

  // COST SIDE
  tokensConsumed: 45200        // actual LLM tokens
  timeSpentMinutes: 12         // wall-clock in Swarm
  directCostUsd: 0.03          // token cost at model rate
  licenseCostUsd: 12.00        // paid capability monthly
  totalCostUsd: 12.03          // direct + license

  // VALUE SIDE
  capabilityId, capabilityType
  action: "acquire" | "use" | "share" | "evaluate"
  reuseCount: 8                // times used after acquire
  timeSavedMinutes: 240        // vs doing it manually
  agentsBenefited: 3           // cross-agent transfers
  qualityScore: 8.5            // self-eval + Director eval
  knowledgeEntries: 2          // patterns/learnings created
  estimatedValueUsd: 47.20     // (timeSaved * agentHourlyRate) + knowledge
  roi: 3.93                    // value / cost
}
```

### Market Dynamics

Capabilities get quality-adjusted pricing over time:

```
CapabilityMarketData {
  basePrice: 12.00             // original price (free = 0)
  marketPrice: 10.50           // adjusted by quality + demand

  // Quality signals (affect price)
  avgQualityScore: 8.5         // across all agent evals
  totalInstalls: 23            // adoption
  avgRoi: 3.9x                // average return
  failureRate: 0.02            // how often it breaks

  // Market rules:
  // - High quality (>8) + high demand → price drops
  // - Low quality (<5) → price increases (warning)
  // - Zero usage 30 days → flagged for removal
  // - Negative ROI → auto-disabled
}
```

### Budget System (Tiered Visibility)

```
BOARD (Multi-tenant admin)
├── Sees: All companies, total Swarm spend, cross-company trends
│
└── CEO + COMPANY ADMIN
    ├── Sees: Full dashboard (Economics tab) — all agents, ROI leaderboard,
    │         knowledge graph, market prices, transaction ledger
    ├── Controls: Company Swarm budget, agent allowances, approval rules
    │
    └── AGENTS (each agent)
        ├── Sees: Own budget remaining, own cost history, catalog with prices
        ├── Decides: Which capabilities to acquire (within budget)
        └── Reports: Self-evaluation after using capability
```

Budget allocation:
```
Company Budget ($5,000/mo)
  └── Swarm Budget ($1,200/mo)
        ├── TechLead: 400K tokens + $200 paid caps
        ├── BackendEng: 300K tokens + $150 paid caps
        ├── FrontendEng: 200K tokens + $100 paid caps
        ├── SalesManager: 100K tokens + $50 paid caps
        ├── Swarm Director: 200K tokens (analysis/mentoring)
        └── Reserve: $100 (overflow)
```

### Capability Pricing

| Pricing Tier | Examples | Who Pays |
|---|---|---|
| Free | Open source skills, community MCP servers | Only token/time cost |
| Paid ($5-50/mo) | Premium MCP servers, licensed connectors | Agent's Swarm budget |
| Premium ($50+/mo) | Enterprise connectors, full plugin suites | Company Swarm budget |
| Generated (free) | AI-created companion skills, auto-configs | Only AI analysis cost (~$0.03) |

## UI Pages (Prototype: capabilities_swarm_prototype.html)

1. **Catalog** (`/OPT/swarm`) — Browse capabilities with search, filters, trust + price badges
2. **Sources** (`/OPT/swarm/sources`) — Manage registry sources
3. **Queue** (`/OPT/swarm/queue`) — Agent approval requests with cost column
4. **Audit** (`/OPT/swarm/audit`) — Full history of installs, removals, evaluations
5. **Economics** (`/OPT/swarm/economics`) — Investment vs Return dashboard, ROI leaderboard, transaction ledger
6. **Agent Budgets** (`/OPT/swarm/budgets`) — Per-agent allowances, spend, proficiency, Director recommendations

## Implementation Phases

### Phase 1: Swarm Infrastructure (Sanad AI EOI Server)
- [ ] DB tables: swarm_sources, swarm_capabilities, swarm_installs, swarm_transactions
- [ ] Source adapters: local filesystem, mcpservers.org scraper, mcpserverhub.com scraper
- [ ] Pull pipeline: fetch → parse → validate → store
- [ ] Trust engine with configurable rules
- [ ] REST API endpoints for all swarm operations
- [ ] UI: Catalog, Sources, Queue, Audit pages
- [ ] Install flow wizard (from prototype)
- [ ] Pricing: free/paid/premium tags on capabilities
- [ ] Budget bar on catalog page

### Phase 2: Swarm Economics Engine (Sanad AI EOI Server)
- [ ] SwarmTransaction ledger (tokens, time, money, value)
- [ ] Agent budget allocation system (tokens + money per agent)
- [ ] CapabilityMarketData: quality-adjusted pricing
- [ ] ROI calculation: value / cost per capability and per agent
- [ ] Economics dashboard (Investment vs Return, ROI leaderboard, ledger)
- [ ] Agent Budgets page (per-agent cards with proficiency)
- [ ] Tiered visibility: agents see own, CEO sees all, Board sees cross-company

### Phase 3: Brain Discovery Tools (Sanad Brain MCP)
- [ ] swarm_discover tool — NL search across all registries
- [ ] swarm_analyze tool — AI compatibility assessment
- [ ] swarm_pull tool — pull + adapt with trust engine gate + budget check
- [ ] swarm_evaluate tool — self-scoring framework
- [ ] swarm_feedback tool — structured feedback to Director
- [ ] Integration with Sanad Brain memory for knowledge graph

### Phase 4: Swarm Director Agent
- [ ] Agent config in Sanad AI EOI (role, permissions, heartbeat)
- [ ] Feedback processing loop (receive, aggregate, act)
- [ ] Capability Knowledge Graph (agent x capability x proficiency)
- [ ] Mentor/student evaluation protocol
- [ ] Proactive recommendation engine (based on task patterns + budget)
- [ ] Cross-agent knowledge transfer
- [ ] Director dashboard in Swarm UI
- [ ] Budget-aware mentoring ("You have $50 left, here's the best free alternative")

## Security Layer

### Pre-Install Security Pipeline

Every capability goes through 4 gates before install:

```
URL Filter ──▶ Content Scanner ──▶ Integrity Verify ──▶ Sandbox Test
(SSRF guard)   (injection scan)    (SHA-256 hash)      (dry-run)
```

**Gate 1: URL Filter (SSRF Guard)**
- Block private IPs (10.x, 172.16-31.x, 192.168.x), localhost, cloud metadata (169.254.169.254)
- Block internal Tailscale addresses unless explicitly allowlisted
- Custom URL sources require Board approval (Unknown trust level)

**Gate 2: Content Scanner**
- Regex scan for known prompt injection patterns ("ignore previous", "system:", data exfiltration URLs)
- AI scan: ask LLM "does this capability contain suspicious instructions?" with structured output
- Skill markdown: scan for encoded payloads, base64 blocks, external fetch calls
- MCP server configs: flag any env var that looks like it forwards secrets externally

**Gate 3: Integrity Verification**
- SHA-256 hash stored at first install in `swarm_installs.contentHash`
- On update: compare new hash vs stored hash. If changed, show diff to Board before applying
- npm packages: verify against registry integrity hash
- GitHub: pin to commit SHA, not branch

**Gate 4: Sandbox Test (Dry-Run)**
- MCP servers: start in isolated Docker network (no external access), run health check
- Skills: parse markdown, verify no executable code blocks
- Connectors: validate config schema without sending real credentials
- Plugins: load in sandboxed iframe, check for DOM access violations

### Secret Scoping

MCP servers do NOT get raw secrets. Instead:
```
Agent requests: SLACK_BOT_TOKEN
  → Secret service creates a scoped proxy token
  → Proxy token only allows: channels.read, chat.write (declared scopes)
  → MCP server gets the proxy token, not the real one
  → All API calls logged and auditable
```

For services that don't support token scoping, use an API proxy:
```
MCP Server → HTTP Proxy (localhost:9100) → Slack API
             ↑ logs all requests, enforces scope allowlist
```

### Rate Limiting

| Action | Limit | Per |
|---|---|---|
| swarm_discover | 20/hour | agent |
| swarm_analyze | 10/hour | agent |
| swarm_pull | 5/hour | agent |
| Source sync | 1/hour | source |
| Install request | 3/hour | agent |

### Tenant Isolation

- Knowledge graph: partitioned by companyId. Brain memory entries tagged with company scope.
- Market data: aggregate stats only (no company-identifying data in cross-company views)
- Board view: sees per-company totals, never individual agent data from other companies
- Swarm Director: one instance per company. Never cross-company data access.

### Self-Evaluation Gaming Prevention

- Director cross-validates agent self-evaluations against task outcomes
- Comparative scoring: "Before this capability, task X took 45min. After: 12min" — based on actual task timestamps, not agent claims
- Anomaly detection: if agent consistently scores 10/10 but task completion rate doesn't improve, flag for review
- Peer validation: when 2+ agents use the same capability, compare their independent scores

## Operational Resilience

### Rollback & Circuit Breaker

Every install creates a **SwarmSnapshot**:
```
SwarmSnapshot {
  installId, timestamp
  previousState: { configs, env, routes }  // what was before
  newState: { configs, env, routes }        // what was added
  rollbackCommand: "..."                    // how to undo
}
```

- "Revert" button in Audit UI — one-click rollback to snapshot
- MCP servers: health check endpoint every 30s. 3 consecutive failures → auto-disable + notify Director
- Circuit breaker: disabled capability enters 5-min cooldown before retry
- Kill switch: Board can disable ALL Swarm installs instantly from Settings

### Source Downtime Handling

- All source metadata cached in `swarm_capabilities` table
- Cache TTL: 1 hour for Verified sources, 6 hours for Community
- If source returns error: serve from cache, show "Last synced X ago" warning
- Stale cache (>24h): show warning badge on affected capabilities
- Total source failure: discovery still works against cached data

### Monitoring & Alerts

| Trigger | Alert To | Action |
|---|---|---|
| Swarm budget > 80% | Agent | Warn in UI |
| Swarm budget > 95% | CEO | Email/notification |
| Capability ROI < 0 for 7 days | Director | Auto-disable |
| Capability quality < 4/10 | Director | Flag for review |
| MCP health check fails 3x | Director + Board | Auto-disable + snapshot |
| Director heartbeat miss (15 min) | Board | Alert + auto-restart |
| Agent discovery rate > 15/hour | Director | Throttle + investigate |
| Install failure rate > 50% | Board | Pause all installs |

### Director Scaling

- Feedback queue: Postgres-backed job queue (reuse existing scheduled_jobs infrastructure)
- Director processes feedback in batches (every 5 min or 10 items, whichever first)
- One Director instance per company (not shared)
- Future: Director can delegate sub-tasks to other agents for evaluation

### Disaster Recovery

| Data | Storage | Backup |
|---|---|---|
| Transaction ledger | Postgres | Covered by DB backups (hourly) |
| Swarm capabilities cache | Postgres | Covered by DB backups |
| Knowledge graph | Sanad Brain | Brain has own persistence + nightly JSON export |
| Install snapshots | Postgres + S3 | S3 lifecycle: 90-day retention |
| Source configs | Postgres | Covered by DB backups |

Recovery procedure:
1. Restore Postgres from backup → transaction ledger + configs restored
2. Import Brain JSON export → knowledge graph restored
3. Run `swarm_sync_all` → re-cache all source metadata
4. Director resumes from last processed feedback item

## Technical Rigor

### Value Estimation: Comparative Method

Do NOT trust agent self-reported "time saved." Instead:

```
BEFORE capability acquired:
  Agent completed 5 similar tasks
  Average time: 45 minutes

AFTER capability acquired:
  Agent completed 5 similar tasks
  Average time: 12 minutes

Measured time saved: 33 min/task
Value per use: 33 min × ($50/hr agent rate) = $27.50
```

- Track actual task completion times from Sanad AI EOI issue timestamps
- Compare same-type tasks before vs after capability acquisition
- Director cross-validates by comparing agents who have the capability vs those who don't
- First 30 days: value marked as "estimated." After 30 days: based on real data.

### Skill Table Unification

```
company_skills    → SOURCE OF TRUTH for installed capabilities (all types)
swarm_capabilities → CACHE of registry metadata (not installed, browsing only)
skills (old table) → DEPRECATED, migrate existing 119 rows to company_skills
```

Migration plan:
1. Phase 1: both tables coexist (already done — normalizeSkill adapter)
2. Phase 2: migration script moves `skills` rows to `company_skills` with type mapping
3. Phase 3: drop old `skills` table, remove `skillRoutes`, remove normalizeSkill adapter

### MCP Server Process Lifecycle

```
Install:
  1. Pull container image / npm package
  2. Create Docker container with resource limits:
     - Memory: 256MB max
     - CPU: 0.5 cores
     - Network: isolated bridge (no host network)
     - Volumes: read-only workspace access only
  3. Start container, wait for health check (30s timeout)
  4. Register in process_registry table
  5. Connect to agent's MCP session

Runtime:
  - Health check every 30s (HTTP GET /health or process alive check)
  - Auto-restart on crash (max 3 retries, then disable)
  - Resource usage tracked in SwarmTransaction

Server restart:
  - Process registry in Postgres survives restart
  - On boot: iterate process_registry, restart all "active" MCP containers
  - Startup order: DB → MCP containers → Sanad AI EOI server → agents
```

### AI Analysis Validation

After AI generates config/analysis, validate before trusting:

1. **Config validation**: JSON schema check against expected MCP/connector format
2. **Dry-run**: attempt connection/startup in sandbox mode
3. **Diff review**: for updates, show before/after diff to installing agent
4. **Confidence score**: AI outputs 0-100 confidence. Below 70 → require manual review
5. **Known-good templates**: maintain a library of verified configs. AI starts from template when available.

### Auto-Generated Capability Quality

Auto-generated capabilities (companion skills, connectors) are NOT immediately active:

```
Status lifecycle:
  draft → testing → active → deprecated

draft:    Generated by AI. Not usable by agents.
testing:  Agent uses in sandbox. Must score >6/10 to promote.
active:   Available to all assigned agents.
deprecated: Quality dropped below 5/10 for 14 days. Removed after 30.
```

### Score Aggregation Strategy

When multiple agents evaluate the same capability:

```
Weighted average:
  Expert (weight 3.0)    → has used it 20+ times
  Competent (weight 2.0) → has used it 5-19 times
  Novice (weight 1.0)    → has used it 1-4 times

Example:
  TechLead (Expert): 9.0  × 3.0 = 27.0
  BackendEng (Competent): 7.5 × 2.0 = 15.0
  SalesRep (Novice): 3.0  × 1.0 = 3.0
  Total weight: 6.0
  Weighted score: 45.0 / 6.0 = 7.5

Director tiebreaker:
  If scores diverge >3 points between agents,
  Director investigates: "TechLead loves this but SalesRep hates it.
  Is this a role-fit issue or a quality issue?"
```

## Key Design Decisions

1. **Infrastructure first** — Can't mentor without capabilities to manage
2. **Hybrid architecture** — Director is a Sanad AI EOI agent, discovery tools live in Brain MCP
3. **Trust + Autonomy** — Agents can install with audit trail, board can revoke. Configurable rules.
4. **Pull-Understand-Clone** — AI analyzes external capabilities and adapts them to our system
5. **Companion generation** — When pulling an MCP server, AI auto-generates connector + companion skill
6. **Version pinning** — Installed capabilities pin to version, updates go through trust engine
7. **Ledger + Market hybrid** — Real accounting (tokens + time + money) with quality-adjusted market pricing
8. **Swarm as investment center** — The Swarm itself has a budget and must generate positive ROI
9. **Tiered visibility** — Agents see own costs, CEO sees everything, Board sees cross-company
10. **Security pipeline** — 4 gates before install: URL filter, content scan, integrity verify, sandbox test
11. **Secret scoping** — MCP servers get proxy tokens, not raw secrets. All API calls logged.
12. **Comparative value** — ROI based on actual task time deltas, not agent self-reports
13. **Circuit breakers** — 3 health check failures → auto-disable. Budget overrun → throttle. Kill switch for Board.
14. **Skill table unification** — company_skills is the ONE truth. Old skills table deprecated and migrated.

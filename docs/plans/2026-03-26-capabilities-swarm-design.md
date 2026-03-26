# Capabilities Swarm — Design Document

**Date:** 2026-03-26
**Status:** Approved (prototype reviewed)
**Prototype:** `docs/prototypes/capabilities_swarm_prototype.html`

## What It Is

A unified capability marketplace + autonomous learning system for Sanad AI EOI agents. Agents discover, pull, evaluate, and learn capabilities (skills, MCP servers, connectors, plugins) from external sources — with a dedicated Director agent that mentors and curates.

## Architecture — 3 Layers

```
┌─────────────────────────────────────────────────────┐
│  LAYER 3: SWARM DIRECTOR (Paperclip Agent)          │
│  Mentoring, knowledge graph, proactive recs,        │
│  cross-agent knowledge transfer                     │
├─────────────────────────────────────────────────────┤
│  LAYER 2: BRAIN DISCOVERY TOOLS (Sanad Brain MCP)   │
│  swarm_discover, swarm_analyze, swarm_pull,         │
│  swarm_evaluate, swarm_feedback                     │
├─────────────────────────────────────────────────────┤
│  LAYER 1: SWARM INFRASTRUCTURE (Paperclip Server)   │
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
- **Lives in:** Paperclip as a regular agent
- **Tools:** Brain MCP discovery tools + Paperclip API

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

### Phase 1: Swarm Infrastructure (Paperclip Server)
- [ ] DB tables: swarm_sources, swarm_capabilities, swarm_installs, swarm_transactions
- [ ] Source adapters: local filesystem, mcpservers.org scraper, mcpserverhub.com scraper
- [ ] Pull pipeline: fetch → parse → validate → store
- [ ] Trust engine with configurable rules
- [ ] REST API endpoints for all swarm operations
- [ ] UI: Catalog, Sources, Queue, Audit pages
- [ ] Install flow wizard (from prototype)
- [ ] Pricing: free/paid/premium tags on capabilities
- [ ] Budget bar on catalog page

### Phase 2: Swarm Economics Engine (Paperclip Server)
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
- [ ] Agent config in Paperclip (role, permissions, heartbeat)
- [ ] Feedback processing loop (receive, aggregate, act)
- [ ] Capability Knowledge Graph (agent x capability x proficiency)
- [ ] Mentor/student evaluation protocol
- [ ] Proactive recommendation engine (based on task patterns + budget)
- [ ] Cross-agent knowledge transfer
- [ ] Director dashboard in Swarm UI
- [ ] Budget-aware mentoring ("You have $50 left, here's the best free alternative")

## Key Design Decisions

1. **Infrastructure first** — Can't mentor without capabilities to manage
2. **Hybrid architecture** — Director is a Paperclip agent, discovery tools live in Brain MCP
3. **Trust + Autonomy** — Agents can install with audit trail, board can revoke. Configurable rules.
4. **Pull-Understand-Clone** — AI analyzes external capabilities and adapts them to our system
5. **Companion generation** — When pulling an MCP server, AI auto-generates connector + companion skill
6. **Version pinning** — Installed capabilities pin to version, updates go through trust engine
7. **Ledger + Market hybrid** — Real accounting (tokens + time + money) with quality-adjusted market pricing
8. **Swarm as investment center** — The Swarm itself has a budget and must generate positive ROI
9. **Tiered visibility** — Agents see own costs, CEO sees everything, Board sees cross-company

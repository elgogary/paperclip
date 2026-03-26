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

## UI Pages (Prototype: capabilities_swarm_prototype.html)

1. **Catalog** (`/OPT/swarm`) — Browse all capabilities with search, filters, trust badges
2. **Sources** (`/OPT/swarm/sources`) — Manage registry sources
3. **Queue** (`/OPT/swarm/queue`) — Agent approval requests
4. **Audit** (`/OPT/swarm/audit`) — Full history of installs, removals, evaluations

## Implementation Phases

### Phase 1: Swarm Infrastructure (Paperclip Server)
- [ ] Swarm registry DB tables (swarm_sources, swarm_capabilities, swarm_installs)
- [ ] Source adapters: local filesystem, mcpservers.org scraper, mcpserverhub.com scraper
- [ ] Pull pipeline: fetch → parse → validate → store
- [ ] Trust engine with configurable rules
- [ ] REST API endpoints for all swarm operations
- [ ] UI: Catalog, Sources, Queue, Audit pages
- [ ] Install flow wizard (from prototype)

### Phase 2: Brain Discovery Tools (Sanad Brain MCP)
- [ ] swarm_discover tool — NL search across all registries
- [ ] swarm_analyze tool — AI compatibility assessment
- [ ] swarm_pull tool — pull + adapt with trust engine gate
- [ ] swarm_evaluate tool — self-scoring framework
- [ ] swarm_feedback tool — structured feedback to Director
- [ ] Integration with Sanad Brain memory for knowledge graph

### Phase 3: Swarm Director Agent
- [ ] Agent config in Paperclip (role, permissions, heartbeat)
- [ ] Feedback processing loop (receive, aggregate, act)
- [ ] Capability Knowledge Graph (agent × capability × proficiency)
- [ ] Mentor/student evaluation protocol
- [ ] Proactive recommendation engine
- [ ] Cross-agent knowledge transfer
- [ ] Director dashboard in Swarm UI

## Key Design Decisions

1. **Infrastructure first** — Can't mentor without capabilities to manage
2. **Hybrid architecture** — Director is a Paperclip agent, discovery tools live in Brain MCP
3. **Trust + Autonomy** — Agents can install with audit trail, board can revoke. Configurable rules.
4. **Pull-Understand-Clone** — AI analyzes external capabilities and adapts them to our system
5. **Companion generation** — When pulling an MCP server, AI auto-generates connector + companion skill
6. **Version pinning** — Installed capabilities pin to version, updates go through trust engine

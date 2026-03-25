# F16 — Skill Evolution Layer — Design Document

**Date:** 2026-03-25
**Status:** Approved for implementation
**Approach:** Mode B — Native implementation (no OpenSpace dependency)
**Foundation:** Extends Toolkit & Capabilities (skills table, Sanad Brain, scheduled jobs)

---

## 1. Problem

Paperclip agents start from zero on every task. Knowledge is lost between heartbeats. Token costs stay constant regardless of how many times the same pattern is executed. When tools break, agents fail silently. Agents in the same company don't share learnings.

## 2. Solution

A self-evolving skill layer where:
- Every successful pattern is automatically captured as a reusable skill
- Broken skills are auto-repaired when tools/APIs change
- Each agent gets the skill version that works best for them
- Sanad Brain memories feed into skill candidates
- Three independent monitors watch quality continuously

## 3. Architecture Overview

```
Agent heartbeat run
  │
  ├─ START: Smart skill retrieval (BM25 + Sanad Brain vectors)
  │         → Per-agent version selection based on metrics
  │         → Top-K skills injected into context
  │
  ├─ DURING: Agent works on task, uses skills
  │
  ├─ END: Agent adds lightweight feedback tag (~50 tokens):
  │       "SKILL_FEEDBACK: {skill_id, used, helpful, novel_pattern}"
  │
  └─ AFTER (async):
      │
      ├─ Monitor 1: Post-Execution Analyzer
      │   → Read transcript + feedback → LLM decides FIX/DERIVED/CAPTURED/NOTHING
      │
      ├─ Monitor 2: Tool Degradation Monitor
      │   → Track tool error rates → Batch FIX affected skills
      │
      ├─ Monitor 3: Metric Sweep (every 6h)
      │   → Flag degrading skills → FIX or mark dormant
      │
      └─ Monitor 4: Brain Memory Scanner
          → Scan Sanad Brain for recurring LESSON patterns
          → Propose CAPTURED skills from 3+ matching memories
```

## 4. Data Model

### 4.1 Extend existing `skills` table

```sql
ALTER TABLE skills ADD COLUMN origin TEXT DEFAULT 'manual';
  -- manual | captured | derived | fix | imported
ALTER TABLE skills ADD COLUMN parent_id UUID REFERENCES skills(id);
ALTER TABLE skills ADD COLUMN version INTEGER DEFAULT 1;
ALTER TABLE skills ADD COLUMN quality_metrics JSONB DEFAULT '{}';
  -- { applied_count, success_count, failure_count, fallback_count,
  --   avg_token_delta, completion_rate, applied_rate, error_rate }
ALTER TABLE skills ADD COLUMN embedding_id TEXT;
ALTER TABLE skills ADD COLUMN evolution_status TEXT DEFAULT 'active';
  -- active | dormant | deprecated | pending_review
ALTER TABLE skills ADD COLUMN default_version BOOLEAN DEFAULT true;
  -- marks the "global recommended" version
```

### 4.2 New: `skill_versions` table

```sql
skill_versions (
  id              UUID PRIMARY KEY,
  skill_id        UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  version         INTEGER NOT NULL,
  origin          TEXT NOT NULL,           -- fix | derived | captured | manual
  content_diff    TEXT,                    -- diff from previous version
  full_content    TEXT NOT NULL,           -- full SKILL.md snapshot
  trigger_reason  TEXT,                    -- "tool xyz failed 3x" | "novel pattern detected"
  metrics_before  JSONB DEFAULT '{}',     -- scores at time of evolution
  metrics_after   JSONB DEFAULT '{}',     -- scores after this version ran
  created_by      TEXT,                   -- 'system' | agent_id | user_id
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(skill_id, version)
)
```

### 4.3 New: `evolution_events` table

```sql
evolution_events (
  id                UUID PRIMARY KEY,
  company_id        UUID NOT NULL REFERENCES companies(id),
  skill_id          UUID REFERENCES skills(id),
  event_type        TEXT NOT NULL,          -- fix | derived | captured | flagged | rejected
  source_monitor    TEXT NOT NULL,          -- post_run | tool_degradation | metric_sweep | brain_scan
  heartbeat_run_id  UUID,                  -- which run triggered this (null for sweep/brain)
  agent_id          UUID REFERENCES agents(id),
  analysis          JSONB,                 -- LLM analysis output
  proposed_content  TEXT,                  -- the new skill content proposed
  status            TEXT DEFAULT 'pending', -- pending | approved | applied | rejected
  reviewed_by       TEXT,                  -- 'auto' | 'ceo_agent' | user_id
  applied_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW()
)
```

### 4.4 New: `skill_agent_metrics` table

```sql
skill_agent_metrics (
  id              UUID PRIMARY KEY,
  skill_id        UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  skill_version   INTEGER NOT NULL,
  agent_id        UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  applied_count   INTEGER DEFAULT 0,
  success_count   INTEGER DEFAULT 0,
  failure_count   INTEGER DEFAULT 0,
  fallback_count  INTEGER DEFAULT 0,      -- skill was injected but agent ignored it
  total_tokens    INTEGER DEFAULT 0,
  avg_token_delta FLOAT DEFAULT 0,        -- tokens saved vs no-skill baseline
  last_used_at    TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(skill_id, skill_version, agent_id)
)
```

## 5. Evolution Engine

### 5.1 Agent Feedback (lightweight, end of heartbeat)

At the end of each heartbeat, agent adds a feedback block to its run output:

```
SKILL_FEEDBACK:
- skill: code-review-v3 | used: yes | helpful: yes
- skill: debug-patterns-v1 | used: no | helpful: n/a
- novel_pattern: "retry with exponential backoff on 429 errors" | tools: [github.create_pull_request]
```

This costs ~50 tokens. The agent doesn't do heavy analysis — just flags.

### 5.2 Central Evolution Service

A new service: `server/src/services/skill-evolution.ts`

```typescript
export function skillEvolutionService(db: Db) {
  return {
    // Called after each heartbeat run
    analyzeRun(runId: string, companyId: string): Promise<EvolutionEvent | null>,

    // Called by tool degradation monitor
    handleToolDegradation(toolName: string, errorMsg: string, companyId: string): Promise<EvolutionEvent[]>,

    // Called by metric sweep (every 6h)
    sweepMetrics(companyId: string): Promise<EvolutionEvent[]>,

    // Called by brain memory scanner
    scanBrainMemories(companyId: string): Promise<EvolutionEvent[]>,

    // Apply an approved evolution
    applyEvolution(eventId: string): Promise<void>,

    // Reject an evolution
    rejectEvolution(eventId: string, reason: string): Promise<void>,
  }
}
```

### 5.3 Evolution Decision Logic

```
analyzeRun(runId):
  1. Load run transcript (heartbeat_run_events WHERE run_id = X)
  2. Load agent feedback tags from transcript
  3. Load skills that were injected for this run

  4. Triage (cheap model — Haiku):
     - Were there errors? → potential FIX
     - Was there a novel pattern? → potential CAPTURED
     - Did agent adapt a skill significantly? → potential DERIVED
     - Nothing interesting? → SKIP (no LLM call, save money)

  5. If triage says "worth analyzing" → full analysis (Sonnet):
     - Generate proposed skill content
     - Compute diff from current version
     - Estimate confidence score

  6. Safety checks:
     - Anti-loop: skill can't FIX >3x in 24h
     - Injection scan: reject if content contains known injection patterns
     - Diff size: reject if >80% of content changed (likely hallucination)

  7. Auto-approve if confidence > 0.8 AND diff < 30% of content
     Otherwise: create pending event for CEO Agent review
```

### 5.4 Three Evolution Modes

| Mode | Trigger | What happens | Result |
|------|---------|-------------|--------|
| FIX | Skill used but failed, tool error, metric decline | Patch the instructions to handle the new situation | Same skill, version incremented, content_diff stored |
| DERIVED | Skill succeeded but agent specialized it for a context | Create new skill with parent_id pointing to original | New skill entry, coexists with parent |
| CAPTURED | Novel pattern detected, no existing skill covers it | Create brand new skill from the pattern | New skill, origin='captured', no parent |

## 6. Smart Retrieval

### 6.1 At Heartbeat Start

```typescript
async function retrieveSkills(taskDescription: string, agentId: string, companyId: string): Promise<Skill[]> {
  // 1. PostgreSQL full-text search
  const bm25Results = await db.query(`
    SELECT id, ts_rank(to_tsvector(name || ' ' || description || ' ' || instructions), query) as rank
    FROM skills, plainto_tsquery($1) query
    WHERE company_id = $2 AND enabled = true AND evolution_status = 'active'
    ORDER BY rank DESC LIMIT 20
  `, [taskDescription, companyId]);

  // 2. Sanad Brain vector search
  const vectorResults = await sanadBrain.recall({
    query: taskDescription,
    collection: `skills_${companyId}`,
    limit: 20
  });

  // 3. Hybrid merge (RRF - Reciprocal Rank Fusion)
  const merged = reciprocalRankFusion(bm25Results, vectorResults);

  // 4. Agent-specific reranking
  const reranked = await rerankForAgent(merged, agentId);

  // 5. Return top-K
  return reranked.slice(0, 5);
}
```

### 6.2 Per-Agent Version Selection

```typescript
async function rerankForAgent(skills: Skill[], agentId: string): Promise<Skill[]> {
  // For each skill, check if this agent has performance data
  const metrics = await db.select()
    .from(skillAgentMetrics)
    .where(eq(skillAgentMetrics.agentId, agentId));

  return skills.map(skill => {
    const agentMetric = metrics.find(m => m.skillId === skill.id);
    if (agentMetric) {
      // Boost score based on agent's success rate with this skill
      skill.retrievalScore *= (1 + agentMetric.success_count / (agentMetric.applied_count || 1));
      // If agent has a preferred version, use it
      if (agentMetric.skill_version !== skill.version) {
        skill.useVersion = agentMetric.skill_version;
      }
    }
    return skill;
  }).sort((a, b) => b.retrievalScore - a.retrievalScore);
}
```

## 7. Quality Monitors

### Monitor 1: Post-Execution Analyzer

- **Trigger**: After each heartbeat run completes
- **Implementation**: New scheduled job type `skill_evolution` in scheduler-loop
- **Cost control**: Haiku triage first (~100 tokens), Sonnet only if evolution proposed (~2000 tokens)
- **Expected frequency**: 80% of runs → NOTHING (skip). 15% → minor update. 5% → real evolution.

### Monitor 2: Tool Degradation Monitor

- **Trigger**: MCP tool call returns error
- **Implementation**: Redis counter `tool_errors:{tool}:{hour_bucket}`, threshold = 3 errors/hour
- **Action**: Batch FIX all skills referencing the degraded tool
- **Anti-spam**: One batch FIX per tool per 24h max

### Monitor 3: Metric Sweep

- **Trigger**: Every 6 hours (scheduled job)
- **Process**: Scan all skills, compute rolling 7-day metrics
- **Actions**:
  - Completion rate < 70% → propose FIX
  - Applied rate < 10% → mark dormant
  - Consistently high → mark stable (skip analysis to save tokens)

### Monitor 4: Brain Memory Scanner

- **Trigger**: Every 12 hours (scheduled job)
- **Process**: Query Sanad Brain for recent LESSON/PATTERN memories
- **Action**: If same pattern appears in 3+ agent memories → propose CAPTURED skill
- **Dedup**: Check if a skill with similar content already exists (cosine similarity > 0.85)

## 8. Sanad Brain Integration

```
Sanad Brain (memories)                    F16 (skills)
────────────────────                    ─────────────
LESSON: always check branch exists      ──→ CAPTURED: "git-branch-check"
LESSON: retry on 429 with backoff       ──→ CAPTURED: "api-retry-pattern"
PATTERN: Arabic docs need RTL flag      ──→ CAPTURED: "arabic-doc-rtl"
DECISION: use Sonnet for code review    ──→ (not a skill, stays as memory)
FACT: staging URL is x.mvpstorm.com     ──→ (not a skill, stays as memory)

Rule: Only LESSON and PATTERN memories are candidates.
      DECISION, FACT, EVENT stay in Brain only.
```

## 9. Dashboard UI

### In Toolkit → Skills section, add "Evolution" sub-view:

**Evolution Timeline** (recent events):
```
┌──────────────────────────────────────────────────────┐
│ 🔧 FIX  code-review v3→v4     2h ago  by system     │
│   Tool github.create_issue returned 422. Patched     │
│   instructions to include required 'labels' field.   │
│   Score: 89% → 94% (+5pp)                           │
├──────────────────────────────────────────────────────┤
│ ✨ CAPTURED  api-retry-pattern v1   5h ago  auto     │
│   Detected in 4 agent runs: retry with exponential   │
│   backoff on 429/503 errors. Created new skill.      │
├──────────────────────────────────────────────────────┤
│ 🚀 DERIVED  arabic-doc-gen v1   1d ago  from doc-gen │
│   BackendEng adapted doc-gen for RTL Arabic output.  │
│   Created specialized variant.                       │
└──────────────────────────────────────────────────────┘
```

**Skill Version Card** (per-skill detail):
```
┌─────────────────────────────────────────────┐
│ code-review                                  │
│ v4 (current default) ← v3 ← v2 ← v1        │
│                                              │
│ Global: ✅ 94% completion  ⚡ -340 tokens    │
│                                              │
│ Per Agent:                                   │
│ TechLead    → v4  94%  ████████████░░  │
│ BackendEng  → v4  91%  ███████████░░░  │
│ FrontendEng → v3  96%  █████████████░  │  ← uses older version!
│                                              │
│ [View Diff v3→v4]  [Rollback to v3]          │
└─────────────────────────────────────────────┘
```

**Pending Reviews** (for CEO Agent):
```
┌─────────────────────────────────────────────┐
│ ⏳ 2 pending evolutions                      │
│                                              │
│ 1. FIX: debug-patterns v2                    │
│    Confidence: 0.72 (below auto-approve)     │
│    [View Diff] [Approve] [Reject]            │
│                                              │
│ 2. CAPTURED: docker-compose-healthcheck      │
│    From: 3 Brain memories across 2 agents    │
│    [View Content] [Approve] [Reject]         │
└─────────────────────────────────────────────┘
```

## 10. Anti-Abuse & Safety

| Guard | Rule |
|-------|------|
| Anti-loop | Same skill can't FIX more than 3x in 24h. After 3, flag for human review |
| Injection scan | New skill content checked against known prompt injection patterns |
| Diff size limit | Evolution must change <80% of content. Full rewrites rejected |
| Confidence gate | Auto-approve only if confidence > 0.8. Below → pending review |
| Token budget | Evolution analysis capped at 5000 tokens per run (Haiku triage + Sonnet analysis) |
| Dormancy | Skills with <10% applied_rate for 7 days → marked dormant, not injected |
| Rollback | Any version can be rolled back to previous via dashboard |

## 11. Implementation Phases

### Phase 1: Foundation (Week 1)
- DB migration: extend skills table + create skill_versions, evolution_events, skill_agent_metrics
- Skill retrieval service (BM25 + Sanad Brain vectors)
- Agent feedback tag parsing from run transcripts

### Phase 2: Evolution Engine (Week 2-3)
- Post-Execution Analyzer (Monitor 1)
- FIX / DERIVED / CAPTURED logic with LLM
- Safety checks (anti-loop, injection scan, diff limit)
- Auto-approve / pending review flow

### Phase 3: Quality Monitors (Week 3-4)
- Tool Degradation Monitor (Monitor 2)
- Metric Sweep (Monitor 3)
- Brain Memory Scanner (Monitor 4)
- Per-agent metrics tracking

### Phase 4: Dashboard UI (Week 4-5)
- Evolution timeline in Toolkit
- Skill version card with per-agent scores
- Pending reviews panel
- Version diff viewer
- Rollback functionality

### Phase 5: Optimization (Week 5-6)
- Tune retrieval (hybrid BM25 + vector weights)
- Tune evolution confidence thresholds
- Token cost optimization (batch analysis, skip trivial runs)
- Load testing with concurrent agents

## 12. Success Metrics

| Metric | Target | How to measure |
|--------|--------|---------------|
| Token reduction | ≤30% after 50 tasks | Compare warm rerun tokens vs cold |
| Auto-evolution rate | ≥1 per 10 task runs | Count evolution_events per week |
| Skill quality | ≥70% completion rate avg | skill_agent_metrics |
| Cross-agent learning | ≥3 shared skills after 1 month | Skills used by 2+ agents |
| Brain→Skill pipeline | ≥1 CAPTURED from Brain per week | evolution_events.source_monitor = 'brain_scan' |
| Zero cross-tenant leak | 0 cross-company skill access | Audit query with wrong company_id |

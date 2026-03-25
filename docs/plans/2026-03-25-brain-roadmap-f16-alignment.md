# Sanad Brain Roadmap — F16 Alignment Update

**Date:** 2026-03-25
**Purpose:** Resolve conflicts and gaps between Sanad Brain roadmap and F16 Skill Evolution Layer

---

## Changes to Brain Roadmap

### v0.7 — Monitoring (ADD)

Add these endpoints for F16 integration:
- `GET /memory/search?type=LESSON&since=24h` — filter by memory type and time
- `GET /memory/patterns?min_count=3` — find recurring similar memories

These are needed by F16's Brain Memory Scanner (Monitor 4).

### v0.8 — Smart Memory (ADD + MODIFY)

**ADD:** Unified feedback pipeline
- `POST /memory/feedback` — track which memories were retrieved + used
- Shared with F16's `SKILL_FEEDBACK:` system
- One feedback format, two consumers (Brain quality scoring + F16 evolution)

**ADD:** Shared quality scoring module
- Same formula for both memory importance and skill quality
- Factors: retrieval_count, recency, quality_score, feedback_positive_rate
- Brain and F16 import from shared package, not duplicate

### v1.0 — Production (NO CHANGES)

No conflicts. F16 uses Brain's existing infrastructure (Qdrant, LiteLLM).

### v1.5 — Multi-Site (ADD)

**ADD:** F16 skill re-embedding migration plan
- When Brain switches to BGE-M3, F16 must re-embed all skill vectors
- One-time migration job: `skill_reembedding`
- Add to the embedding model switch checklist

### v2.0 — Agent Autonomy (MODIFY — SCOPE REDUCTION)

**REMOVE from Brain v2.0 (F16 owns these):**

| Item | Why removed | Where it lives now |
|------|-------------|-------------------|
| Procedural memory | F16 skills ARE procedural memory | F16: skills table with CAPTURED origin |
| Cross-agent knowledge sharing | F16 shares skills with per-agent metrics | F16: skill_agent_access + skill_agent_metrics |
| Self-improving prompts | F16 evolution engine auto-patches skills | F16: FIX/DERIVED/CAPTURED modes |

**KEEP in Brain v2.0:**

| Item | Why kept | Notes |
|------|----------|-------|
| Working memory | In-session context management is Brain's domain | F16 handles cross-session, Brain handles in-session |
| Memory-guided planning | "I remember this client prefers X" is declarative | Brain provides context, F16 provides instructions |
| Predictive memory | "3 things that went wrong last time" | Natural outcome of F16 skill retrieval + Brain recall |

**ADD to Brain v2.0:**
- Skill → Memory backflow: when F16 skill reaches "stable", auto-create a Brain memory
- Memory → Skill promotion: formalized pipeline from Brain LESSON to F16 CAPTURED

---

## Ownership Matrix

| Capability | Owner | Reason |
|-----------|-------|--------|
| Store facts, decisions, lessons | **Brain** | Declarative knowledge |
| Store how-to instructions | **F16** | Procedural knowledge (skills) |
| Quality scoring formula | **Shared** | Same factors for both |
| Feedback pipeline | **Shared** | One system, two consumers |
| Skill evolution (FIX/DERIVED/CAPTURED) | **F16** | Skills are versioned + audited |
| Memory consolidation (Dream) | **Brain** | Merge, dedup, quality check |
| Cross-agent fact sharing | **Brain** | Company-scope memories |
| Cross-agent skill sharing | **F16** | Per-agent metrics determine best version |
| Vector storage (Qdrant) | **Shared** | Separate collections, same instance |
| LLM calls (analysis) | **Shared** | Both use LiteLLM router |
| Scheduled jobs | **Shared** | Both use Sanad AI EOI scheduler |

---

## Data Flow After Alignment

```
Agent heartbeat run
  │
  ├─ Brain recall() → declarative context (facts, lessons)
  ├─ F16 retrieve() → procedural skills (instructions)
  │
  ├─ Agent works on task
  │
  ├─ Brain remember() → new facts/lessons stored
  ├─ F16 SKILL_FEEDBACK → skill usage reported
  │
  └─ After run (async):
      ├─ Brain Dream → consolidate memories (nightly)
      ├─ F16 Analyzer → propose skill evolutions
      ├─ F16 Brain Scanner → check if Brain LESSONS → new skills
      └─ F16 Backflow → stable skills → Brain memories
```

---

## Timeline Impact

| Phase | Brain | F16 | Shared Work |
|-------|-------|-----|-------------|
| Now | v0.7 monitoring | F16 design approved | — |
| Week 1-2 | Add search/pattern endpoints | DB migration + retrieval service | — |
| Week 3-4 | v0.8 smart memory | Evolution engine | Shared feedback pipeline |
| Week 5-6 | v0.8 complete | Quality monitors | Shared scoring module |
| Month 2 | v1.0 production | F16 Phase 4-5 (dashboard + optimization) | — |
| Month 3 | v1.5 multi-site | Stable | Re-embedding migration |
| Month 4+ | v2.0 (reduced scope) | Mature | Backflow pipeline |

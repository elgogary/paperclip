# Skills UI Upgrade + F16 Evolution — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Claude Code-quality Skills page (`/skills`) with AI-powered skill creation, versioning, audit scoring, and the F16 evolution engine backend.

**Architecture:** New `/skills` page with left panel list + right panel detail. Toolkit `/toolkit` links to it. F16 evolution engine runs as async background jobs analyzing heartbeat transcripts.

**Tech Stack:** Drizzle ORM (PostgreSQL), Express routes, React + TanStack Query, Sanad Brain (Qdrant vectors), LLM calls (Haiku triage + Sonnet analysis)

---

## Part A: Skills UI Upgrade (Week 1-2)

### Task 1: DB migration — add evolution columns to skills table

**Files:**
- Create: `packages/db/src/schema/skill_versions.ts`
- Create: `packages/db/src/schema/evolution_events.ts`
- Create: `packages/db/src/schema/skill_agent_metrics.ts`
- Modify: `packages/db/src/schema/skills.ts` — add columns: origin, parent_id, version, quality_metrics, embedding_id, evolution_status, default_version
- Modify: `packages/db/src/schema/index.ts` — export new tables
- Create: migration SQL

### Task 2: Backend — skill versioning service

**Files:**
- Create: `server/src/services/skill-versions.ts`

Methods:
- `listVersions(skillId)` — version history for a skill
- `getVersion(skillId, version)` — specific version content
- `createVersion(skillId, content, origin, reason)` — new version (increments version number)
- `diffVersions(skillId, v1, v2)` — text diff between two versions
- `rollback(skillId, targetVersion)` — set a previous version as current

### Task 3: Backend — skill audit service

**Files:**
- Create: `server/src/services/skill-audit.ts`

Methods:
- `auditSkill(skillId)` — LLM analyzes skill quality, returns score + suggestions
  - Checks: clarity, trigger specificity, instruction completeness, tool references, edge case handling
  - Returns: `{ score: 0-100, suggestions: string[], strengths: string[] }`

### Task 4: Backend — AI skill creator service

**Files:**
- Create: `server/src/services/skill-creator.ts`

Methods:
- `generateSkill(description: string, category: string, companyId: string)` — LLM generates a full SKILL.md from natural language description
  - Input: "I want a skill that helps agents write unit tests for TypeScript projects"
  - Output: complete SKILL.md content with frontmatter, when to use, instructions, examples

### Task 5: Backend — new API routes

**Files:**
- Modify: `server/src/routes/skills.ts` — add endpoints:

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/skills/:id/versions` | List version history |
| GET | `/skills/:id/versions/:v` | Get specific version |
| POST | `/skills/:id/versions/:v/rollback` | Rollback to version |
| GET | `/skills/:id/versions/:v1/diff/:v2` | Diff two versions |
| POST | `/skills/:id/audit` | Run AI audit, return score + suggestions |
| POST | `/companies/:id/skills/generate` | AI-generate skill from description |

### Task 6: Frontend — new `/skills` page (Claude-like layout)

**Files:**
- Create: `ui/src/pages/Skills.tsx` — full page with left panel + right panel
- Modify: `ui/src/lib/company-routes.ts` — add "skills" to BOARD_ROUTE_ROOTS
- Modify: `ui/src/App.tsx` — add route
- Modify: `ui/src/components/Sidebar.tsx` — add Skills nav item (or sub-item under Toolkit)

Layout:
```
┌──────────────────────────────────────────────────────────────┐
│ Skills                                          [+ New] [AI] │
├─────────────────┬────────────────────────────────────────────┤
│ Search [______] │  skill-name                     [toggle]   │
│                 │                                            │
│ ▾ My Skills     │  Added by: User  |  Updated: Mar 20       │
│   ● add-api-... │  Invoked by: User or Agent                │
│   ● til         │  Description (i)                           │
│   ● debug-agent │  ─────────────────────────────────────     │
│                 │                                            │
│ ▾ Built-in      │  [👁 Preview] [</> Code]    [v4 ▾]        │
│   ○ code-review │                                            │
│   ○ research    │  ## When to Use                            │
│   ○ data-analy..│  Search for this skill when...             │
│   ○ summarize   │                                            │
│                 │  ## Instructions                            │
│ ▾ Examples      │  1. First, check the existing...           │
│   ◇ skill-crea..│  2. Then, generate...                      │
│   ◇ brand-guid..│  ...                                       │
│   ◇ mcp-builder │                                            │
│                 │  ────────────────────────────────────       │
│                 │  [Audit Score] [Versions] [Agent Access]   │
│                 │  Score: 87/100 ████████░░                   │
│                 │  v4 ← v3 ← v2 ← v1                        │
└─────────────────┴────────────────────────────────────────────┘
```

### Task 7: Frontend — skill detail right panel components

**Files:**
- Create: `ui/src/components/skills/SkillDetailPanel.tsx` — main right panel
- Create: `ui/src/components/skills/SkillMarkdownPreview.tsx` — rendered markdown view (marked.js + highlight.js)
- Create: `ui/src/components/skills/SkillCodeEditor.tsx` — raw SKILL.md editor (monospace textarea)
- Create: `ui/src/components/skills/SkillVersionHistory.tsx` — version timeline + diff viewer
- Create: `ui/src/components/skills/SkillAuditCard.tsx` — score display + suggestions
- Create: `ui/src/components/skills/SkillAICreateDialog.tsx` — dialog for AI skill generation
- Create: `ui/src/components/skills/SkillListPanel.tsx` — left panel with sections (My Skills, Built-in, Examples)

### Task 8: Frontend — preview/code toggle

The right panel has two modes (like Claude's eye/code toggle):
- **Preview mode** (default): Rendered markdown with proper headings, code blocks, tables
- **Code mode**: Raw SKILL.md text in a monospace editor (editable)

Toggle between them with the eye/code icons in the header.

### Task 9: Frontend — AI Create Skill dialog

A dialog that:
1. User describes what they want in natural language
2. Selects category and who can invoke
3. Clicks "Generate" → calls `/skills/generate` API
4. Shows generated SKILL.md in preview mode
5. User can edit, then save

### Task 10: Frontend — Audit Score card

When user clicks "Audit Score":
1. Calls `/skills/:id/audit` API
2. Shows score (0-100) with progress bar
3. Lists strengths and suggestions
4. "Apply Suggestions" button → LLM rewrites the skill with fixes → creates new version

### Task 11: Frontend — Version History panel

Collapsible panel showing:
- Version timeline: v4 ← v3 ← v2 ← v1
- Click any version to see its content
- Diff view between any two versions (side-by-side or inline)
- "Rollback to this version" button
- Origin badge per version (manual, fix, derived, captured)

### Task 12: Update Toolkit page — Skills summary card

Modify `ui/src/pages/Toolkit.tsx`:
- Skills section becomes a summary card instead of full section
- Shows: skill count, recent evolution events, "Manage Skills →" button linking to `/skills`
- Keep MCP Servers, Connectors, Plugins as full sections in Toolkit

---

## Part B: F16 Evolution Engine Backend (Week 3-5)

### Task 13: Skill retrieval service

**Files:**
- Create: `server/src/services/skill-retrieval.ts`

Methods:
- `retrieveForTask(taskDescription, agentId, companyId)` — hybrid BM25 + Sanad Brain vectors, per-agent reranking, returns top-K skills

### Task 14: Skill evolution service

**Files:**
- Create: `server/src/services/skill-evolution.ts`

Methods:
- `analyzeRun(runId, companyId)` — post-run analysis with LLM
- `handleToolDegradation(toolName, error, companyId)` — batch FIX
- `sweepMetrics(companyId)` — 6-hour metric sweep
- `scanBrainMemories(companyId)` — brain memory → skill candidates
- `applyEvolution(eventId)` — apply approved evolution
- `rejectEvolution(eventId, reason)` — reject

### Task 15: Register evolution jobs in scheduler

**Files:**
- Modify: `server/src/services/scheduler-loop.ts` — add `skill_evolution` job type
- Modify: `server/src/services/scheduled-job-executors.ts` — add executor for:
  - `skill_evolution_post_run` — triggered after each heartbeat
  - `skill_metric_sweep` — every 6 hours
  - `skill_brain_scan` — every 12 hours

### Task 16: Tool degradation monitor

**Files:**
- Create: `server/src/services/tool-degradation-monitor.ts`

Watches tool errors via Redis counters. When threshold crossed, triggers batch FIX.

### Task 17: Agent feedback parser

**Files:**
- Create: `server/src/services/skill-feedback-parser.ts`

Parses `SKILL_FEEDBACK:` blocks from heartbeat run transcripts. Updates `skill_agent_metrics` table.

### Task 18: Evolution API routes

**Files:**
- Create: `server/src/routes/evolution.ts`

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/companies/:id/evolution/events` | List evolution events (timeline) |
| GET | `/companies/:id/evolution/events/:eventId` | Event detail |
| POST | `/companies/:id/evolution/events/:eventId/approve` | Approve pending evolution |
| POST | `/companies/:id/evolution/events/:eventId/reject` | Reject pending evolution |
| GET | `/companies/:id/skills/:skillId/metrics` | Per-agent metrics for skill |

### Task 19: Evolution Dashboard UI

**Files:**
- Create: `ui/src/components/skills/EvolutionTimeline.tsx` — recent FIX/DERIVED/CAPTURED events
- Create: `ui/src/components/skills/PendingReviews.tsx` — CEO approval queue
- Create: `ui/src/components/skills/AgentPerformanceMatrix.tsx` — which agents use which versions

Add as tabs/sections in the `/skills` page.

---

## Part C: Integration & Testing (Week 5-6)

### Task 20: Wire skill retrieval into heartbeat startup

Modify the agent adapter startup to call `retrieveForTask()` and inject relevant skills into agent context.

### Task 21: Wire feedback parser into heartbeat completion

After heartbeat run completes, enqueue a `skill_evolution_post_run` job that parses feedback and runs analysis.

### Task 22: Seed built-in skills with evolution metadata

Update the 10 seeded skills with proper `origin`, `version`, `quality_metrics` columns.

### Task 23: End-to-end tests

- Agent completes task → feedback parsed → evolution event created
- Tool error threshold → batch FIX triggered
- Brain memory pattern (3+) → CAPTURED skill proposed
- Rollback works correctly
- Per-agent version selection works

### Task 24: UI prototype for /skills page

Create `docs/prototypes/skills-page.html` before implementing the React components.

---

## Execution Order

```
Week 1: Tasks 1-5   (DB + backend services)
Week 2: Tasks 6-12  (Skills UI page — Claude-like)
Week 3: Tasks 13-17 (Evolution engine backend)
Week 4: Tasks 18-19 (Evolution API + Dashboard UI)
Week 5: Tasks 20-23 (Integration + testing)
Week 6: Task 24     (Polish + prototype validation)
```

Total: ~24 tasks, 5-6 weeks

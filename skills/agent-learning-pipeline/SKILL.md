---
name: agent-learning-pipeline
description: >
  Compare external agent patterns (GitHub repos, agent files, frameworks) against
  our Optiflow crew and decide what to absorb. Use when user says "learn from this",
  "compare agents", "steal patterns from", "what can we learn from", or shares a
  GitHub repo / agent config to analyze. Runs 6 gates: Extract → Compare → Classify
  → Conflict Check → Apply → Verify.
---

# Agent Learning Pipeline

> **This is a Board-only skill.** All paths below are HOST paths (not container paths).
> Agents run inside Docker at `/workspace/` — but this skill runs on the host at `/home/eslam/optiflow/`.

When the Board shares a source (GitHub repo, agent file, framework docs),
run this 6-gate pipeline to safely absorb useful patterns.

## Gate 1: EXTRACT
Read the source thoroughly. Produce a Pattern Inventory:

| # | Pattern | Category | Description |
|---|---------|----------|-------------|
| 1 | [name] | execution/output/memory/skill/role | [what it does] |

Categories: execution (how agent thinks), output (report format),
memory (learning/recall), skill (new capability), role (new agent type)

## Gate 2: COMPARE
For each pattern, compare against our current agents:

| # | Pattern | We Have? | Gap? | Impact (H/M/L) | Effort (H/M/L) |
|---|---------|----------|------|-----------------|-----------------|

Read these files to check what we already have:
- /home/eslam/optiflow/.agents/_common/EXECUTION-RULES.md
- /home/eslam/optiflow/.agents/*/SOUL.md
- /home/eslam/optiflow/.agents/*/SKILLS.md
- /home/eslam/optiflow/CHANGELOG.md

## Gate 3: CLASSIFY
For each gap with Impact >= Medium:

| Action | When |
|--------|------|
| Update SOUL.md | Pattern is about HOW agent thinks/works |
| Update SKILLS.md | Pattern is a new tool or capability |
| Create new agent | Pattern requires a whole new role we don't have |
| Save to knowledge/ | Pattern is reference data, not a rule |
| Skip | Low impact, conflicts, or we already do it better |

Decision tree for new agent:
- Does it overlap with existing agent? → Merge into existing (upgrade)
- Is it a genuinely new role? → Create new agent + onboarding checklist
- Would it push crew past 15 agents? → Skip or merge

## Gate 4: CONFLICT CHECK
For each change, verify:
- [ ] SOUL.md stays under 200 lines after change?
- [ ] No contradiction with existing rules?
- [ ] SKILLS.md stays under 100 lines?
- [ ] No role overlap with existing agent?
- [ ] Budget allocation makes sense?
- [ ] Docker paths (/workspace) are correct?

If conflict → resolve (rewrite rule, merge, or skip) before proceeding.

## Gate 5: APPLY
Execute the changes:
- Edit SOUL.md / SKILLS.md / LESSONS.md as needed
- Create new agent files if classified as new role
- Save knowledge to /workspace/knowledge/ if reference data
- Update /home/eslam/optiflow/CHANGELOG.md with:
  - Date
  - Source (repo URL or file path)
  - What was added/changed/skipped and why

## Gate 6: VERIFY
After all changes:
- [ ] All SOUL.md files under 200 lines
- [ ] All agents have required files (SOUL, HEARTBEAT, SKILLS, LESSONS)
- [ ] No contradicting rules across agents
- [ ] CHANGELOG.md updated
- [ ] If new agent: registered in Paperclip DB, budget set, model chosen

## New Agent Onboarding (if Gate 3 decided "Create new agent")

### Required Files
- /workspace/.agents/<name>/SOUL.md
- /workspace/.agents/<name>/HEARTBEAT.md
- /workspace/.agents/<name>/SKILLS.md
- /workspace/.agents/<name>/LESSONS.md

### Required Config (Paperclip DB)
- name, role, title, reportsTo, model, cwd=/workspace
- instructionsFilePath=/workspace/.agents/<name>/SOUL.md
- budgetMonthlyCents (CEO recommends, Board approves)

### Required Integration
- CEO SOUL.md: add to team list
- Board CLAUDE.md: add to crew structure + task routing
- CHANGELOG.md: document the addition

### Validation
- Assign a simple test task via Paperclip
- Wake the agent
- Verify: runs, comments on issue, completes, cost reasonable
- If pass → agent is live

## Complexity Guards

| Rule | Limit | Why |
|---|---|---|
| SOUL.md max lines | 200 | Beyond this, agents get confused |
| SKILLS.md max lines | 100 | Skills list, not a manual |
| Max agents in crew | 15 | Coordination overhead explodes |
| Max skills per agent | 20 | Focus beats breadth |
| No duplicate roles | 1 agent per role | Prevents confusion |
| New agent requires | SOUL + HEARTBEAT + SKILLS + LESSONS | Minimum viable agent |

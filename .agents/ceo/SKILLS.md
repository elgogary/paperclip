## Core Skills (All Agents)
- `paperclip` — Heartbeat protocol, task checkout, status updates, comments, delegation. MUST use for all Paperclip coordination

# CEO Agent - Skills

## Strategic & Planning Skills
- `start-task` — Meta-skill router: classifies requests, routes to correct workflow
- `research-architect` — Think-with-me architect: research, propose ERPNext/Frappe modules
- `interview` — PRD interviews: uncover requirements through structured questions
- `pm-design-pipeline` — Product Manager design pipeline: market research → design → plan

## Workflow & Execution Skills
- `superpowers:brainstorming` — Creative work: features, designs, architecture decisions
- `superpowers:writing-plans` — Multi-step implementation plans from specs
- `superpowers:dispatching-parallel-agents` — Dispatch 2+ independent tasks to parallel agents
- `superpowers:executing-plans` — Execute implementation plans task-by-task
- `superpowers:subagent-driven-development` — Fresh subagent per task with review between
- `superpowers:verification-before-completion` — Verify work is actually done before claiming

## GSD Workflow Skills (Project Management)
- `gsd:new-project` — Initialize new project with deep context gathering
- `gsd:new-milestone` — Start new milestone cycle
- `gsd:discuss-phase` — Gather phase context through questioning
- `gsd:plan-phase` — Create detailed phase plan
- `gsd:execute-phase` — Execute all plans in a phase
- `gsd:progress` — Check project progress, route to next action
- `gsd:autonomous` — Run remaining phases autonomously
- `gsd:complete-milestone` — Archive completed milestone
- `gsd:stats` — Display project statistics
- `gsd:health` — Diagnose planning directory health

## Communication Skills
- `gmail-inbox` — Manage emails across Gmail accounts
- `gmail-label` — Auto-label emails (Action Required, Waiting On, Reference)
- `outline-publish` — Publish wiki pages to Outline

## Research Skills
- `market-research` — Research market for new product/service opportunities
- `web-research` — General web research
- `last30days` — Research any topic from the last 30 days

## Board Capabilities (Escalation Resources)
The Board (Eslam) has these local Claude Code subagents for immediate, on-demand work:
- `code-reviewer` — Unbiased code review with zero prior context. Returns correctness, readability, performance, security verdicts
- `qa` — Generates tests for any code snippet, runs them, reports pass/fail results
- `research` — Deep research agent with web + file access. Thorough investigation with sourced answers
- `market-research` — Full market validation across Web, Reddit, X. 15-35 search queries, structured report with verdicts
- `project-init` — Project documentation scaffolding (CLAUDE.md, DEVLOG.md, .env.example)

When to escalate to Board: Hiring >$50k, deals >$100k, product pivots, unresolvable blockers

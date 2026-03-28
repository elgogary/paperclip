# Services Map

All 81 service files in `server/src/services/`, grouped by domain.

## Heartbeat — Agent Run Lifecycle (9 files, ~3,500 LOC)

| File | Lines | What it does |
|------|-------|--------------|
| `heartbeat.ts` | 307 | **Stub** — wires 6 sub-modules via $ bag, exports `heartbeatService(db)` |
| `heartbeat-helpers.ts` | 745 | Pure helpers, constants, types |
| `heartbeat-session.ts` | 377 | Agent task session management |
| `heartbeat-workspace.ts` | 229 | Workspace resolution for runs |
| `heartbeat-run-ops.ts` | 645 | Run lifecycle: queue, start, finish, status, budget guard |
| `heartbeat-execution.ts` | 975 | `executeRun` — drives adapter call end-to-end |
| `heartbeat-wakeup.ts` | 679 | Wakeup queueing, issue promotion, dedup |
| `heartbeat-cancellation.ts` | 216 | Cancel runs and budget-scope work |
| `heartbeat-run-summary.ts` | 35 | Parse run result JSON to human summary |

## Portability — Import/Export (8 files, ~4,000 LOC)

| File | Lines | What it does |
|------|-------|--------------|
| `company-portability.ts` | 180 | **Stub** — wires import/export, exports `companyPortabilityService(db)` |
| `portability-export.ts` | 899 | Bundle export: agents, instructions, skills, assets, issues |
| `portability-import.ts` | 1042 | Bundle import: create/update company, agents, skills |
| `portability-manifest.ts` | 911 | Parse manifest, build file maps, validate entries |
| `portability-skills.ts` | 879 | Skill serialization, GitHub source parsing |
| `portability-helpers.ts` | 706 | File format helpers, binary encoding |
| `portability-yaml-render.ts` | 187 | Render YAML/Markdown agent config docs |
| `company-export-readme.ts` | 172 | Generate COMPANY.md for exports |

## Skills (12 files, ~3,400 LOC)

| File | Lines | What it does |
|------|-------|--------------|
| `company-skills.ts` | 1103 | **Main** — skill CRUD, sync, runtime entries ⚠️ NEEDS SPLIT |
| `skill-inventory.ts` | 278 | Classify, name normalization, DB↔adapter mapping |
| `skill-import-sources.ts` | 699 | Fetch from GitHub/local/workspace scan |
| `skill-resolution.ts` | 283 | Resolve by key/slug, enrich metadata |
| `skill-retrieval.ts` | 144 | Retrieve skills relevant to a run |
| `skill-evolution.ts` | 306 | Detect helpfulness from transcripts |
| `skill-feedback-parser.ts` | 84 | Parse `@@skill` feedback tokens |
| `skill-versions.ts` | 135 | Version history per company |
| `skill-audit.ts` | 155 | Coverage, unused, missing |
| `skill-creator.ts` | 67 | AI-assisted skill generation |
| `skill-metrics-tracker.ts` | 71 | Per-agent usage metrics |
| `skills.ts` | 112 | Simple CRUD for standalone skills table |

## Issues (7 files, ~2,000 LOC)

| File | Lines | What it does |
|------|-------|--------------|
| `issues.ts` | 1173 | **Main** — CRUD, list/filter, checkout, labels ⚠️ NEEDS SPLIT |
| `issue-comments.ts` | 139 | Comment CRUD |
| `issue-attachments.ts` | 164 | Attachment CRUD |
| `issue-checkout.ts` | 293 | Checkout/lock management |
| `issue-approvals.ts` | 174 | Link/unlink approvals |
| `issue-assignment-wakeup.ts` | 48 | Wakeup on assignment |
| `issue-goal-fallback.ts` | 56 | Goal resolution via project fallback |

## Workspace (6 files, ~2,300 LOC)

| File | Lines | What it does |
|------|-------|--------------|
| `workspace-runtime.ts` | 106 | **Stub** — delegates to sibling modules |
| `workspace-provision.ts` | 679 | Git worktree provision/cleanup |
| `runtime-services.ts` | 835 | Service lifecycle, spawn, idle-stop |
| `execution-workspaces.ts` | 99 | CRUD for execution_workspaces table |
| `execution-workspace-policy.ts` | 209 | Parse/validate workspace policies |
| `workspace-operations.ts` | 261 | Operation event logging |

## Agents (5 files, ~1,800 LOC)

| File | Lines | What it does |
|------|-------|--------------|
| `agents.ts` | 693 | Agent CRUD, API keys, org tree, config revisions |
| `agent-instructions.ts` | 734 | Instruction bundles: create, update, sync from file |
| `agent-readiness.ts` | 179 | 6-dimension readiness score |
| `agent-access.ts` | 37 | Agent-level ACL grants |
| `agent-permissions.ts` | 27 | Permission normalization |

## Finance & Budget (4 files, ~1,500 LOC)

| File | Lines | What it does |
|------|-------|--------------|
| `budgets.ts` | 958 | Policies, incidents, utilization, pause/resume |
| `costs.ts` | 364 | Cost event ingestion, monthly spend |
| `finance.ts` | 134 | Non-metered billing events |
| `quota-windows.ts` | 64 | Quota windows from adapter |

## Access & Auth (5 files, ~1,000 LOC)

| File | Lines | What it does |
|------|-------|--------------|
| `access.ts` | 380 | Membership CRUD, permission grants |
| `board-auth.ts` | 354 | Board API keys, CLI auth, BetterAuth shim |
| `agent-access.ts` | 37 | Agent ACL grants |
| `agent-permissions.ts` | 27 | Permission normalization |
| `agent-readiness.ts` | 179 | Readiness scores |

## Scheduled Jobs (3 files, ~600 LOC)

| File | Lines | What it does |
|------|-------|--------------|
| `scheduled-jobs.ts` | 196 | CRUD for jobs and runs |
| `scheduler-loop.ts` | 164 | 60s interval, `FOR UPDATE SKIP LOCKED` |
| `scheduled-job-executors.ts` | 241 | Executors: knowledge_sync, webhook, agent_run |

## Routines (1 file)

| File | Lines | What it does |
|------|-------|--------------|
| `routines.ts` | 1268 | CRUD, triggers, run lifecycle, catch-up |

## Swarm (1 file)

| File | Lines | What it does |
|------|-------|--------------|
| `swarm.ts` | 300 | Sources, catalog, installs, audit log |

## Other Services

| File | Lines | What it does |
|------|-------|--------------|
| `companies.ts` | 312 | Company CRUD, stats, archive |
| `projects.ts` | 859 | Project CRUD, workspace CRUD |
| `goals.ts` | 80 | Goal CRUD + defaults |
| `approvals.ts` | 272 | Approval lifecycle |
| `secrets.ts` | 378 | Secret CRUD, provider dispatch |
| `attachment-context.ts` | 463 | Build attachment context for runs |
| `attachment-resolver.ts` | 281 | Parse @attach tokens |
| `documents.ts` | 433 | Issue document CRUD |
| `mcp-servers.ts` | 193 | MCP server config CRUD |
| `connectors.ts` | 99 | Connector CRUD |
| `plugins.ts` | 133 | Plugin CRUD |
| `activity.ts` | 163 | Activity log queries |
| `dashboard.ts` | 109 | Dashboard summary |
| `sidebar-badges.ts` | 55 | Inbox badge counts |
| `instance-settings.ts` | 137 | Instance settings |
| `cron.ts` | 373 | Cron parser/validator |
| `chat-sessions.ts` | 91 | Public chat sessions |
| `live-events.ts` | 54 | SSE event pub/sub |

## Files Needing Completion (⚠️)

These files have extracted modules but the original wasn't trimmed:

| File | Current Lines | Modules Exist | Status |
|------|--------------|---------------|--------|
| `company-skills.ts` | 1103 | 10 modules | Logic duplicated — needs stub rewrite |
| `issues.ts` | 1173 | 6 modules | Logic duplicated — needs stub rewrite |

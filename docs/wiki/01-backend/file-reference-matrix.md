# File Reference Matrix — Sanad AI EOI Platform

> Complete map of every file in the codebase with its purpose.
> **Generated:** 2026-03-28 | **Branch:** `main-sanad-eoi-app`

## Quick Stats

| Category | Count |
|---|---|
| Service files (`server/src/services/`) | **89** |
| Route files (`server/src/routes/`) | **48** |
| DB tables (`packages/db/src/schema/`) | **76** |
| UI pages (`ui/src/pages/`) | **54** |
| UI components (top-level + subfolders) | **~130** |
| Agent adapters | **12** |
| CLI command files | **26** |

---

## 1. `server/src/services/` — Business Logic

### Heartbeat / Agent Run Lifecycle

| File | Description |
|---|---|
| `heartbeat.ts` | Thin orchestrator stub; wires 7 sibling modules via `$` bag pattern |
| `heartbeat-helpers.ts` | Pure utility functions, types, constants shared by all heartbeat modules |
| `heartbeat-session.ts` | Session management: get/create/compact task sessions for runs |
| `heartbeat-workspace.ts` | Workspace resolution: maps agent + issue context to working directory |
| `heartbeat-run-ops.ts` | Run lifecycle CRUD: queue, status transitions, event appending, reaping |
| `heartbeat-execution.ts` | `executeRun`: spawns adapter, wires runtime services, streams output |
| `heartbeat-wakeup.ts` | Wakeup request enqueue and issue-execution promotion on unlock |
| `heartbeat-cancellation.ts` | Kill running processes, bulk-cancel project-scoped runs |
| `heartbeat-run-summary.ts` | Trims raw adapter result JSON to safe displayable summary fields |

### Company Portability (Import / Export)

| File | Description |
|---|---|
| `company-portability.ts` | Thin stub: wires export/import ops, exposes `resolveSource` |
| `portability-export.ts` | Builds COMPANY.md export package: agents, projects, issues, skills, org chart |
| `portability-import.ts` | Parses export package and upserts all entities |
| `portability-yaml-render.ts` | YAML scalar rendering helpers |
| `portability-helpers.ts` | File map normalization, binary encoding, content-type inference |
| `portability-manifest.ts` | Reads `include` entries and builds `CompanyPortabilityManifest` |
| `portability-skills.ts` | Skill-specific portability: manifest key derivation, skill upsert |
| `company-export-readme.ts` | Generates README.md with Mermaid org chart for exported packages |

### Skill System

| File | Description |
|---|---|
| `company-skills.ts` | Primary skill service stub: CRUD, sync-preference, GitHub normalization |
| `skill-inventory.ts` | Classification, naming normalization, DB row ↔ domain object mapping |
| `skill-import-sources.ts` | GitHub/URL/local file import: fetch, validate, write to disk |
| `skill-resolution.ts` | Skill lookup, enrichment (source badges), path resolution |
| `skills.ts` | Core `skills` table CRUD (global skill registry) |
| `skill-audit.ts` | Scores skill markdown quality (clarity, specificity, examples) |
| `skill-creator.ts` | AI-assisted skill generation from a prompt |
| `skill-evolution.ts` | Auto-fix loop: patches skill markdown from run feedback (max 3/24h) |
| `skill-metrics-tracker.ts` | Records per-agent skill usage metrics |
| `skill-retrieval.ts` | Semantic skill retrieval scored by agent usage history |
| `skill-feedback-parser.ts` | Parses structured skill feedback from adapter result JSON |
| `skill-versions.ts` | Versioned snapshots of skill markdown |
| `tool-degradation-monitor.ts` | Detects repeated tool errors in 1-hour window |

### Issues / Tasks

| File | Description |
|---|---|
| `issues.ts` | Core issue CRUD, list with filters, label management, read-state |
| `issue-comments.ts` | Comment add/list/delete with mention parsing |
| `issue-attachments.ts` | Attachment CRUD: link, unlink, list per issue |
| `issue-checkout.ts` | Checkout/lock: claim, release, detect stale locks |
| `issue-approvals.ts` | Links approvals to issues; validates state transitions |
| `issue-assignment-wakeup.ts` | Triggers agent wakeup when issue is assigned |
| `issue-goal-fallback.ts` | Resolves correct goal ID (project goal or company default) |

### Workspace Runtime

| File | Description |
|---|---|
| `workspace-runtime.ts` | Thin stub; re-exports from `workspace-provision` and `runtime-services` |
| `workspace-provision.ts` | Git worktree provision/teardown and env sanitization |
| `runtime-services.ts` | Lifecycle management for sidecar services (MCP, databases) per run |
| `workspace-operations.ts` | CRUD for workspace operation records (provision steps with phases) |
| `workspace-operation-log-store.ts` | Local-file log store for workspace operation output streams |
| `execution-workspaces.ts` | Read service for `execution_workspaces` table |
| `execution-workspace-policy.ts` | Resolves and validates execution workspace mode from agent config |

### Scheduled Jobs & Scheduler

| File | Description |
|---|---|
| `scheduled-jobs.ts` | CRUD for scheduled jobs and runs; cron expression parsing |
| `scheduler-loop.ts` | In-process 60-second tick loop with `FOR UPDATE SKIP LOCKED` |
| `scheduled-job-executors.ts` | Job executors: `knowledge_sync`, `webhook` (SSRF guard), `agent_run`, `dream`, `memory_ingest` |

### Capability Swarm

| File | Description |
|---|---|
| `swarm.ts` | CRUD for swarm sources, capabilities, installs, and audit log |

### Core Domain Services

| File | Description |
|---|---|
| `agents.ts` | Agent CRUD, API key management, config revisions, runtime state |
| `companies.ts` | Company CRUD, stats aggregation (agents, issues, cost totals) |
| `access.ts` | Membership/permission queries, `principalPermissionGrants` lookups |
| `agent-access.ts` | Per-agent user access CRUD (`agent_user_access` table) |
| `agent-permissions.ts` | Derives normalized permission set from agent role |
| `agent-readiness.ts` | Scores agent readiness across config, activity, and cost dimensions |
| `agent-instructions.ts` | Reads agent instruction bundles from filesystem or URLs |
| `default-agent-instructions.ts` | Fetches bundled default instruction files (AGENTS.md, HEARTBEAT.md, SOUL.md) |
| `board-auth.ts` | Board API key and CLI auth challenge management |
| `approvals.ts` | Approval CRUD: create, resolve, revise, track hire approvals |
| `goals.ts` | Goal hierarchy CRUD with default company goal fallback |
| `projects.ts` | Project CRUD with workspace and goal associations |
| `routines.ts` | Routine CRUD: cron-triggered tasks with catch-up and concurrency policies |
| `documents.ts` | Issue-attached document CRUD with revision tracking |
| `work-products.ts` | Issue work product CRUD |
| `assets.ts` | Generic binary asset CRUD keyed by company + agent |
| `secrets.ts` | Company secret management: env bindings with redaction |
| `budgets.ts` | Budget policy enforcement: spend tracking, quota checks |
| `costs.ts` | Cost event aggregation: metered vs subscription billing |
| `finance.ts` | Finance event ledger: revenue, expenses, transfers |
| `dashboard.ts` | Company dashboard summary: agent/issue/approval counts + budget |
| `activity.ts` | Activity feed queries with agent/entity filters |
| `activity-log.ts` | Writes structured activity log entries with live-event publishing |
| `live-events.ts` | In-process EventEmitter pub/sub for SSE live event broadcasting |
| `sidebar-badges.ts` | Aggregates pending approval and failed run counts for sidebar badges |
| `run-log-store.ts` | Local-file log store for agent run output |
| `chat-sessions.ts` | HMAC-signed chat session tokens for public agent chat |
| `plugins.ts` | Plugin CRUD and agent access management |
| `mcp-servers.ts` | MCP server config CRUD + catalog entries + agent access grants |
| `connectors.ts` | OAuth connector CRUD |
| `hire-hook.ts` | Sends hire-approved notification to newly hired agent |
| `instance-settings.ts` | Read/write general and experimental instance settings |
| `cron.ts` | Lightweight cron expression parser and next-run calculator |
| `quota-windows.ts` | Queries provider quota windows from registered adapters |
| `attachment-resolver.ts` | Resolves uploaded attachment records from storage |
| `attachment-context.ts` | Builds vision blocks and file notes for agent run context injection |
| `attachment-extractors.ts` | Format-specific text extractors: PDF, DOCX/XLSX |
| `index.ts` | Barrel: re-exports all public service symbols |

---

## 2. `server/src/routes/` — Express Route Handlers

### Stub Routers (split pattern)

| File | Description |
|---|---|
| `access.ts` | Stub: mounts `access-auth`, `access-invites`, `access-members`, `access-skills` |
| `agents.ts` | Stub: mounts `agent-config`, `agent-heartbeats`, `agent-lifecycle` |
| `issues.ts` | Stub: mounts `issue-comments`, `issue-attachments`, `issue-documents` |

### Access Sub-routers

| File | Description |
|---|---|
| `access-auth.ts` | Login/logout, CLI auth challenge create/resolve |
| `access-invites.ts` | Company invite create/accept, join requests |
| `access-members.ts` | Member list, permission updates, join-request claiming |
| `access-skills.ts` | Unauthenticated skill discovery: list, read skill markdown |
| `access-helpers.ts` | Shared helpers: skill file listing, markdown reading, token verification |

### Agent Sub-routers

| File | Description |
|---|---|
| `agent-config.ts` | Adapter config, skill sync, instructions bundle, environment test |
| `agent-heartbeats.ts` | Wakeup, cancel, run list, run detail, live event stream, reset session |
| `agent-lifecycle.ts` | Agent create/list/get/update/delete/key generation |
| `agent-helpers.ts` | Shared `AgentRouteContext` factory and route-layer utilities |

### Issue Sub-routers

| File | Description |
|---|---|
| `issue-comments.ts` | Comment add/list/delete with attachment context injection |
| `issue-attachments.ts` | Multipart upload, metadata create/list/delete |
| `issue-documents.ts` | Document upsert/delete and work product CRUD |
| `issue-route-context.ts` | Shared `IssueRouteServices` factory and `normalizeIssueIdentifier` |
| `issues-checkout-wakeup.ts` | Pure function: decides whether to wake assignee on checkout |

### Feature Routes

| File | Description |
|---|---|
| `sanad-brain.ts` | Reverse proxy for Sanad Brain API (`/brain/*`) — **DO NOT MODIFY** |
| `scheduled-jobs.ts` | Scheduled job CRUD + manual trigger + log streaming |
| `swarm.ts` | Capability swarm REST: sources, capabilities, installs, audit log |
| `evolution.ts` | Skill evolution events list + metrics record |
| `public-chat.ts` | Unauthenticated public agent chat: session create/validate, message send/list |
| `company-skills.ts` | Company skill CRUD, sync, scan, GitHub import, compatibility check |
| `skills.ts` | Global skill registry CRUD + agent access + AI-create |
| `plugins.ts` | Plugin CRUD + agent access + state/logs/webhooks/entities |
| `mcp-servers.ts` | MCP server config CRUD + catalog + agent access + workspace log stream |
| `connectors.ts` | OAuth connector CRUD |
| `org-chart-svg.ts` | Server-side SVG/PNG org chart renderer (5 visual styles) |
| `agent-readiness.ts` | `GET /agents/:id/readiness` — scored readiness report |
| `agent-access.ts` | Per-agent user access CRUD |

### Standard Routes

| File | Description |
|---|---|
| `companies.ts` | Company CRUD + export/import + portability package |
| `projects.ts` | Project CRUD + workspace management + goal linking |
| `routines.ts` | Routine CRUD + trigger CRUD + manual trigger |
| `goals.ts` | Goal hierarchy CRUD + project goal linking |
| `approvals.ts` | Approval workflow: create, resolve, revise, resubmit, comment |
| `secrets.ts` | Company secret CRUD |
| `costs.ts` | Cost event aggregation queries |
| `activity.ts` | Activity feed with live SSE stream |
| `dashboard.ts` | Company dashboard summary |
| `execution-workspaces.ts` | Execution workspace list/detail + operation log streaming |
| `attachments.ts` | Global attachment upload/download/delete |
| `llms.ts` | List available adapter models |
| `health.ts` | `GET /health` — liveness check |
| `sidebar-badges.ts` | `GET /sidebar-badges` — pending counts for nav badges |
| `instance-settings.ts` | General and experimental instance settings read/write |
| `assets.ts` | Company binary asset upload/download/delete |
| `authz.ts` | Shared auth guards: `assertBoard`, `assertInstanceAdmin`, `assertCompanyAccess` |
| `index.ts` | Barrel: re-exports all route factory functions |

---

## 3. `server/src/adapters/` — Agent Runtime Adapters

| File / Folder | Description |
|---|---|
| `registry.ts` | Registers all adapters; provides `getServerAdapter` |
| `types.ts` | Re-exports all adapter types from `@paperclipai/adapter-utils` |
| `utils.ts` | Re-exports `runningProcesses`, parse helpers, template renderer |
| `cursor-models.ts` | Fetches and caches Cursor model list (TTL 60s) |
| `codex-models.ts` | Fetches and caches OpenAI model list (TTL 60s) |
| `http/` | HTTP adapter: POSTs to a configured URL and streams response |
| `process/` | Process adapter: spawns an arbitrary local command, captures output |

---

## 4. `ui/src/pages/` — React UI Pages

### Agent Management

| File | Description |
|---|---|
| `AgentDetail.tsx` | Agent detail stub — routes to 8 tab components |
| `agent-detail/AgentOverview.tsx` | Overview: live run widget, recent runs, cost summary |
| `agent-detail/ConfigurationTab.tsx` | Adapter settings, model, workspace, skill sync |
| `agent-detail/PromptsTab.tsx` | System instructions, bundle mode, file path editor |
| `agent-detail/AgentSkillsTab.tsx` | Assigned skills list with sync status |
| `agent-detail/RunsTab.tsx` | Paginated heartbeat run history with log viewer |
| `agent-detail/LogViewer.tsx` | Inline run log reader with streaming support |
| `agent-detail/KeysTab.tsx` | API keys: generate, revoke, list |
| `Agents.tsx` | Agents list with status badges |
| `NewAgent.tsx` | Agent creation wizard |

### Work Management

| File | Description |
|---|---|
| `Issues.tsx` | Issue board: kanban + list view with filters |
| `IssueDetail.tsx` | Issue detail: comments, attachments, documents, run activity |
| `MyIssues.tsx` | Personal issue list |
| `Inbox.tsx` | Unread activity and issue notifications |
| `Projects.tsx` | Projects list with workspace indicators |
| `ProjectDetail.tsx` | Project detail: issues, workspaces, goals, knowledge graph |
| `Goals.tsx` | Goals hierarchy list |
| `GoalDetail.tsx` | Goal detail: linked issues, progress |
| `Routines.tsx` | Routine list with status and next-run |
| `RoutineDetail.tsx` | Routine detail: triggers, run history, config |
| `Approvals.tsx` | Pending and resolved approvals |
| `ApprovalDetail.tsx` | Approval detail with resolution actions |
| `ScheduledJobs.tsx` | Scheduled jobs table/card view with filters |

### Features

| File | Description |
|---|---|
| `Swarm.tsx` | Capability Swarm: 5 tabs — Catalog, My Swarm, Sources, Queue, Audit |
| `CompanySkills.tsx` | Company skill library: list, import, sync, compatibility |
| `Skills.tsx` | Global skill registry with AI-create and audit cards |
| `Toolkit.tsx` | Plugins, MCP servers, connectors management |
| `SanadBrain.tsx` | Sanad Brain: knowledge, memories, audit, health, live, graph tabs |
| `Chat.tsx` | Internal agent chat (authenticated) |
| `PublicChat.tsx` | Embeddable public agent chat |
| `Costs.tsx` | Cost analytics: spend by agent/project/time |
| `Dashboard.tsx` | Company dashboard: agent status, activity, budget |
| `Activity.tsx` | Full activity feed with live updates |
| `Org.tsx` / `OrgChart.tsx` | Interactive SVG org chart viewer |

### Settings & Admin

| File | Description |
|---|---|
| `CompanySettings.tsx` | Company settings: name, logo, model defaults |
| `CompanyExport.tsx` | Export wizard: choose scope, download COMPANY.md package |
| `CompanyImport.tsx` | Import wizard: upload package, preview, apply |
| `Companies.tsx` | Multi-tenant company switcher (instance admin) |
| `InstanceSettings.tsx` | Instance settings router |
| `InstanceGeneralSettings.tsx` | General config: deployment mode, auth, LLM provider |
| `InstanceExperimentalSettings.tsx` | Experimental feature flags |
| `ExecutionWorkspaceDetail.tsx` | Workspace detail: provision log, operation history |
| `Auth.tsx` | Login with Better Auth |
| `BoardClaim.tsx` | Initial admin bootstrap |
| `CliAuth.tsx` | CLI OAuth challenge resolution |
| `InviteLanding.tsx` | Invite acceptance landing |

---

## 5. `ui/src/components/` — Component Groups

| Subfolder | Files | Purpose |
|---|---|---|
| `swarm/` | 5 | Capability Swarm tabs: Catalog, MySwarm, Sources, Queue, Audit |
| `skills/` | 10 | Skill management: list, detail, code editor, audit card, metrics, version history, evolution |
| `new-issue/` | 4 | NewIssueDialog helpers: file staging, draft persistence, workspace section |
| `attachments/` | 2 | AttachmentCard (display) + AttachmentUploadZone (drag-and-drop) |
| `chat/` | 12 | ChatView, ChatModal, ChatSidebar, VoiceRecorder, SlashCommandMenu, history drawers |
| `scheduled-jobs/` | 3 | JobDialog, JobLogsDrawer, JobTypeConfigFields |
| `toolkit/` | 8 | Plugins, MCP servers, connectors sections with detail drawers and marketplace |
| `transcript/` | 3 | RunTranscriptView (adapter log renderer) + live transcript hook |
| `sanad-brain/` | 8 | Brain tabs: Knowledge, Memories, Health, Live, Audit, Graph, helpers |

---

## 6. `packages/db/src/schema/` — Database Tables (76 tables)

### Core Entities
`companies` · `agents` · `projects` · `issues` · `goals` · `user`

### Run Lifecycle
`heartbeat_runs` · `heartbeat_run_events` · `agent_runtime_state` · `agent_wakeup_requests` · `agent_task_sessions` · `agent_metrics`

### Access & Auth
`company_memberships` · `instance_user_roles` · `principal_permission_grants` · `agent_user_access` · `board_api_keys` · `agent_api_keys` · `agent_config_revisions` · `invites` · `join_requests` · `cli_auth_challenges`

### Skills & Knowledge
`skills` · `company_skills` · `skill_versions` · `skill_agent_access` · `skill_agent_metrics` · `evolution_events`

### Approvals & Finance
`approvals` · `approval_comments` · `issue_approvals` · `budget_policies` · `budget_incidents` · `cost_events` · `finance_events`

### Plugins, MCP & Connectors
`plugins` · `plugin_agent_access` · `plugin_config` · `plugin_company_settings` · `plugin_state` · `plugin_logs` · `plugin_jobs` · `plugin_entities` · `plugin_webhooks` · `mcp_server_configs` · `mcp_agent_access` · `mcp_catalog` · `connectors`

### Capability Swarm
`swarm_sources` · `swarm_capabilities` · `swarm_installs` · `swarm_audit_log`

### Workspace & Execution
`execution_workspaces` · `project_workspaces` · `workspace_operations` · `workspace_runtime_services`

### Other
`routines` · `scheduled_jobs` · `scheduled_job_runs` · `documents` · `document_revisions` · `attachments` · `issue_attachments` · `issue_comments` · `issue_documents` · `issue_work_products` · `issue_read_states` · `issue_labels` · `labels` · `assets` · `company_logos` · `company_secrets` · `company_secret_versions` · `activity_log` · `chat_sessions` · `agent_notes` · `instance_settings` · `project_goals`

---

## 7. Entry Points

| File | Description |
|---|---|
| `server/src/app.ts` | Express app factory: mounts all routers, auth middleware, static UI, CORS |
| `server/src/index.ts` | Bootstrap: DB migration, port detection, WebSocket, scheduler start |

---

## 8. `cli/src/commands/` — CLI Commands

### Setup Commands
`run.ts` · `configure.ts` · `onboard.ts` · `doctor.ts` · `env.ts` · `db-backup.ts` · `allowed-hostname.ts` · `auth-bootstrap-ceo.ts` · `heartbeat-run.ts`

### Worktree Commands
`worktree.ts` (stub) · `worktree-init.ts` · `worktree-cleanup.ts` · `worktree-helpers.ts` · `worktree-lib.ts` · `worktree-merge-history-lib.ts`

### Client (API) Commands
`client/auth.ts` · `client/context.ts` · `client/agent.ts` · `client/issue.ts` · `client/approval.ts` · `client/activity.ts` · `client/dashboard.ts` · `client/company.ts` · `client/plugin.ts` · `client/zip.ts` · `client/common.ts`

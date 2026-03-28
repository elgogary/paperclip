# Database Schema

PostgreSQL via Drizzle ORM. Schema split one-per-table in `packages/db/src/schema/`.

## Entity Relationship Diagram

```
Company (tenant root)
├── agents ──┬── agent_runtime_state (1:1)
│            ├── agent_task_sessions (1:N)
│            ├── agent_config_revisions (1:N)
│            ├── agent_api_keys (1:N)
│            ├── agent_wakeup_requests (1:N) → heartbeat_runs
│            └── agent_user_access (N:M users)
│
├── projects ──┬── project_workspaces (1:N, git repos)
│              └── execution_workspaces (1:N, ephemeral)
│
├── issues ──┬── issue_comments (1:N)
│            ├── issue_attachments (1:N) → assets
│            ├── issue_documents (1:N) → documents → document_revisions
│            ├── issue_work_products (1:N)
│            ├── issue_labels (N:M) → labels
│            ├── issue_approvals (N:M) → approvals
│            └── issue_read_states (N:M users)
│
├── goals (self-referencing tree)
├── routines → routine_triggers → routine_runs
├── scheduled_jobs → scheduled_job_runs
├── budget_policies → budget_incidents
├── cost_events → finance_events
├── swarm_sources → swarm_capabilities → swarm_installs
├── company_skills + skills (two skill systems)
├── mcp_server_configs, connectors, plugins
├── company_secrets → company_secret_versions
├── company_memberships, invites, join_requests
└── activity_log
```

## Core Tables

### companies
Tenant root. All data scoped by `companyId`.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| name | text | |
| status | text | active, paused, archived |
| issuePrefix | text UNIQUE | e.g. "OPT" — for issue identifiers |
| issueCounter | int | Auto-increment for issue numbers |
| budgetMonthlyCents | int | Company-level budget |
| spentMonthlyCents | int | Current month spend |
| requireBoardApprovalForNewAgents | bool | |
| brandColor | text | |

### agents
AI workers assigned to a company.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| companyId | FK → companies | |
| name | text | |
| role | text | ceo, cto, engineer, pm, qa, etc. |
| status | text | active, paused, idle, running, error, pending_approval, terminated |
| reportsTo | FK → agents | Self-referencing org tree |
| adapterType | text | claude_local, codex_local, cursor, etc. |
| adapterConfig | jsonb | Adapter-specific config |
| runtimeConfig | jsonb | Session, compaction, timeout settings |
| budgetMonthlyCents | int | |
| permissions | jsonb | ACL grants |

### issues
Tasks/work items assigned to agents.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| companyId | FK → companies | |
| projectId | FK → projects | Optional |
| parentId | FK → issues | Sub-issues |
| title | text | |
| status | text | backlog, todo, in_progress, in_review, done, blocked, cancelled |
| priority | text | critical, high, medium, low |
| assigneeAgentId | FK → agents | |
| checkoutRunId | FK → heartbeat_runs | Lock to run |
| issueNumber | int | Per-company sequence |
| identifier | text UNIQUE | e.g. "OPT-42" |
| originKind | text | manual, email, routine, agent, etc. |

### heartbeat_runs
One row per agent execution cycle.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| agentId | FK → agents | |
| status | text | queued, running, succeeded, failed, cancelled, timed_out |
| invocationSource | text | board, automation, agent, cli |
| usageJson | jsonb | Token counts |
| resultJson | jsonb | Run outcome |
| logStore / logRef | text | Where logs are stored |
| exitCode | int | |
| processPid | int | OS process ID |

### heartbeat_run_events
Live log stream from agent runs (SSE).

| Column | Type | Notes |
|--------|------|-------|
| id | bigserial PK | |
| runId | FK → heartbeat_runs | |
| eventType | text | log, tool_call, result, etc. |
| stream | text | stdout, stderr |
| message | text | |
| payload | jsonb | |

## Skills Tables (Two Systems)

### company_skills
CLAUDE.md-style instruction docs per company.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| companyId | FK | |
| key | text | Unique per company |
| name, description | text | |
| markdown | text | Full skill content |
| sourceType | text | local, github, url |
| sourceLocator | text | Path or URL |
| trustLevel | text | |

### skills
Structured skills with evolution tracking.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| companyId | FK | |
| name, slug | text | slug unique per company |
| instructions | text | |
| category, source | text | |
| version | int | |
| qualityMetrics | jsonb | |
| evolutionStatus | text | |

Related: `skill_versions`, `skill_agent_metrics`, `skill_agent_access`, `evolution_events`

## Swarm Tables (Capability Marketplace)

### swarm_sources
Registries/repos of capabilities.

| Column | Type | Notes |
|--------|------|-------|
| sourceType | text | local_path, registry, github, npm, custom_url |
| trustLevel | text | trusted, verified, community, unknown |
| capabilityTypes | jsonb | Array of types |

### swarm_capabilities
Indexed capability catalogue.

| Column | Type | Notes |
|--------|------|-------|
| capabilityType | text | skill, mcp, connector, plugin |
| pricingTier | text | free, paid, premium |
| configTemplate | jsonb | |
| requiredSecrets | jsonb | |

### swarm_installs
Installed capabilities per company.

### swarm_audit_log
All swarm actions (install, remove, approve, deny, sync, evaluate, flag).

## Finance Tables

### cost_events
Per-run token costs.

| Column | Type | Notes |
|--------|------|-------|
| provider | text | anthropic, openai, etc. |
| model | text | claude-sonnet-4-20250514, gpt-4o, etc. |
| inputTokens, outputTokens | int | |
| costCents | int | |

### budget_policies
Spend limits per scope (company/agent/project).

### budget_incidents
Threshold breach events.

## Access Control Tables

| Table | Purpose |
|-------|---------|
| `company_memberships` | User/agent membership in company |
| `principal_permission_grants` | Fine-grained permissions |
| `instance_user_roles` | Instance admin roles |
| `invites` | Join invite tokens |
| `join_requests` | Agent self-service join |
| `board_api_keys` | Board-level API auth |
| `agent_api_keys` | Agent-level API auth |
| `cli_auth_challenges` | CLI device auth flow |

## Plugin Tables

| Table | Purpose |
|-------|---------|
| `plugins` | Installed plugins |
| `plugin_config` | Per-company plugin config |
| `plugin_state` | Key-value state storage |
| `plugin_entities` | Plugin-owned entities |
| `plugin_jobs` / `plugin_job_runs` | Plugin scheduled jobs |
| `plugin_webhooks` | Inbound webhook records |
| `plugin_logs` | Plugin log events |
| `plugin_agent_access` | Agent ↔ plugin ACL |

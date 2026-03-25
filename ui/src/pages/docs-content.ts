export type DocPage = {
  id: string;
  title: string;
  content: string;
};

export type DocSection = {
  id: string;
  title: string;
  icon: string; // lucide icon name
  pages: DocPage[];
};

export const DOC_SECTIONS: DocSection[] = [
  // ─────────────────────────────────────────────────────────────
  // 1. GETTING STARTED
  // ─────────────────────────────────────────────────────────────
  {
    id: "getting-started",
    title: "Getting Started",
    icon: "BookOpen",
    pages: [
      {
        id: "overview",
        title: "Overview",
        content: `# What is Sanad AI EOI?

Sanad AI EOI (Enterprise Operational Intelligence) is the control plane for autonomous AI companies. It is the infrastructure backbone that enables AI workforces to operate with structure, governance, and accountability.

One instance can run multiple companies. Each company has employees (AI agents), org structure, goals, budgets, and task management — everything a real company needs, except the operating system is real software.

## The Problem

Task management software doesn't go far enough. When your entire workforce is AI agents, you need more than a to-do list — you need a **control plane** for an entire company.

## What Sanad AI Does

Sanad AI is the command, communication, and control plane for a company of AI agents. It is the single place where you:

- **Manage agents as employees** — hire, organize, and track who does what
- **Define org structure** — org charts that agents themselves operate within
- **Track work in real time** — see at any moment what every agent is working on
- **Control costs** — token salary budgets per agent, spend tracking, burn rate
- **Align to goals** — agents see how their work serves the bigger mission
- **Govern autonomy** — board approval gates, activity audit trails, budget enforcement

## Two Layers

### 1. Control Plane (Sanad AI)

The central nervous system. Manages agent registry and org chart, task assignment and status, budget and token spend tracking, goal hierarchy, and heartbeat monitoring.

### 2. Execution Services (Adapters)

Agents run externally and report into the control plane. Adapters connect different execution environments — Claude Code, OpenAI Codex, shell processes, HTTP webhooks, or any runtime that can call an API.

The control plane doesn't run agents. It orchestrates them. Agents run wherever they run and phone home.

## Core Principle

You should be able to look at Sanad AI and understand your entire company at a glance — who's doing what, how much it costs, and whether it's working.`,
      },
      {
        id: "quickstart",
        title: "Quickstart",
        content: `# Quickstart

Get Sanad AI running locally in under 5 minutes.

## Quick Start (Recommended)

\`\`\`sh
npx sanadai onboard --yes
\`\`\`

This walks you through setup, configures your environment, and gets Sanad AI running.

## Local Development

Prerequisites: Node.js 20+ and pnpm 9+.

\`\`\`sh
pnpm install
pnpm dev
\`\`\`

This starts the API server and UI at [http://localhost:3100](http://localhost:3100).

No external database required — Sanad AI uses an embedded PostgreSQL instance by default.

## One-Command Bootstrap

\`\`\`sh
pnpm sanadai run
\`\`\`

This auto-onboards if config is missing, runs health checks with auto-repair, and starts the server.

## What's Next

Once Sanad AI is running:

1. Create your first company in the web UI
2. Define a company goal
3. Create a CEO agent and configure its adapter
4. Build out the org chart with more agents
5. Set budgets and assign initial tasks
6. Hit go — agents start their heartbeats and the company runs`,
      },
      {
        id: "core-concepts",
        title: "Core Concepts",
        content: `# Core Concepts

Sanad AI organizes autonomous AI work around five key concepts.

## Company

A company is the top-level unit of organization. Each company has:

- A **goal** — the reason it exists (e.g. "Build the #1 AI note-taking app at $1M MRR")
- **Employees** — every employee is an AI agent
- **Org structure** — who reports to whom
- **Budget** — monthly spend limits in cents
- **Task hierarchy** — all work traces back to the company goal

One Sanad AI instance can run multiple companies.

## Agents

Every employee is an AI agent. Each agent has:

- **Adapter type + config** — how the agent runs (Claude Code, Codex, shell process, HTTP webhook)
- **Role and reporting** — title, who they report to, who reports to them
- **Capabilities** — a short description of what the agent does
- **Budget** — per-agent monthly spend limit
- **Status** — active, idle, running, error, paused, or terminated

Agents are organized in a strict tree hierarchy. Every agent reports to exactly one manager (except the CEO). This chain of command is used for escalation and delegation.

## Issues (Tasks)

Issues are the unit of work. Every issue has:

- A title, description, status, and priority
- An assignee (one agent at a time)
- A parent issue (creating a traceable hierarchy back to the company goal)
- A project and optional goal association

### Status Lifecycle

\`\`\`mermaid
graph LR
    backlog --> todo --> in_progress --> in_review --> done
    in_progress --> blocked
\`\`\`

Terminal states: \`done\`, \`cancelled\`.

The transition to \`in_progress\` requires an **atomic checkout** — only one agent can own a task at a time. If two agents try to claim the same task simultaneously, one gets a \`409 Conflict\`.

## Heartbeats

Agents don't run continuously. They wake up in **heartbeats** — short execution windows triggered by Sanad AI.

A heartbeat can be triggered by:

- **Schedule** — periodic timer (e.g. every hour)
- **Assignment** — a new task is assigned to the agent
- **Comment** — someone @-mentions the agent
- **Manual** — a human clicks "Invoke" in the UI
- **Approval resolution** — a pending approval is approved or rejected

Each heartbeat, the agent: checks its identity, reviews assignments, picks work, checks out a task, does the work, and updates status. This is the **heartbeat protocol**.

## Governance

Some actions require board (human) approval:

- **Hiring agents** — agents can request to hire subordinates, but the board must approve
- **CEO strategy** — the CEO's initial strategic plan requires board approval
- **Board overrides** — the board can pause, resume, or terminate any agent and reassign any task

The board operator has full visibility and control through the web UI. Every mutation is logged in an **activity audit trail**.`,
      },
      {
        id: "architecture",
        title: "Architecture",
        content: `# Architecture

Sanad AI is a monorepo with four main layers.

## Stack Overview

\`\`\`
+-------------------------------------+
|  React UI (Vite)                    |
|  Dashboard, org management, tasks   |
+-------------------------------------+
|  Express.js REST API (Node.js)      |
|  Routes, services, auth, adapters   |
+-------------------------------------+
|  PostgreSQL (Drizzle ORM)           |
|  Schema, migrations, embedded mode  |
+-------------------------------------+
|  Adapters                           |
|  Claude Local, Codex Local,         |
|  Gemini Local, Process, HTTP        |
+-------------------------------------+
\`\`\`

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 6, React Router 7, Radix UI, Tailwind CSS 4, TanStack Query |
| Backend | Node.js 20+, Express.js 5, TypeScript |
| Database | PostgreSQL 17 (or embedded PGlite), Drizzle ORM |
| Auth | Better Auth (sessions + API keys) |
| Adapters | Claude Code CLI, Codex CLI, Gemini CLI, shell process, HTTP webhook |
| Package manager | pnpm 9 with workspaces |

## Repository Structure

\`\`\`
sanad-ai/
+-- ui/                          # React frontend
|   +-- src/pages/               # Route pages
|   +-- src/components/          # React components
|   +-- src/api/                 # API client
|   +-- src/context/             # React context providers
|
+-- server/                      # Express.js API
|   +-- src/routes/              # REST endpoints
|   +-- src/services/            # Business logic
|   +-- src/adapters/            # Agent execution adapters
|   +-- src/middleware/          # Auth, logging
|
+-- packages/
|   +-- db/                      # Drizzle schema + migrations
|   +-- shared/                  # API types, constants, validators
|   +-- adapter-utils/           # Adapter interfaces and helpers
|   +-- adapters/
|       +-- claude-local/        # Claude Code adapter
|       +-- codex-local/         # OpenAI Codex adapter
|
+-- skills/                      # Agent skills
|   +-- sanad/               # Core heartbeat protocol skill
|
+-- cli/                         # CLI client
|   +-- src/                     # Setup and control-plane commands
\`\`\`

## Request Flow

When a heartbeat fires:

1. **Trigger** — Scheduler, manual invoke, or event (assignment, mention) triggers a heartbeat
2. **Adapter invocation** — Server calls the configured adapter's \`execute()\` function
3. **Agent process** — Adapter spawns the agent (e.g. Claude Code CLI) with env vars and a prompt
4. **Agent work** — The agent calls the REST API to check assignments, checkout tasks, do work, and update status
5. **Result capture** — Adapter captures stdout, parses usage/cost data, extracts session state
6. **Run record** — Server records the run result, costs, and any session state for next heartbeat

## Adapter Model

Adapters are the bridge between Sanad AI and agent runtimes. Each adapter is a package with three modules:

- **Server module** — \`execute()\` function that spawns/calls the agent, plus environment diagnostics
- **UI module** — stdout parser for the run viewer, config form fields for agent creation
- **CLI module** — terminal formatter for \`sanadai run --watch\`

Built-in adapters: \`claude_local\`, \`codex_local\`, \`gemini_local\`, \`opencode_local\`, \`process\`, \`http\`. You can create custom adapters for any runtime.

## Key Design Decisions

- **Control plane, not execution plane** — Sanad AI orchestrates agents; it doesn't run them
- **Company-scoped** — all entities belong to exactly one company; strict data boundaries
- **Single-assignee tasks** — atomic checkout prevents concurrent work on the same task
- **Adapter-agnostic** — any runtime that can call an HTTP API works as an agent
- **Embedded by default** — zero-config local mode with embedded PostgreSQL`,
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // 2. BOARD OPERATOR
  // ─────────────────────────────────────────────────────────────
  {
    id: "board-operator",
    title: "Board Operator",
    icon: "Crown",
    pages: [
      {
        id: "dashboard",
        title: "Dashboard",
        content: `# Dashboard

The dashboard gives you a real-time overview of your autonomous company's health.

## What You See

- **Agent status** — how many agents are active, idle, running, or in error state
- **Task breakdown** — counts by status (todo, in progress, blocked, done)
- **Stale tasks** — tasks that have been in progress for too long without updates
- **Cost summary** — current month spend vs budget, burn rate
- **Recent activity** — latest mutations across the company

## Key Metrics to Watch

- **Blocked tasks** — these need your attention. Read the comments to understand what's blocking progress and take action (reassign, unblock, or approve).
- **Budget utilization** — agents auto-pause at 100% budget. If you see an agent approaching 80%, consider whether to increase their budget or reprioritize their work.
- **Stale work** — tasks in progress with no recent comments may indicate a stuck agent. Check the agent's run history for errors.

## Dashboard API

The dashboard data is also available via the API:

\`\`\`
GET /api/companies/{companyId}/dashboard
\`\`\`

Returns agent counts by status, task counts by status, cost summaries, and stale task alerts.`,
      },
      {
        id: "creating-a-company",
        title: "Creating a Company",
        content: `# Creating a Company

A company is the top-level unit in Sanad AI. Everything — agents, tasks, goals, budgets — lives under a company.

## Step 1: Create the Company

In the web UI, click "New Company" and provide:

- **Name** — your company's name
- **Description** — what this company does (optional but recommended)

## Step 2: Set a Goal

Every company needs a goal — the north star that all work traces back to. Good goals are specific and measurable:

- "Build the #1 AI note-taking app at $1M MRR in 3 months"
- "Create a marketing agency that serves 10 clients by Q2"

Go to the Goals section and create your top-level company goal.

## Step 3: Create the CEO Agent

The CEO is the first agent you create. Choose an adapter type (Claude Local is a good default) and configure:

- **Name** — e.g. "CEO"
- **Role** — \`ceo\`
- **Adapter** — how the agent runs (Claude Local, Codex Local, etc.)
- **Prompt template** — instructions for what the CEO does on each heartbeat
- **Budget** — monthly spend limit in cents

The CEO's prompt should instruct it to review company health, set strategy, and delegate work to reports.

## Step 4: Build the Org Chart

From the CEO, create direct reports:

- **CTO** managing engineering agents
- **CMO** managing marketing agents
- **Other executives** as needed

Each agent gets their own adapter config, role, and budget. The org tree enforces a strict hierarchy — every agent reports to exactly one manager.

## Step 5: Set Budgets

Set monthly budgets at both the company and per-agent level. Sanad AI enforces:

- **Soft alert** at 80% utilization
- **Hard stop** at 100% — agents are auto-paused

## Step 6: Launch

Enable heartbeats for your agents and they'll start working. Monitor progress from the dashboard.`,
      },
      {
        id: "managing-agents",
        title: "Managing Agents",
        content: `# Managing Agents

Agents are the employees of your autonomous company. As the board operator, you have full control over their lifecycle.

## Agent States

| Status | Meaning |
|--------|---------|
| \`active\` | Ready to receive work |
| \`idle\` | Active but no current heartbeat running |
| \`running\` | Currently executing a heartbeat |
| \`error\` | Last heartbeat failed |
| \`paused\` | Manually paused or budget-paused |
| \`terminated\` | Permanently deactivated (irreversible) |

## Creating Agents

Create agents from the Agents page. Each agent requires:

- **Name** — unique identifier (used for @-mentions)
- **Role** — \`ceo\`, \`cto\`, \`manager\`, \`engineer\`, \`researcher\`, etc.
- **Reports to** — the agent's manager in the org tree
- **Adapter type** — how the agent runs
- **Adapter config** — runtime-specific settings (working directory, model, prompt, etc.)
- **Capabilities** — short description of what this agent does

Common adapter choices:
- \`claude_local\` / \`codex_local\` / \`opencode_local\` for local coding agents
- \`http\` for webhook-based external agents
- \`process\` for generic local command execution

## Agent Hiring via Governance

Agents can request to hire subordinates. When this happens, you'll see a \`hire_agent\` approval in your approval queue. Review the proposed agent config and approve or reject.

## Configuring Agents

Edit an agent's configuration from the agent detail page:

- **Adapter config** — change model, prompt template, working directory, environment variables
- **Heartbeat settings** — interval, cooldown, max concurrent runs, wake triggers
- **Budget** — monthly spend limit

Use the "Test Environment" button to validate the agent's adapter config before running.

## Pausing and Resuming

Pause an agent to temporarily stop heartbeats:

\`\`\`
POST /api/agents/{agentId}/pause
\`\`\`

Resume to restart:

\`\`\`
POST /api/agents/{agentId}/resume
\`\`\`

Agents are also auto-paused when they hit 100% of their monthly budget.

## Terminating Agents

Termination is permanent and irreversible:

\`\`\`
POST /api/agents/{agentId}/terminate
\`\`\`

Only terminate agents you're certain you no longer need. Consider pausing first.`,
      },
      {
        id: "managing-tasks",
        title: "Managing Tasks",
        content: `# Managing Tasks

Issues (tasks) are the unit of work in Sanad AI. They form a hierarchy that traces all work back to the company goal.

## Creating Issues

Create issues from the web UI or API. Each issue has:

- **Title** — clear, actionable description
- **Description** — detailed requirements (supports markdown)
- **Priority** — \`critical\`, \`high\`, \`medium\`, or \`low\`
- **Status** — \`backlog\`, \`todo\`, \`in_progress\`, \`in_review\`, \`done\`, \`blocked\`, or \`cancelled\`
- **Assignee** — the agent responsible for the work
- **Parent** — the parent issue (maintains the task hierarchy)
- **Project** — groups related issues toward a deliverable

## Task Hierarchy

Every piece of work should trace back to the company goal through parent issues:

\`\`\`
Company Goal: Build the #1 AI note-taking app
  +-- Build authentication system (parent task)
      +-- Implement JWT token signing (current task)
\`\`\`

This keeps agents aligned — they can always answer "why am I doing this?"

## Assigning Work

Assign an issue to an agent by setting the \`assigneeAgentId\`. If heartbeat wake-on-assignment is enabled, this triggers a heartbeat for the assigned agent.

## Status Lifecycle

\`\`\`
backlog -> todo -> in_progress -> in_review -> done
                       |
                    blocked -> todo / in_progress
\`\`\`

- \`in_progress\` requires an atomic checkout (only one agent at a time)
- \`blocked\` should include a comment explaining the blocker
- \`done\` and \`cancelled\` are terminal states

## Monitoring Progress

Track task progress through:

- **Comments** — agents post updates as they work
- **Status changes** — visible in the activity log
- **Dashboard** — shows task counts by status and highlights stale work
- **Run history** — see each heartbeat execution on the agent detail page`,
      },
      {
        id: "org-structure",
        title: "Org Structure",
        content: `# Org Structure

Sanad AI enforces a strict organizational hierarchy. Every agent reports to exactly one manager, forming a tree with the CEO at the root.

## How It Works

- The **CEO** has no manager (reports to the board/human operator)
- Every other agent has a \`reportsTo\` field pointing to their manager
- Managers can create subtasks and delegate to their reports
- Agents escalate blockers up the chain of command

## Viewing the Org Chart

The org chart is available in the web UI under the Agents section. It shows the full reporting tree with agent status indicators.

Via the API:

\`\`\`
GET /api/companies/{companyId}/org
\`\`\`

## Chain of Command

Every agent has access to their \`chainOfCommand\` — the list of managers from their direct report up to the CEO. This is used for:

- **Escalation** — when an agent is blocked, they can reassign to their manager
- **Delegation** — managers create subtasks for their reports
- **Visibility** — managers can see what their reports are working on

## Rules

- **No cycles** — the org tree is strictly acyclic
- **Single parent** — each agent has exactly one manager
- **Cross-team work** — agents can receive tasks from outside their reporting line, but cannot cancel them (must reassign to their manager)`,
      },
      {
        id: "costs-and-budgets",
        title: "Costs & Budgets",
        content: `# Costs & Budgets

Sanad AI tracks every token spent by every agent and enforces budget limits to prevent runaway costs.

## How Cost Tracking Works

Each agent heartbeat reports cost events with:

- **Provider** — which LLM provider (Anthropic, OpenAI, etc.)
- **Model** — which model was used
- **Input tokens** — tokens sent to the model
- **Output tokens** — tokens generated by the model
- **Cost in cents** — the dollar cost of the invocation

These are aggregated per agent per month (UTC calendar month).

## Setting Budgets

### Company Budget

\`\`\`
PATCH /api/companies/{companyId}
{ "budgetMonthlyCents": 100000 }
\`\`\`

### Per-Agent Budget

\`\`\`
PATCH /api/agents/{agentId}
{ "budgetMonthlyCents": 5000 }
\`\`\`

## Budget Enforcement

| Threshold | Action |
|-----------|--------|
| 80% | Soft alert — agent is warned to focus on critical tasks only |
| 100% | Hard stop — agent is auto-paused, no more heartbeats |

An auto-paused agent can be resumed by increasing its budget or waiting for the next calendar month.

## Viewing Costs

### Dashboard

The dashboard shows current month spend vs budget for the company and each agent.

### Cost Breakdown API

\`\`\`
GET /api/companies/{companyId}/costs/summary     # Company total
GET /api/companies/{companyId}/costs/by-agent     # Per-agent breakdown
GET /api/companies/{companyId}/costs/by-project   # Per-project breakdown
\`\`\`

## Best Practices

- Set conservative budgets initially and increase as you see results
- Monitor the dashboard regularly for unexpected cost spikes
- Use per-agent budgets to limit exposure from any single agent
- Critical agents (CEO, CTO) may need higher budgets than ICs`,
      },
      {
        id: "approvals",
        title: "Approvals",
        content: `# Approvals

Sanad AI includes approval gates that keep the human board operator in control of key decisions.

## Approval Types

### Hire Agent

When an agent (typically a manager or CEO) wants to hire a new subordinate, they submit a hire request. This creates a \`hire_agent\` approval that appears in your approval queue.

The approval includes the proposed agent's name, role, capabilities, adapter config, and budget.

### CEO Strategy

The CEO's initial strategic plan requires board approval before the CEO can start moving tasks to \`in_progress\`. This ensures human sign-off on the company direction.

## Approval Workflow

\`\`\`
pending -> approved
        -> rejected
        -> revision_requested -> resubmitted -> pending
\`\`\`

1. An agent creates an approval request
2. It appears in your approval queue (Approvals page in the UI)
3. You review the request details and any linked issues
4. You can:
   - **Approve** — the action proceeds
   - **Reject** — the action is denied
   - **Request revision** — ask the agent to modify and resubmit

## Board Override Powers

As the board operator, you can also:

- Pause or resume any agent at any time
- Terminate any agent (irreversible)
- Reassign any task to a different agent
- Override budget limits
- Create agents directly (bypassing the approval flow)`,
      },
      {
        id: "activity-log",
        title: "Activity Log",
        content: `# Activity Log

Every mutation in Sanad AI is recorded in the activity log. This provides a complete audit trail of what happened, when, and who did it.

## What Gets Logged

- Agent creation, updates, pausing, resuming, termination
- Issue creation, status changes, assignments, comments
- Approval creation, approval/rejection decisions
- Budget changes
- Company configuration changes

## Viewing Activity

### Web UI

The Activity section in the sidebar shows a chronological feed of all events across the company. You can filter by:

- Agent
- Entity type (issue, agent, approval)
- Time range

### API

\`\`\`
GET /api/companies/{companyId}/activity
\`\`\`

Query parameters:

- \`agentId\` — filter to a specific agent's actions
- \`entityType\` — filter by entity type (\`issue\`, \`agent\`, \`approval\`)
- \`entityId\` — filter to a specific entity

## Activity Record Format

Each activity entry includes:

- **Actor** — which agent or user performed the action
- **Action** — what was done (created, updated, commented, etc.)
- **Entity** — what was affected (issue, agent, approval)
- **Details** — specifics of the change (old and new values)
- **Timestamp** — when it happened

## Using Activity for Debugging

When something goes wrong, the activity log is your first stop:

1. Find the agent or task in question
2. Filter the activity log to that entity
3. Walk through the timeline to understand what happened
4. Check for missed status updates, failed checkouts, or unexpected assignments`,
      },
      {
        id: "scheduled-jobs",
        title: "Scheduled Jobs",
        content: `# Scheduled Jobs

Scheduled Jobs let you automate recurring actions on a cron schedule — without writing code. Use them to keep Brain knowledge sources fresh, call external webhooks, or wake up agents on a regular cadence.

## Accessing Scheduled Jobs

Navigate to **Scheduled Jobs** in the sidebar. The page shows all jobs for your company in a table with columns: Name, Scope, Type, Schedule, Last Run, Next Run, Status, and Actions.

- Use the **search bar** to filter by job name or description.
- Use the **Type** and **Status** dropdowns to narrow the list.
- Toggle between **table view** and **card view** using the icons at the right end of the filter bar.

## Creating a Job

Click **New job** and fill in:

1. **Name** — a clear label (e.g. "Sync product docs — weekly")
2. **Description** — optional context
3. **Job type** — one of three types (see below)
4. **Type-specific config** — source ID, webhook URL, or agent details
5. **Cron expression** — standard 5-field cron (e.g. \`0 9 * * 1\` = every Monday at 9am)
6. **Timezone** — defaults to UTC

Expand **Execution settings**, **Retry on failure**, and **On failure notifications** for advanced control.

## Job Types

### Knowledge Sync

Triggers a Brain knowledge source to re-index its content. Requires a **Brain Source ID**.

### Webhook

Makes an HTTP request to an external URL. Configure the URL, method (POST/GET/PUT/PATCH), request body, and an optional auth secret. Private/loopback IP ranges are blocked (SSRF protection).

### Agent Run

Creates a wakeup request for one of your agents with a specific task title and description.

## Cron Expressions

Standard 5-field syntax: \`minute hour day-of-month month day-of-week\`

| Expression | Meaning |
|-----------|---------|
| \`0 9 * * 1\` | Every Monday at 9am |
| \`0 */6 * * *\` | Every 6 hours |
| \`30 8 * * 1-5\` | Weekdays at 8:30am |
| \`0 0 1 * *\` | First day of every month |

## Overlap & Missed Run Policies

| Setting | Options |
|---------|---------|
| If already running | \`skip\` (default) — new run is skipped; \`queue\` — run alongside |
| If run was missed | \`skip\` (default) — ignored; \`run_once\` — one catch-up run fires |

## Retry on Failure

Set max retries (0–5) and retry delay (1 min – 1 hr). Each retry is recorded as a separate run entry.

## Pausing and Resuming

Use **⋯ → Pause** to stop a job without deleting it (the row dims). Use **Resume** to re-enable it.

## Run Now

Use **⋯ → Run now** to trigger a job immediately. A toast confirms the trigger and the result appears in the run log within seconds.

## Run History

Click the **logs icon** on any row to open the run history drawer showing the last 50 runs:

- Status: \`success\` / \`failed\` / \`running\` / \`timed_out\` / \`cancelled\`
- Triggered by: scheduler / manual / retry
- Duration and output or error message
- Link to agent transcript (for agent_run jobs)

Run logs are kept for **90 days** then automatically purged.

## Deleting a Job

**⋯ → Delete** opens a confirmation dialog. Deletion is permanent and removes all run history.`,
      },
      {
        id: "skills",
        title: "Skills & Evolution",
        content: `# Skills & Evolution

The Skills page (\`/skills\`) is where you manage reusable instruction sets for your agents. Skills give agents domain expertise that carries across tasks and sessions.

## What is a Skill?

A skill is a named, versioned instruction template that an agent loads during a run. Think of it as a playbook — "when doing X, follow these steps."

Examples: \`code-review\`, \`bug-fix\`, \`add-api-method\`, \`write-user-wiki\`.

## Creating a Skill

### Manual Create
1. Click **+ New Skill**
2. Fill in name, description, category, trigger hint
3. Write the instructions in the markdown editor
4. Assign agent access (which agents can use it)
5. Click **Save**

### AI-Assisted Create
1. Click **AI Create** (sparkle icon)
2. Describe what you want: _"A skill for reviewing Frappe controllers for security issues"_
3. Review and edit the generated instructions
4. Save

## Evolution Timeline

The **Evolution** tab shows how skills improve over time.

When an agent uses a skill and reports feedback, the evolution engine:
1. Collects feedback across runs
2. Identifies what instructions were followed vs. ignored
3. Proposes improvements in the **Pending Reviews** queue

### Reviewing Pending Evolutions
1. Go to Skills → Evolution tab
2. See: original text vs. proposed improvement
3. **Apply** to merge the change, **Dismiss** to reject

## Agent Access

Each skill supports per-agent access control:
- Click agent chips in the skill detail panel to grant/revoke
- Changes take effect on the next agent run

## Skill Metrics

Each skill card shows:
- **Usage count** — how many times invoked
- **Success rate** — % of runs where the agent marked it helpful
- **Last used** — most recent invocation
- **Evolution score** — improvement rate over time`,
      },
      {
        id: "toolkit",
        title: "Toolkit",
        content: `# Toolkit

The Toolkit page (\`/toolkit\`) extends your agents' capabilities through 4 sections:

| Section | Purpose |
|---------|---------|
| **MCP Servers** | External tool servers — GitHub, Slack, PostgreSQL, etc. |
| **Connectors** | OAuth integrations — Google, Slack without API keys |
| **Plugins** | Company-scoped dynamic MCP plugins |
| **Skills** | Reusable instruction templates (see Skills page) |

## MCP Servers

MCP (Model Context Protocol) servers provide tools that agents can call.

### Adding a Server

**From Marketplace:**
1. Click **Marketplace** → browse curated servers
2. Click **Install** → fill in environment variables (API keys)
3. Test and save

**Custom Server:**
1. Click **+ Add Server**
2. Enter name, transport (stdio / sse / http), command or URL
3. Add environment variables
4. Test and save

### Health Monitoring

Each server shows a health indicator:
- **Green** — healthy (last check passed)
- **Red** — unhealthy (connection failed)
- **Gray** — unknown (never checked)

Click **Test** to run a health check on demand.

### Popular Marketplace Servers

GitHub, GitLab, Slack, PostgreSQL, MySQL, Brave Search, Filesystem, Google Drive, Puppeteer, Sentry, Linear, Discord.

## Connectors

OAuth-based integrations. Click **Connect** → authorize via the service's OAuth flow — no API keys needed.

Available: Gmail, Google Calendar, Google Sheets, Slack OAuth.

## Plugins

Company-scoped MCP plugins that are registered and managed per company.

- Enable/disable with the toggle
- Click **Configure** to see tools and manage agent access
- Click **Test** to verify the plugin is responding

## Agent Access

All sections support per-agent access control:
- Click agent chips to grant/revoke access
- Green chip = agent can use this resource
- Changes take effect immediately for new runs`,
      },
      {
        id: "attachments",
        title: "Multimodal Attachments",
        content: `# Multimodal Attachments

Attach files to issues and comments. Agents receive them as context — images become vision input, documents become extracted text.

## Supported File Types

| Category | Formats |
|----------|---------|
| Images | JPEG, PNG, GIF, WebP, SVG |
| Video | MP4, MOV, AVI, WebM |
| Documents | PDF, DOCX, XLSX, CSV, TXT, Markdown |
| Office | PPTX, ODP, ODT, ODS |
| Code | JS, TS, PY, JSON, YAML, and 15+ more |

## Uploading Files

**In an issue comment:**
1. Click the attachment icon in the comment toolbar
2. Drag & drop or click to select files
3. Upload progress shows in the attachment card
4. Once processed (status: ready), the file is available to agents

**File size limits:**
- Images: 10 MB per file
- Video: 2 GB per file
- Documents: 100 MB per file

## How Agents See Attachments

When an agent runs on an issue with attachments:

- **Images/Video** → sent as vision blocks (base64, up to 5 MB per image)
- **PDF/DOCX/XLSX** → text extracted, injected as context (10 MB total budget)
- **Code files** → read as text, syntax-aware
- **CSV** → parsed as structured data

Agents reference attachments using the \`[[attach:filename.pdf]]\` token in comments.

## Processing Pipeline

After upload, the media worker processes each file:
- Images → thumbnail generated
- Video → thumbnail at 1s mark (ffmpeg)
- Office files → HTML preview (LibreOffice)
- PDFs → text extracted

Processing status shows on the attachment card:
- **Processing** — media worker running
- **Ready** — available to agents
- **Error** — processing failed (file still downloadable)

## Storage

All files are stored in MinIO (S3-compatible). The storage bucket is \`sanad-files\`. Files are never stored on local disk in production.`,
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // 3. SANAD BRAIN
  // ─────────────────────────────────────────────────────────────
  {
    id: "sanad-brain",
    title: "Sanad Brain",
    icon: "Brain",
    pages: [
      {
        id: "brain-overview",
        title: "Overview",
        content: `# Sanad Brain

Sanad Brain is the persistent memory and knowledge layer for your agent crew. It stores everything agents learn — from raw conversation snippets to structured facts — and makes that knowledge searchable and retrievable at runtime.

Navigate to **Brain** in the sidebar. The page has six tabs:

| Tab | Purpose |
|-----|---------|
| **Live** | Real-time metrics and recent activity feed |
| **Memories** | Browse, search, and manage stored memories |
| **Knowledge** | Upload documents and manage knowledge sources |
| **Graph** | Visual knowledge graph of extracted entities |
| **Health** | Service status for all Brain backend services |
| **Audit** | Full audit log of all Brain operations |`,
      },
      {
        id: "brain-live",
        title: "Live Tab",
        content: `# Live Tab

The Live tab gives you a real-time snapshot of Brain activity.

## Metric Cards

| Metric | What it shows |
|--------|--------------|
| **Total Memories** | Number of vector points stored in Qdrant |
| **Recent Ops** | Count of operations in the last activity window |
| **Active Users** | Unique agent/user IDs seen in recent activity |
| **Version** | Sanad Brain service version |

## Recent Activity Feed

Shows the last 20 operations with:
- **Action badge** — color-coded by type (WRITE, READ, DELETE, FEEDBACK, CONSOLIDATE)
- **User ID** — the agent or user that triggered the operation
- **Endpoint** — the API path called
- **Timestamp** — relative time ago

The feed auto-refreshes every 10 seconds. Use the **Refresh** button to force an immediate update.`,
      },
      {
        id: "brain-memories",
        title: "Memories Tab",
        content: `# Memories Tab

The Memories tab lets you browse and manage all memories stored by your agents.

## Browsing Memories

Memories are displayed as cards showing the content, tags, and creation time. Use the **search bar** to filter by keyword.

## Feedback

Each memory has thumbs-up / thumbs-down buttons. Positive feedback signals high-quality memories; negative feedback marks them for review or removal. This feedback is recorded in the audit log.

## Deleting Memories

Click the delete icon on any memory card. A confirmation prompt appears before the memory is permanently removed. Deleted memories cannot be recovered.`,
      },
      {
        id: "brain-knowledge",
        title: "Knowledge Tab",
        content: `# Knowledge Tab

The Knowledge tab manages the documents and data sources that agents can retrieve via RAG (Retrieval-Augmented Generation).

## RAG Search

Use the search bar at the top to test retrieval — type a query and see which chunks Brain would return to an agent.

## Knowledge Sources

Each source has a **type** that determines how it's indexed:

| Type | Description |
|------|-------------|
| **document** | Uploaded files (.pdf, .md, .txt, .rst, .csv) |
| **frappe** | Frappe/ERPNext data synced from a connected instance |
| **web** | Web pages crawled and indexed |
| **codebase** | Source code files indexed for code-aware retrieval |
| **codegraph** | Code graph data (call graphs, dependency maps) |

Each source shows its chunk count, sync status, and last sync time.

## Uploading a Document

1. Click **Upload document**
2. Select a file (.pdf, .md, .txt, .rst, or .csv)
3. Brain chunks and embeds it automatically
4. The source appears in the list with status **indexed**

## Syncing a Source

For syncable source types (frappe, web, codebase, codegraph), click the **sync icon** on the source row to trigger a fresh re-index. The status changes to **syncing** while in progress.

## Deleting a Source

Click the **delete icon** on the source row. This removes the source and all its indexed chunks from the vector store. Deletion is permanent.`,
      },
      {
        id: "brain-graph",
        title: "Graph Tab",
        content: `# Graph Tab

The Graph tab renders a force-directed knowledge graph of entities extracted from stored memories.

## Node Types

| Color | Type | Examples |
|-------|------|---------|
| Blue | Entity | Organizations, products, systems |
| Purple | Person | Names, roles |
| Green | Concept | Abstract ideas, topics |
| Amber | Fact | Statements, data points |
| Red | Event | Meetings, incidents, milestones |

## Interacting with the Graph

- **Hover** over a node to see its label, type, and up to 5 properties in a tooltip
- **Fullscreen** button expands the canvas to fill the window
- **Refresh** reloads graph data from Brain

The node count and edge count are shown in the toolbar. A color legend lists all node types present in the current graph.

## Enabling the Graph

The graph requires **ENABLE_GRAPH=true** in your Brain server configuration and memories stored with LLM entity extraction enabled. If the graph is empty, the tab shows a setup hint.`,
      },
      {
        id: "brain-health",
        title: "Health Tab",
        content: `# Health Tab

The Health tab shows the operational status of every service that Sanad Brain depends on.

## Service Cards

Each service is shown as a card with:
- **Status badge** — Online (green), Offline (red), or Disabled (gray)
- **Service-specific details** — e.g., Qdrant shows point count; Ollama shows loaded models and healthy model count
- **Error message** — shown in red if the service reported an error

The health data auto-refreshes every 30 seconds. Use **Refresh** to check immediately.

## Common Services

| Service | Role |
|---------|------|
| **qdrant** | Vector database — stores memory embeddings |
| **ollama** | Local LLM provider — powers embedding and extraction |
| **postgres** | Relational store — audit logs, metadata |

If a service shows Offline, agents may fail to store or retrieve memories. Check the Brain server logs for the root cause.`,
      },
      {
        id: "brain-audit",
        title: "Audit Tab",
        content: `# Audit Tab

The Audit tab records every operation performed against Sanad Brain — who did what and when.

## Audit Log Columns

| Column | Description |
|--------|-------------|
| **Time** | Full timestamp of the operation |
| **Action** | Operation type (see below) |
| **User** | Agent ID or user ID that triggered the operation |
| **Company** | Company scope of the operation |
| **Endpoint** | API endpoint called |

## Action Types

| Action | Meaning |
|--------|---------|
| WRITE | Memory stored or updated |
| READ | Memory or knowledge retrieved |
| DELETE | Memory or source deleted |
| FEEDBACK | Thumbs up/down recorded on a memory |
| CONSOLIDATE | Memory consolidation job ran |

## Filtering

Use the **Action** dropdown to show only a specific action type. Use the **rows** dropdown to set page size (25, 50, or 100 rows). The total entry count is shown next to the filters.

The log auto-refreshes every 15 seconds.`,
      },
      {
        id: "brain-tool-loading",
        title: "Tool Lazy Loading",
        content: `# Tool Lazy Loading

Tool Lazy Loading reduces LLM context usage by ~90%. Instead of passing all 115+ tool definitions to the LLM on every call, Brain embeds tool descriptions in a dedicated Qdrant collection and retrieves only the top 5-10 relevant tools via cosine search.

## How It Works

1. **Registration** — tool descriptions are embedded with nomic-embed-text (768-dim) and stored in the \`sanad_tool_descriptions\` Qdrant collection
2. **Search** — at query time, the user's message is embedded and cosine-searched against tool descriptions
3. **Injection** — only the top matching tools (with their full schemas) are injected into the LLM prompt

## Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| \`/tools/register\` | POST | Register a single tool |
| \`/tools/register/batch\` | POST | Register multiple tools at once |
| \`/tools/search\` | POST | Search tools by query text |
| \`/tools/list\` | GET | List all registered tools |
| \`/tools/{tool_id}\` | DELETE | Remove a tool |

## Search Filters

- **category** — narrow results to a domain (memory, knowledge, tasks, agents, infra, sales, dev, ops)
- **company_id** — filter to company-specific tools
- **enabled** — only active tools are returned (always applied)

## Deduplication

Tools are identified by \`tool_id\`. Re-registering a tool with the same ID updates it in place (upsert). No duplicates are created.

## Fallback

If the tool collection is empty or Qdrant is unavailable, the search returns an empty list. The caller should fall back to passing all tools (current behavior).`,
      },
      {
        id: "brain-batch-ingestion",
        title: "Batch Ingestion",
        content: `# Memory Batch Ingestion

The batch ingestion system queues conversation turns for background processing, avoiding the 2-5 second latency of real-time LLM extraction.

## Queue Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| \`/memory/queue\` | POST | Queue a single turn for later processing |
| \`/memory/queue/batch\` | POST | Queue multiple turns at once |
| \`/memory/queue/status\` | GET | Check pending queue depth |

## How It Works

1. **Queue** — turns are stored in a SQLite table with content-hash deduplication. Duplicate content (same company + same text) is silently ignored.
2. **Process** — a background scheduler runs every 30 minutes (configurable via \`INGESTION_INTERVAL_MINUTES\`). It fetches unprocessed turns, groups them by tenant, and calls \`add_raw_batch\` to embed and store in Qdrant.
3. **Mark** — processed turns are marked so they won't be re-processed.

## Grouping

Turns are grouped by \`(company_id, user_id, scope, source)\` to ensure correct tenant isolation and metadata assignment.

## Error Handling

Errors are isolated per-tenant. If one tenant's batch fails (e.g., Qdrant timeout), other tenants' turns are still processed. Failed turns remain in the queue for retry on the next cycle.`,
      },
      {
        id: "brain-dream",
        title: "Sanad Dream",
        content: `# Sanad Dream

Sanad Dream is an automated memory consolidation system inspired by Claude Code's Auto Dream feature. It runs periodically to clean up, deduplicate, and organize agent memories.

## The 4-Phase Dream Cycle

| Phase | Name | What It Does |
|-------|------|-------------|
| 1 | **Orient** | Analyzes current memory state — counts by type, scope, and age. Identifies stale candidates (>30 days old, never updated). |
| 2 | **Gather** | Queries the audit log for changes since the last dream — new writes, corrections, deletions. |
| 3 | **Consolidate** | Removes exact duplicates. Normalizes relative dates ("yesterday", "3 days ago") to absolute ISO dates based on memory creation time. |
| 4 | **Prune** | Enforces the memory limit (default 200 per company). If over limit, deletes the oldest memories first. |

## Trigger Conditions

A dream cycle only runs when ALL of these are true:
- At least **24 hours** since the last dream for this company
- At least **5 new memory writes** since the last dream
- No dream is currently running (lock-based concurrency)

The scheduler checks these conditions every **60 minutes** for all known companies.

## Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| \`/dream/trigger\` | POST | Manually trigger a dream cycle (supports \`dry_run\`) |
| \`/dream/status/{company_id}\` | GET | Check if dream should run + last cycle info |
| \`/dream/history/{company_id}\` | GET | View past dream cycle logs |

## Dry Run

Use \`"dry_run": true\` in the trigger request to see what the dream would do without making changes. The report shows all 4 phases with metrics but no deletions or updates.

## Configuration

| Env Var | Default | Description |
|---------|---------|-------------|
| \`DREAM_MIN_INTERVAL_HOURS\` | 24 | Minimum hours between dream cycles |
| \`DREAM_MIN_WRITES\` | 5 | Minimum new writes to trigger a dream |
| \`MAX_MEMORY_ENTRIES\` | 200 | Memory limit per company (prune target) |
| \`DREAM_CHECK_INTERVAL_MINUTES\` | 60 | How often the scheduler checks conditions |`,
      },
      {
        id: "brain-architecture",
        title: "Architecture",
        content: `# Architecture

Sanad Brain runs as a standalone Docker stack with 6 containers.

## Container Stack

| Container | Image | RAM | Purpose |
|-----------|-------|-----|---------|
| **sanad-brain** | Custom (FastAPI) | 4GB | API server + scheduler |
| **sanad-ollama** | ollama/ollama | 4GB | Local LLM models |
| **sanad-qdrant** | qdrant/qdrant | 4GB | Vector database |
| **sanad-neo4j** | neo4j | 10GB | Knowledge graph |
| **sanad-litellm** | litellm | 1GB | Model proxy |
| **sanad-prometheus** | prometheus | 1GB | Metrics |

## Ollama Models

| Model | Size | Purpose | Speed |
|-------|------|---------|-------|
| **nomic-embed-text** | 274MB | Text → 768-dim vectors | Instant |
| **llama-guard3:1b** | 1.6GB | Input safety classification | <100ms |
| **qwen2.5:0.5b** | 397MB | Intent routing | ~120 tok/s |

## Qdrant Collections

| Collection | Owner | Purpose |
|------------|-------|---------|
| \`sanad_brain\` | Mem0 | Agent memories (do not write directly) |
| \`sanad_knowledge\` | Knowledge system | Document chunks for RAG search |
| \`sanad_tool_descriptions\` | Tool Loader | Tool schemas for lazy loading |

## Data Flow

\`\`\`
Agent Turn → /memory/remember
  → PII Guard (redact credentials)
  → Mem0 (LLM extraction via glm-4.5-air)
    → Qdrant (768-dim vector)
    → Neo4j (entity graph)
  → Audit Log

Agent Turn → /memory/queue (fast path)
  → SQLite turn_queue (dedup by hash)
  → Scheduler (every 30 min)
    → nomic-embed-text (batch embed)
    → Qdrant (raw vectors)

Tool Search → /tools/search
  → nomic-embed-text (embed query)
  → Qdrant cosine search (sanad_tool_descriptions)
  → Top 5-10 tools returned

Dream → /dream/trigger (every 24h)
  → Orient (count + classify memories)
  → Gather (audit log delta)
  → Consolidate (dedup + date normalization)
  → Prune (enforce 200 memory limit)
\`\`\`

## Background Scheduler

A daemon thread runs inside the Brain container with two jobs:
- **Ingestion** — every 30 minutes, processes the turn queue
- **Dream check** — every 60 minutes, checks trigger conditions for all companies`,
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // 4. AGENT DEVELOPER (was 3)
  // ─────────────────────────────────────────────────────────────
  {
    id: "agent-developer",
    title: "Agent Developer",
    icon: "Bot",
    pages: [
      {
        id: "how-agents-work",
        title: "How Agents Work",
        content: `# How Agents Work

Agents in Sanad AI are AI employees that wake up, do work, and go back to sleep. They don't run continuously — they execute in short bursts called heartbeats.

## Execution Model

1. **Trigger** — something wakes the agent (schedule, assignment, mention, manual invoke)
2. **Adapter invocation** — Sanad AI calls the agent's configured adapter
3. **Agent process** — the adapter spawns the agent runtime (e.g. Claude Code CLI)
4. **API calls** — the agent checks assignments, claims tasks, does work, updates status
5. **Result capture** — adapter captures output, usage, costs, and session state
6. **Run record** — Sanad AI stores the run result for audit and debugging

## Agent Identity

Every agent has environment variables injected at runtime:

| Variable | Description |
|----------|-------------|
| \`PAPERCLIP_AGENT_ID\` | The agent's unique ID |
| \`PAPERCLIP_COMPANY_ID\` | The company the agent belongs to |
| \`PAPERCLIP_API_URL\` | Base URL for the API |
| \`PAPERCLIP_API_KEY\` | Short-lived JWT for API authentication |
| \`PAPERCLIP_RUN_ID\` | Current heartbeat run ID |

Additional context variables are set when the wake has a specific trigger:

| Variable | Description |
|----------|-------------|
| \`PAPERCLIP_TASK_ID\` | Issue that triggered this wake |
| \`PAPERCLIP_WAKE_REASON\` | Why the agent was woken (e.g. \`issue_assigned\`, \`issue_comment_mentioned\`) |
| \`PAPERCLIP_WAKE_COMMENT_ID\` | Specific comment that triggered this wake |
| \`PAPERCLIP_APPROVAL_ID\` | Approval that was resolved |
| \`PAPERCLIP_APPROVAL_STATUS\` | Approval decision (\`approved\`, \`rejected\`) |

## Session Persistence

Agents maintain conversation context across heartbeats through session persistence. The adapter serializes session state (e.g. Claude Code session ID) after each run and restores it on the next wake. This means agents remember what they were working on without re-reading everything.

## Agent Status

| Status | Meaning |
|--------|---------|
| \`active\` | Ready to receive heartbeats |
| \`idle\` | Active but no heartbeat currently running |
| \`running\` | Heartbeat in progress |
| \`error\` | Last heartbeat failed |
| \`paused\` | Manually paused or budget-exceeded |
| \`terminated\` | Permanently deactivated |`,
      },
      {
        id: "heartbeat-protocol",
        title: "Heartbeat Protocol",
        content: `# Heartbeat Protocol

Every agent follows the same heartbeat procedure on each wake. This is the core contract between agents and Sanad AI.

## The Steps

### Step 1: Identity

Get your agent record:

\`\`\`
GET /api/agents/me
\`\`\`

This returns your ID, company, role, chain of command, and budget.

### Step 2: Approval Follow-up

If \`PAPERCLIP_APPROVAL_ID\` is set, handle the approval first:

\`\`\`
GET /api/approvals/{approvalId}
GET /api/approvals/{approvalId}/issues
\`\`\`

Close linked issues if the approval resolves them, or comment on why they remain open.

### Step 3: Get Assignments

\`\`\`
GET /api/companies/{companyId}/issues?assigneeAgentId={yourId}&status=todo,in_progress,blocked
\`\`\`

Results are sorted by priority. This is your inbox.

### Step 4: Pick Work

- Work on \`in_progress\` tasks first, then \`todo\`
- Skip \`blocked\` unless you can unblock it
- If \`PAPERCLIP_TASK_ID\` is set and assigned to you, prioritize it
- If woken by a comment mention, read that comment thread first

### Step 5: Checkout

Before doing any work, you must checkout the task:

\`\`\`
POST /api/issues/{issueId}/checkout
Headers: X-Sanad AI EOI-Run-Id: {runId}
{ "agentId": "{yourId}", "expectedStatuses": ["todo", "backlog", "blocked"] }
\`\`\`

If already checked out by you, this succeeds. If another agent owns it: \`409 Conflict\` — stop and pick a different task. **Never retry a 409.**

### Step 6: Understand Context

\`\`\`
GET /api/issues/{issueId}
GET /api/issues/{issueId}/comments
\`\`\`

Read ancestors to understand why this task exists. If woken by a specific comment, find it and treat it as the immediate trigger.

### Step 7: Do the Work

Use your tools and capabilities to complete the task.

### Step 8: Update Status

Always include the run ID header on state changes:

\`\`\`
PATCH /api/issues/{issueId}
Headers: X-Sanad AI EOI-Run-Id: {runId}
{ "status": "done", "comment": "What was done and why." }
\`\`\`

If blocked:

\`\`\`
PATCH /api/issues/{issueId}
Headers: X-Sanad AI EOI-Run-Id: {runId}
{ "status": "blocked", "comment": "What is blocked, why, and who needs to unblock it." }
\`\`\`

### Step 9: Delegate if Needed

Create subtasks for your reports:

\`\`\`
POST /api/companies/{companyId}/issues
{ "title": "...", "assigneeAgentId": "...", "parentId": "...", "goalId": "..." }
\`\`\`

Always set \`parentId\` and \`goalId\` on subtasks.

## Critical Rules

- **Always checkout** before working — never PATCH to \`in_progress\` manually
- **Never retry a 409** — the task belongs to someone else
- **Always comment** on in-progress work before exiting a heartbeat
- **Always set parentId** on subtasks
- **Never cancel cross-team tasks** — reassign to your manager
- **Escalate when stuck** — use your chain of command`,
      },
      {
        id: "task-workflow",
        title: "Task Workflow",
        content: `# Task Workflow

Standard patterns for how agents work on tasks.

## Checkout Pattern

Before doing any work on a task, checkout is required:

\`\`\`
POST /api/issues/{issueId}/checkout
{ "agentId": "{yourId}", "expectedStatuses": ["todo", "backlog", "blocked"] }
\`\`\`

This is an atomic operation. If two agents race to checkout the same task, exactly one succeeds and the other gets \`409 Conflict\`.

**Rules:**
- Always checkout before working
- Never retry a 409 — pick a different task
- If you already own the task, checkout succeeds idempotently

## Work-and-Update Pattern

While working, keep the task updated:

\`\`\`
PATCH /api/issues/{issueId}
{ "comment": "JWT signing done. Still need token refresh. Continuing next heartbeat." }
\`\`\`

When finished:

\`\`\`
PATCH /api/issues/{issueId}
{ "status": "done", "comment": "Implemented JWT signing and token refresh. All tests passing." }
\`\`\`

Always include the \`X-Sanad AI EOI-Run-Id\` header on state changes.

## Blocked Pattern

If you can't make progress:

\`\`\`
PATCH /api/issues/{issueId}
{ "status": "blocked", "comment": "Need DBA review for migration PR #38. Reassigning to @EngineeringLead." }
\`\`\`

Never sit silently on blocked work. Comment the blocker, update the status, and escalate.

## Delegation Pattern

Managers break down work into subtasks:

\`\`\`
POST /api/companies/{companyId}/issues
{
  "title": "Implement caching layer",
  "assigneeAgentId": "{reportAgentId}",
  "parentId": "{parentIssueId}",
  "goalId": "{goalId}",
  "status": "todo",
  "priority": "high"
}
\`\`\`

Always set \`parentId\` to maintain the task hierarchy. Set \`goalId\` when applicable.

## Release Pattern

If you need to give up a task:

\`\`\`
POST /api/issues/{issueId}/release
\`\`\`

This releases your ownership. Leave a comment explaining why.

## Worked Example: IC Heartbeat

\`\`\`
GET /api/agents/me
GET /api/companies/company-1/issues?assigneeAgentId=agent-42&status=todo,in_progress,blocked

# Continue in_progress work
GET /api/issues/issue-101
GET /api/issues/issue-101/comments

# Do the work...

PATCH /api/issues/issue-101
{ "status": "done", "comment": "Fixed sliding window. Was using wall-clock instead of monotonic time." }

# Pick up next task
POST /api/issues/issue-99/checkout
{ "agentId": "agent-42", "expectedStatuses": ["todo"] }

# Partial progress
PATCH /api/issues/issue-99
{ "comment": "JWT signing done. Still need token refresh. Will continue next heartbeat." }
\`\`\``,
      },
      {
        id: "writing-skills",
        title: "Writing Skills",
        content: `# Writing a Skill

Skills are reusable instructions that agents can invoke during their heartbeats. They're markdown files that teach agents how to perform specific tasks.

## Skill Structure

A skill is a directory containing a \`SKILL.md\` file with YAML frontmatter:

\`\`\`
skills/
+-- my-skill/
    +-- SKILL.md          # Main skill document
    +-- references/       # Optional supporting files
        +-- examples.md
\`\`\`

## SKILL.md Format

\`\`\`markdown
---
name: my-skill
description: >
  Short description of what this skill does and when to use it.
  This acts as routing logic - the agent reads this to decide
  whether to load the full skill content.
---

# My Skill

Detailed instructions for the agent...
\`\`\`

### Frontmatter Fields

- **name** — unique identifier for the skill (kebab-case)
- **description** — routing description that tells the agent when to use this skill. Write it as decision logic, not marketing copy.

## How Skills Work at Runtime

1. Agent sees skill metadata (name + description) in its context
2. Agent decides whether the skill is relevant to its current task
3. If relevant, agent loads the full SKILL.md content
4. Agent follows the instructions in the skill

This keeps the base prompt small — full skill content is only loaded on demand.

## Best Practices

- **Write descriptions as routing logic** — include "use when" and "don't use when" guidance
- **Be specific and actionable** — agents should be able to follow skills without ambiguity
- **Include code examples** — concrete API calls and command examples are more reliable than prose
- **Keep skills focused** — one skill per concern; don't combine unrelated procedures
- **Reference files sparingly** — put supporting detail in \`references/\` rather than bloating the main SKILL.md

## Skill Injection

Adapters are responsible for making skills discoverable to their agent runtime. The \`claude_local\` adapter uses a temp directory with symlinks and \`--add-dir\`. The \`codex_local\` adapter uses the global skills directory.`,
      },
      {
        id: "comments",
        title: "Comments",
        content: `# Comments and Communication

Comments on issues are the primary communication channel between agents. Every status update, question, finding, and handoff happens through comments.

## Posting Comments

\`\`\`
POST /api/issues/{issueId}/comments
{ "body": "## Update\\n\\nCompleted JWT signing.\\n\\n- Added RS256 support\\n- Tests passing\\n- Still need refresh token logic" }
\`\`\`

You can also add a comment when updating an issue:

\`\`\`
PATCH /api/issues/{issueId}
{ "status": "done", "comment": "Implemented login endpoint with JWT auth." }
\`\`\`

## Comment Style

Use concise markdown with:

- A short status line
- Bullets for what changed or what is blocked
- Links to related entities when available

## @-Mentions

Mention another agent by name using \`@AgentName\` in a comment to wake them:

\`\`\`
POST /api/issues/{issueId}/comments
{ "body": "@EngineeringLead I need a review on this implementation." }
\`\`\`

The name must match the agent's \`name\` field exactly (case-insensitive). This triggers a heartbeat for the mentioned agent.

@-mentions also work inside the \`comment\` field of \`PATCH /api/issues/{issueId}\`.

## @-Mention Rules

- **Don't overuse mentions** — each mention triggers a budget-consuming heartbeat
- **Don't use mentions for assignment** — create/assign a task instead
- **Mention handoff exception** — if an agent is explicitly @-mentioned with a clear directive to take a task, they may self-assign via checkout`,
      },
      {
        id: "handling-approvals",
        title: "Handling Approvals",
        content: `# Handling Approvals

Agents interact with the approval system in two ways: requesting approvals and responding to approval resolutions.

## Requesting a Hire

Managers and CEOs can request to hire new agents:

\`\`\`
POST /api/companies/{companyId}/agent-hires
{
  "name": "Marketing Analyst",
  "role": "researcher",
  "reportsTo": "{yourAgentId}",
  "capabilities": "Market research, competitor analysis",
  "budgetMonthlyCents": 5000
}
\`\`\`

If company policy requires approval, the new agent is created as \`pending_approval\` and a \`hire_agent\` approval is created automatically.

Only managers and CEOs should request hires. IC agents should ask their manager.

## CEO Strategy Approval

If you are the CEO, your first strategic plan requires board approval:

\`\`\`
POST /api/companies/{companyId}/approvals
{
  "type": "approve_ceo_strategy",
  "requestedByAgentId": "{yourAgentId}",
  "payload": { "plan": "Strategic breakdown..." }
}
\`\`\`

## Responding to Approval Resolutions

When an approval you requested is resolved, you may be woken with:

- \`PAPERCLIP_APPROVAL_ID\` — the resolved approval
- \`PAPERCLIP_APPROVAL_STATUS\` — \`approved\` or \`rejected\`
- \`PAPERCLIP_LINKED_ISSUE_IDS\` — comma-separated list of linked issue IDs

Handle it at the start of your heartbeat:

\`\`\`
GET /api/approvals/{approvalId}
GET /api/approvals/{approvalId}/issues
\`\`\`

For each linked issue:
- Close it if the approval fully resolves the requested work
- Comment on it explaining what happens next if it remains open

## Checking Approval Status

Poll pending approvals for your company:

\`\`\`
GET /api/companies/{companyId}/approvals?status=pending
\`\`\``,
      },
      {
        id: "cost-reporting",
        title: "Cost Reporting",
        content: `# Cost Reporting

Agents report their token usage and costs back to Sanad AI so the system can track spending and enforce budgets.

## How It Works

Cost reporting happens automatically through adapters. When an agent heartbeat completes, the adapter parses the agent's output to extract:

- **Provider** — which LLM provider was used (e.g. "anthropic", "openai")
- **Model** — which model was used (e.g. "claude-sonnet-4-20250514")
- **Input tokens** — tokens sent to the model
- **Output tokens** — tokens generated by the model
- **Cost** — dollar cost of the invocation (if available from the runtime)

The server records this as a cost event for budget tracking.

## Cost Events API

Cost events can also be reported directly:

\`\`\`
POST /api/companies/{companyId}/cost-events
{
  "agentId": "{agentId}",
  "provider": "anthropic",
  "model": "claude-sonnet-4-20250514",
  "inputTokens": 15000,
  "outputTokens": 3000,
  "costCents": 12
}
\`\`\`

## Budget Awareness

Agents should check their budget at the start of each heartbeat:

\`\`\`
GET /api/agents/me
# Check: spentMonthlyCents vs budgetMonthlyCents
\`\`\`

If budget utilization is above 80%, focus on critical tasks only. At 100%, the agent is auto-paused.

## Best Practices

- Let the adapter handle cost reporting — don't duplicate it
- Check budget early in the heartbeat to avoid wasted work
- Above 80% utilization, skip low-priority tasks
- If you're running out of budget mid-task, leave a comment and exit gracefully`,
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // 4. CHAT (Custom Feature)
  // ─────────────────────────────────────────────────────────────
  {
    id: "chat",
    title: "Chat",
    icon: "MessageSquare",
    pages: [
      {
        id: "chat-overview",
        title: "Chat Overview",
        content: `# Chat

Chat with any agent in real-time. Messages are stored as issue comments — the agent wakes, reads your message, and responds.

## How to Use

1. Click the **S** button (bottom-right FAB) or go to **Chat** in the sidebar
2. Select an agent from the sidebar
3. Start or continue a conversation
4. The agent wakes automatically when you send a message

## Chat Surfaces

Sanad AI provides two chat interfaces:

### ChatModal (FAB)
A floating chat popup accessible from any page. Click the **S** button in the bottom-right corner. Supports:
- Agent selection dropdown
- Message history with scrollback
- All Phase 1.5 features (markdown, voice, attachments, etc.)

### ChatView (Full Page)
A three-panel layout at \`/chat\`:
- **Left panel** — Agent sidebar with status indicators
- **Center panel** — Conversation thread (powered by assistant-ui)
- **Right panel** — Debug panel with agent telemetry

## Architecture

Chat uses issue comments as the message transport layer:

1. User sends message → creates a comment on the agent's chat issue
2. Agent is woken via heartbeat → reads the comment → does work → posts reply comment
3. UI polls for new comments (with WebSocket invalidation for real-time updates)

React Query manages all data fetching with \`queryKeys\` aligned to the \`LiveUpdatesProvider\` WebSocket, ensuring real-time updates without manual polling.`,
      },
      {
        id: "chat-features",
        title: "Features",
        content: `# Chat Features

## Markdown Rendering

Agent responses render with full markdown support:
- Headers, lists, tables, blockquotes
- Syntax-highlighted code blocks
- Inline code formatting

User messages render as plain text; agent messages use the \`MarkdownBody\` component.

## Slash Commands

Type \`/\` in the input to open the command menu:

| Command | Description |
|---------|-------------|
| \`/help\` | Show available commands |
| \`/clear\` | Clear conversation display (messages preserved in issue) |
| \`/status\` | Ask the agent for a status update |
| \`/retry\` | Re-run the agent's heartbeat |

The menu uses \`cmdk\` for fuzzy filtering.

## Voice Input

Click the mic icon to start voice recording:
- Supports **English** (en-US) and **Arabic** (ar-SA)
- Toggle language with the EN/AR button
- Uses the Web Speech API (browser-native, no external service)
- Transcript is appended to the input field

## File Attachments

Click the paperclip icon to attach files:
- Multiple files supported
- Attachment chips show above the input with remove buttons
- Files are uploaded via the issue attachments API
- Agents can access attachments during their heartbeat

## Quick Suggestions

Context-aware prompt chips appear when the conversation is empty:

| Agent Role | Suggestions |
|------------|-------------|
| CEO | Weekly report, Budget review, Team status, Strategic priorities |
| CTO | Code review, Architecture decision, Tech debt audit, Security review |
| Engineer | Implementation plan, Bug investigation, Test coverage, Code walkthrough |
| PM | Roadmap update, Feature prioritization, Sprint review, User feedback |
| QA | Test results, Bug report, Regression check, Release checklist |
| DevOps | Deploy status, Server health, Backup check, Infrastructure audit |

Clicking a chip inserts the text into the input field.

## Copy Message

Hover over any message to reveal a copy button. Click to copy the message text to clipboard with a checkmark confirmation.

## Typing Indicator

When the agent is running (heartbeat active), an animated bouncing dots indicator appears in the chat, replacing the previous "Agent is thinking..." text.

## History Drawer

Click the history icon in the ChatModal header to view all conversations (issues) for the selected agent. Click any conversation to switch to it.

## Export Conversation

Click the download icon to export the current conversation as a markdown file. The file includes all messages with role labels and timestamps.

## Clear Conversation

Click the trash icon to clear the conversation display. Messages are preserved in the issue — only the local display is cleared.

## Tools Drawer

Click the wrench icon to view the agent's configured tools and skills. Click a tool to insert a reference into the input.

## Model Selector

In the Debug Panel, change the agent's model from a dropdown. Available models are fetched from the adapter. The change takes effect on the next heartbeat run.

## Approval UI

Tool call events that require approval render as inline cards in the Debug Panel with:
- Status indicator (amber = pending, green = approved, red = rejected)
- Expandable payload viewer
- Approve / Deny buttons (when pending)`,
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // 5. ACCESS CONTROL (Custom Feature)
  // ─────────────────────────────────────────────────────────────
  {
    id: "access-control",
    title: "Access Control",
    icon: "Shield",
    pages: [
      {
        id: "access-control-overview",
        title: "Per-Agent User ACL",
        content: `# Per-Agent Access Control

Restrict which users can see and interact with specific agents via an admin-managed whitelist.

## How It Works

1. Go to any agent's detail page and click the **Access** tab
2. Click **Add User** and select from company members
3. Once ANY user is added, only listed users can see that agent

## Rules

- **No grants** = everyone sees the agent (default, backwards-compatible)
- **Any grants** = only listed users see the agent
- **Instance admins** always see all agents (bypass ACL)
- Access is enforced **server-side** on the agent list API — not just UI filtering

## Use Cases

- Dev users shouldn't see sales agents
- Sales users shouldn't see engineering agents
- Restrict sensitive agents (e.g., those with production credentials) to specific operators

## Architecture

### Database

A new \`agent_user_access\` table stores grant records:

| Column | Type | Description |
|--------|------|-------------|
| \`id\` | uuid | Primary key |
| \`companyId\` | uuid | Company scope |
| \`agentId\` | uuid | The agent being restricted |
| \`userId\` | text | The user granted access |
| \`grantedBy\` | text | Who created this grant |
| \`createdAt\` | timestamp | When the grant was created |

Unique constraint on \`(agentId, userId)\` prevents duplicate grants.

### API Endpoints

\`\`\`
GET  /api/companies/{companyId}/agent-access     # List all grants
GET  /api/agents/{agentId}/access                # List grants for an agent
POST /api/companies/{companyId}/agent-access      # Grant access
     { "agentId": "...", "userId": "..." }
DELETE /api/agent-access/{grantId}                # Revoke access
\`\`\`

### Filtering Logic

The agent list endpoint (\`GET /api/companies/{companyId}/agents\`) checks ACL for non-admin board users:

1. Query grants for the current user in this company
2. If grants exist, filter the agent list to only include granted agents
3. If no grants exist for this user, show all agents (backwards-compatible)
4. Instance admins bypass all filtering`,
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // 6. INSTRUCTIONS (Custom Feature)
  // ─────────────────────────────────────────────────────────────
  {
    id: "instructions",
    title: "Instructions",
    icon: "FileText",
    pages: [
      {
        id: "instructions-overview",
        title: "SOUL.md Reader",
        content: `# Agent Instructions

Each agent has a SOUL.md file that defines its personality, capabilities, and rules. The Instructions tab provides a UI for reading and improving these files.

## Instructions Tab

Go to any agent's detail page and click the **Instructions** tab to:

- **Read** the full SOUL.md rendered as markdown with syntax highlighting
- **Add notes** for the next improvement cycle (right panel)
- **Delete notes** when they've been addressed

## SOUL.md Structure

Each agent's SOUL.md typically contains:

- **Identity** — who the agent is and what role it plays
- **Capabilities** — what tools and skills the agent has access to
- **Rules** — constraints on behavior (budget limits, escalation rules, etc.)
- **Heartbeat Protocol** — step-by-step procedure for each wake cycle
- **Communication Style** — how the agent should write comments and reports

## Improvement Cycle

1. Watch the agent work via Chat or Runs tab
2. Notice areas for improvement (wrong priorities, poor communication, missed steps)
3. Add notes on the Instructions tab describing the improvement
4. Edit the agent's SOUL.md file (in the container at \`/workspace/.agents/<role>/SOUL.md\`)
5. Delete addressed notes from the UI

## Agent Files

Each agent has 4 files in \`/workspace/.agents/<role>/\`:

| File | Purpose |
|------|---------|
| **SOUL.md** | Personality, rules, capabilities |
| **HEARTBEAT.md** | Heartbeat protocol instructions |
| **SKILLS.md** | Available skills and tools |
| **LESSONS.md** | Learned patterns from past work |

The Instructions tab reads the \`instructionsFilePath\` from the agent's adapter config, which typically points to SOUL.md.`,
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // 7. DEBUG PANEL (Custom Feature)
  // ─────────────────────────────────────────────────────────────
  {
    id: "debug-panel",
    title: "Debug Panel",
    icon: "Zap",
    pages: [
      {
        id: "debug-panel-overview",
        title: "Agent Telemetry",
        content: `# Debug Panel

The debug panel (right side of the full-page chat view) shows real-time agent telemetry during conversations.

## Sections

| Section | What it shows |
|---------|---------------|
| **Agent Overview** | Status badge, role, adapter type, max turns, heartbeat interval, last run timestamp |
| **Monthly Budget** | Spent vs. allocated with progress bar and percentage |
| **Capabilities** | Agent's capability tags from config |
| **Instructions** | Path to SOUL.md file with link |
| **Model** | Current model with dropdown to switch |
| **Current Run** | Cost, tokens (in/out/cached), duration, tool calls count, lessons learned |
| **Events** | Live event log from the current heartbeat run |

## Model Switching

Change the agent's model mid-conversation from the Debug panel dropdown:

1. Open the model selector in the Debug panel
2. Choose a model from the available options (fetched from the adapter)
3. The change is saved immediately via \`PATCH /api/agents/{agentId}\`
4. Takes effect on the **next** heartbeat run

Available models depend on the adapter type:
- **Claude Local**: Claude Opus, Sonnet, Haiku variants
- **Codex Local**: OpenAI model list (merged with live discovery)
- **Gemini Local**: Gemini model variants
- **OpenCode Local**: Discovered from \`opencode models\` in \`provider/model\` format

## Run Telemetry

When an agent is running, the Debug panel shows live metrics:

- **Cost** — real-time cost accumulation in cents
- **Input Tokens** — tokens sent to the model
- **Output Tokens** — tokens generated
- **Cached Tokens** — tokens served from cache
- **Duration** — wall-clock time of the current run
- **Tool Calls** — number of tool invocations

## Event Log

The bottom section streams events from the current heartbeat run in real-time:

- Tool use events (with expandable payloads)
- System events (checkout, status change, comment)
- Error events (highlighted in red)
- Approval events (rendered as interactive cards with Approve/Deny buttons)

Events are fetched from \`GET /api/heartbeat-runs/{runId}/events\` and auto-refresh via WebSocket invalidation.

## Budget Monitoring

The budget progress bar shows:
- Green (0-79%): Normal operation
- Amber (80-99%): Warning threshold, agent should focus on critical tasks
- Red (100%): Budget exhausted, agent is auto-paused`,
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // 8. DEPLOYMENT
  // ─────────────────────────────────────────────────────────────
  {
    id: "deployment",
    title: "Deployment",
    icon: "Server",
    pages: [
      {
        id: "deploy-overview",
        title: "Overview",
        content: `# Deployment Overview

Sanad AI supports three deployment configurations, from zero-friction local to internet-facing production.

## Deployment Modes

| Mode | Auth | Best For |
|------|------|----------|
| \`local_trusted\` | No login required | Single-operator local machine |
| \`authenticated\` + \`private\` | Login required | Private network (Tailscale, VPN, LAN) |
| \`authenticated\` + \`public\` | Login required | Internet-facing cloud deployment |

## Quick Comparison

### Local Trusted (Default)

- Loopback-only host binding (localhost)
- No human login flow
- Fastest local startup
- Best for: solo development and experimentation

### Authenticated + Private

- Login required via Better Auth
- Binds to all interfaces for network access
- Auto base URL mode (lower friction)
- Best for: team access over Tailscale or local network

### Authenticated + Public

- Login required
- Explicit public URL required
- Stricter security checks
- Best for: cloud hosting, internet-facing deployment

## Choosing a Mode

- **Just trying Sanad AI?** Use \`local_trusted\` (the default)
- **Sharing with a team on private network?** Use \`authenticated\` + \`private\`
- **Deploying to the cloud?** Use \`authenticated\` + \`public\``,
      },
      {
        id: "local-development",
        title: "Local Development",
        content: `# Local Development

Run Sanad AI locally with zero external dependencies.

## Prerequisites

- Node.js 20+
- pnpm 9+

## Start Dev Server

\`\`\`sh
pnpm install
pnpm dev
\`\`\`

This starts:

- **API server** at \`http://localhost:3100\`
- **UI** served by the API server in dev middleware mode (same origin)

No Docker or external database required. Sanad AI uses embedded PostgreSQL automatically.

## One-Command Bootstrap

\`\`\`sh
pnpm sanadai run
\`\`\`

This auto-onboards if config is missing, runs \`sanadai doctor\` with repair enabled, and starts the server.

## Health Checks

\`\`\`sh
curl http://localhost:3100/api/health
# -> {"status":"ok"}

curl http://localhost:3100/api/companies
# -> []
\`\`\`

## Reset Dev Data

To wipe local data and start fresh:

\`\`\`sh
rm -rf ~/.sanad/instances/default/db
pnpm dev
\`\`\`

## Data Locations

| Data | Path |
|------|------|
| Config | \`~/.sanad/instances/default/config.json\` |
| Database | \`~/.sanad/instances/default/db\` |
| Storage | \`~/.sanad/instances/default/data/storage\` |
| Secrets key | \`~/.sanad/instances/default/secrets/master.key\` |
| Logs | \`~/.sanad/instances/default/logs\` |

Override with environment variables:

\`\`\`sh
SANAD_HOME=/custom/path SANAD_INSTANCE_ID=dev pnpm sanadai run
\`\`\``,
      },
      {
        id: "docker",
        title: "Docker",
        content: `# Docker

Run Sanad AI in Docker without installing Node or pnpm locally.

## Compose Quickstart (Recommended)

\`\`\`sh
docker compose -f docker-compose.quickstart.yml up --build
\`\`\`

Open [http://localhost:3100](http://localhost:3100).

Defaults:
- Host port: \`3100\`
- Data directory: \`./data/docker-paperclip\`

Override with environment variables:

\`\`\`sh
PAPERCLIP_PORT=3200 PAPERCLIP_DATA_DIR=./data/pc \\
  docker compose -f docker-compose.quickstart.yml up --build
\`\`\`

## Manual Docker Build

\`\`\`sh
docker build -t sanad-ai-local .
docker run --name sanad-ai \\
  -p 3100:3100 \\
  -e HOST=0.0.0.0 \\
  -e SANAD_HOME=/paperclip \\
  -v "$(pwd)/data/docker-paperclip:/paperclip" \\
  sanad-ai-local
\`\`\`

## Data Persistence

All data is persisted under the bind mount:

- Embedded PostgreSQL data
- Uploaded assets
- Local secrets key
- Agent workspace data

## Claude and Codex Adapters in Docker

The Docker image pre-installs \`claude\` (Anthropic Claude Code CLI) and \`codex\` (OpenAI Codex CLI).

Pass API keys to enable local adapter runs inside the container:

\`\`\`sh
docker run --name sanad-ai \\
  -p 3100:3100 \\
  -e HOST=0.0.0.0 \\
  -e SANAD_HOME=/paperclip \\
  -e OPENAI_API_KEY=sk-... \\
  -e ANTHROPIC_API_KEY=sk-... \\
  -v "$(pwd)/data/docker-paperclip:/paperclip" \\
  sanad-ai-local
\`\`\``,
      },
      {
        id: "deployment-modes",
        title: "Deployment Modes",
        content: `# Deployment Modes

Sanad AI supports two runtime modes with different security profiles.

## \`local_trusted\`

The default mode. Optimized for single-operator local use.

- **Host binding**: loopback only (localhost)
- **Authentication**: no login required
- **Use case**: local development, solo experimentation
- **Board identity**: auto-created local board user

## \`authenticated\`

Login required. Supports two exposure policies.

### \`authenticated\` + \`private\`

For private network access (Tailscale, VPN, LAN).

- **Authentication**: login required via Better Auth
- **URL handling**: auto base URL mode (lower friction)
- **Host trust**: private-host trust policy required

Allow custom Tailscale hostnames:

\`\`\`sh
pnpm sanadai allowed-hostname my-machine
\`\`\`

### \`authenticated\` + \`public\`

For internet-facing deployment.

- **Authentication**: login required
- **URL**: explicit public URL required
- **Security**: stricter deployment checks

## Board Claim Flow

When migrating from \`local_trusted\` to \`authenticated\`, Sanad AI emits a one-time claim URL at startup:

\`\`\`
/board-claim/<token>?code=<code>
\`\`\`

A signed-in user visits this URL to claim board ownership. This:

- Promotes the current user to instance admin
- Demotes the auto-created local board admin
- Ensures active company membership for the claiming user

## Changing Modes

Update the deployment mode:

\`\`\`sh
pnpm sanadai configure --section server
\`\`\`

Runtime override via environment variable:

\`\`\`sh
PAPERCLIP_DEPLOYMENT_MODE=authenticated pnpm sanadai run
\`\`\``,
      },
      {
        id: "tailscale",
        title: "Tailscale",
        content: `# Tailscale Private Access

Use this when you want to access Sanad AI over Tailscale (or a private LAN/VPN) instead of only localhost.

## 1. Start in Private Authenticated Mode

\`\`\`sh
pnpm dev --tailscale-auth
\`\`\`

This configures:

- \`PAPERCLIP_DEPLOYMENT_MODE=authenticated\`
- \`PAPERCLIP_DEPLOYMENT_EXPOSURE=private\`
- \`PAPERCLIP_AUTH_BASE_URL_MODE=auto\`
- \`HOST=0.0.0.0\` (bind on all interfaces)

## 2. Find Your Tailscale Address

\`\`\`sh
tailscale ip -4
\`\`\`

Or use your Tailscale MagicDNS hostname (e.g. \`my-macbook.tailnet.ts.net\`).

## 3. Open from Another Device

\`\`\`
http://<tailscale-host-or-ip>:3100
\`\`\`

## 4. Allow Custom Hostnames

\`\`\`sh
pnpm sanadai allowed-hostname my-macbook.tailnet.ts.net
\`\`\`

## 5. Verify Connectivity

\`\`\`sh
curl http://<tailscale-host-or-ip>:3100/api/health
# -> {"status":"ok"}
\`\`\`

## Troubleshooting

- Login or redirect errors on a private hostname: add it with \`sanadai allowed-hostname\`
- App only works on localhost: make sure you started with \`--tailscale-auth\`
- Can connect locally but not remotely: verify both devices are on the same Tailscale network`,
      },
      {
        id: "database",
        title: "Database",
        content: `# Database

Sanad AI uses PostgreSQL via Drizzle ORM. There are three ways to run the database.

## 1. Embedded PostgreSQL (Default)

Zero config. If you don't set \`DATABASE_URL\`, the server starts an embedded PostgreSQL instance automatically.

On first start, the server:

1. Creates \`~/.sanad/instances/default/db/\` for storage
2. Ensures the database exists
3. Runs migrations automatically
4. Starts serving requests

Data persists across restarts. To reset: \`rm -rf ~/.sanad/instances/default/db\`.

## 2. Local PostgreSQL (Docker)

\`\`\`sh
docker compose up -d
\`\`\`

This starts PostgreSQL 17 on \`localhost:5432\`. Set the connection string:

\`\`\`sh
cp .env.example .env
# DATABASE_URL=postgres://paperclip:paperclip@localhost:5432/paperclip
\`\`\`

Push the schema:

\`\`\`sh
DATABASE_URL=postgres://paperclip:paperclip@localhost:5432/paperclip \\
  npx drizzle-kit push
\`\`\`

## 3. Hosted PostgreSQL (Supabase)

For production, use a hosted provider like Supabase.

1. Create a project
2. Copy the connection string from Project Settings > Database
3. Set \`DATABASE_URL\` in your \`.env\`

Use the **direct connection** (port 5432) for migrations and the **pooled connection** (port 6543) for the application.

## Switching Between Modes

| \`DATABASE_URL\` | Mode |
|----------------|------|
| Not set | Embedded PostgreSQL |
| \`postgres://...localhost...\` | Local Docker PostgreSQL |
| \`postgres://...supabase.com...\` | Hosted Supabase |

The Drizzle schema is the same regardless of mode.`,
      },
      {
        id: "secrets",
        title: "Secrets",
        content: `# Secrets Management

Sanad AI encrypts secrets at rest using a local master key. Agent environment variables that contain sensitive values (API keys, tokens) are stored as encrypted secret references.

## Default Provider: \`local_encrypted\`

Secrets are encrypted with a local master key stored at:

\`\`\`
~/.sanad/instances/default/secrets/master.key
\`\`\`

This key is auto-created during onboarding and never leaves your machine.

## Environment Overrides

| Variable | Description |
|----------|-------------|
| \`PAPERCLIP_SECRETS_MASTER_KEY\` | 32-byte key as base64, hex, or raw string |
| \`PAPERCLIP_SECRETS_MASTER_KEY_FILE\` | Custom key file path |
| \`PAPERCLIP_SECRETS_STRICT_MODE\` | Set to \`true\` to enforce secret refs |

## Strict Mode

When enabled, sensitive env keys (matching \`*_API_KEY\`, \`*_TOKEN\`, \`*_SECRET\`) must use secret references instead of inline plain values. Recommended for any deployment beyond local trusted.

## Secret References in Agent Config

\`\`\`json
{
  "env": {
    "ANTHROPIC_API_KEY": {
      "type": "secret_ref",
      "secretId": "8f884973-c29b-44e4-8ea3-6413437f8081",
      "version": "latest"
    }
  }
}
\`\`\`

The server resolves and decrypts these at runtime, injecting the real value into the agent process environment.

## Migrating Inline Secrets

\`\`\`sh
pnpm secrets:migrate-inline-env         # dry run
pnpm secrets:migrate-inline-env --apply # apply migration
\`\`\``,
      },
      {
        id: "storage",
        title: "Storage",
        content: `# Storage

Sanad AI stores uploaded files (issue attachments, images) using a configurable storage provider.

## Local Disk (Default)

Files are stored at:

\`\`\`
~/.sanad/instances/default/data/storage
\`\`\`

No configuration required. Suitable for local development and single-machine deployments.

## S3-Compatible Storage

For production or multi-node deployments, use S3-compatible object storage (AWS S3, MinIO, Cloudflare R2, etc.).

Configure via CLI:

\`\`\`sh
pnpm sanadai configure --section storage
\`\`\`

## Configuration

| Provider | Best For |
|----------|----------|
| \`local_disk\` | Local development, single-machine deployments |
| \`s3\` | Production, multi-node, cloud deployments |

Storage configuration is stored in the instance config file:

\`\`\`
~/.sanad/instances/default/config.json
\`\`\``,
      },
      {
        id: "environment-variables",
        title: "Environment Variables",
        content: `# Environment Variables

All environment variables that Sanad AI uses for server configuration.

## Server Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| \`PORT\` | \`3100\` | Server port |
| \`HOST\` | \`127.0.0.1\` | Server host binding |
| \`DATABASE_URL\` | (embedded) | PostgreSQL connection string |
| \`SANAD_HOME\` | \`~/.paperclip\` | Base directory for all data |
| \`SANAD_INSTANCE_ID\` | \`default\` | Instance identifier (for multiple local instances) |
| \`PAPERCLIP_DEPLOYMENT_MODE\` | \`local_trusted\` | Runtime mode override |

## Secrets

| Variable | Default | Description |
|----------|---------|-------------|
| \`PAPERCLIP_SECRETS_MASTER_KEY\` | (from file) | 32-byte encryption key (base64/hex/raw) |
| \`PAPERCLIP_SECRETS_MASTER_KEY_FILE\` | (auto) | Path to key file |
| \`PAPERCLIP_SECRETS_STRICT_MODE\` | \`false\` | Require secret refs for sensitive env vars |

## Agent Runtime (Injected into agent processes)

These are set automatically by the server when invoking agents:

| Variable | Description |
|----------|-------------|
| \`PAPERCLIP_AGENT_ID\` | Agent's unique ID |
| \`PAPERCLIP_COMPANY_ID\` | Company ID |
| \`PAPERCLIP_API_URL\` | API base URL |
| \`PAPERCLIP_API_KEY\` | Short-lived JWT for API auth |
| \`PAPERCLIP_RUN_ID\` | Current heartbeat run ID |
| \`PAPERCLIP_TASK_ID\` | Issue that triggered this wake |
| \`PAPERCLIP_WAKE_REASON\` | Wake trigger reason |
| \`PAPERCLIP_WAKE_COMMENT_ID\` | Comment that triggered this wake |
| \`PAPERCLIP_APPROVAL_ID\` | Resolved approval ID |
| \`PAPERCLIP_APPROVAL_STATUS\` | Approval decision |
| \`PAPERCLIP_LINKED_ISSUE_IDS\` | Comma-separated linked issue IDs |

## LLM Provider Keys (for adapters)

| Variable | Description |
|----------|-------------|
| \`ANTHROPIC_API_KEY\` | Anthropic API key (for Claude Local adapter) |
| \`OPENAI_API_KEY\` | OpenAI API key (for Codex Local adapter) |
| \`GEMINI_API_KEY\` | Google API key (for Gemini Local adapter) |`,
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // 9. ADAPTERS
  // ─────────────────────────────────────────────────────────────
  {
    id: "adapters",
    title: "Adapters",
    icon: "Plug",
    pages: [
      {
        id: "adapters-overview",
        title: "Overview",
        content: `# Adapters Overview

Adapters are the bridge between Sanad AI's orchestration layer and agent runtimes. Each adapter knows how to invoke a specific type of AI agent and capture its results.

## How Adapters Work

When a heartbeat fires, Sanad AI:

1. Looks up the agent's \`adapterType\` and \`adapterConfig\`
2. Calls the adapter's \`execute()\` function with the execution context
3. The adapter spawns or calls the agent runtime
4. The adapter captures stdout, parses usage/cost data, and returns a structured result

## Built-in Adapters

| Adapter | Type Key | Description |
|---------|----------|-------------|
| Claude Local | \`claude_local\` | Runs Claude Code CLI locally |
| Codex Local | \`codex_local\` | Runs OpenAI Codex CLI locally |
| Gemini Local | \`gemini_local\` | Runs Gemini CLI locally |
| OpenCode Local | \`opencode_local\` | Runs OpenCode CLI locally (multi-provider) |
| Process | \`process\` | Executes arbitrary shell commands |
| HTTP | \`http\` | Sends webhooks to external agents |

## Adapter Architecture

Each adapter is a package with three modules:

\`\`\`
packages/adapters/<name>/
  src/
    index.ts            # Shared metadata (type, label, models)
    server/
      execute.ts        # Core execution logic
      parse.ts          # Output parsing
      test.ts           # Environment diagnostics
    ui/
      parse-stdout.ts   # Stdout -> transcript entries for run viewer
      build-config.ts   # Form values -> adapterConfig JSON
    cli/
      format-event.ts   # Terminal output for sanadai run --watch
\`\`\`

Three registries consume these modules:

| Registry | What it does |
|----------|-------------|
| **Server** | Executes agents, captures results |
| **UI** | Renders run transcripts, provides config forms |
| **CLI** | Formats terminal output for live watching |

## Choosing an Adapter

- **Need a coding agent?** Use \`claude_local\`, \`codex_local\`, \`gemini_local\`, or \`opencode_local\`
- **Need to run a script or command?** Use \`process\`
- **Need to call an external service?** Use \`http\`
- **Need something custom?** Create your own adapter`,
      },
      {
        id: "claude-local",
        title: "Claude Local",
        content: `# Claude Local Adapter

The \`claude_local\` adapter runs Anthropic's Claude Code CLI locally. It supports session persistence, skills injection, and structured output parsing.

## Prerequisites

- Claude Code CLI installed (\`claude\` command available)
- \`ANTHROPIC_API_KEY\` set in the environment or agent config

## Configuration Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| \`cwd\` | string | Yes | Working directory for the agent process |
| \`model\` | string | No | Claude model to use (e.g. \`claude-opus-4-6\`) |
| \`promptTemplate\` | string | No | Prompt used for all runs |
| \`env\` | object | No | Environment variables (supports secret refs) |
| \`timeoutSec\` | number | No | Process timeout (0 = no timeout) |
| \`graceSec\` | number | No | Grace period before force-kill |
| \`maxTurnsPerRun\` | number | No | Max agentic turns per heartbeat (defaults to 300) |
| \`dangerouslySkipPermissions\` | boolean | No | Skip permission prompts (dev only) |

## Prompt Templates

Templates support \`{{variable}}\` substitution:

| Variable | Value |
|----------|-------|
| \`{{agentId}}\` | Agent's ID |
| \`{{companyId}}\` | Company ID |
| \`{{runId}}\` | Current run ID |
| \`{{agent.name}}\` | Agent's name |
| \`{{company.name}}\` | Company name |

## Session Persistence

The adapter persists Claude Code session IDs between heartbeats. On the next wake, it resumes the existing conversation so the agent retains full context.

Session resume is cwd-aware: if the agent's working directory changed since the last run, a fresh session starts instead. If resume fails with an unknown session error, the adapter automatically retries with a fresh session.

## Skills Injection

The adapter creates a temporary directory with symlinks to Sanad AI skills and passes it via \`--add-dir\`. This makes skills discoverable without polluting the agent's working directory.

## Environment Test

Use the "Test Environment" button to validate the adapter config. It checks:

- Claude CLI is installed and accessible
- Working directory is absolute and available
- API key/auth mode hints
- A live hello probe to verify CLI readiness`,
      },
      {
        id: "codex-local",
        title: "Codex Local",
        content: `# Codex Local Adapter

The \`codex_local\` adapter runs OpenAI's Codex CLI locally. It supports session persistence via \`previous_response_id\` chaining and skills injection through the global Codex skills directory.

## Prerequisites

- Codex CLI installed (\`codex\` command available)
- \`OPENAI_API_KEY\` set in the environment or agent config

## Configuration Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| \`cwd\` | string | Yes | Working directory for the agent process |
| \`model\` | string | No | Model to use |
| \`promptTemplate\` | string | No | Prompt used for all runs |
| \`env\` | object | No | Environment variables (supports secret refs) |
| \`timeoutSec\` | number | No | Process timeout (0 = no timeout) |
| \`graceSec\` | number | No | Grace period before force-kill |
| \`dangerouslyBypassApprovalsAndSandbox\` | boolean | No | Skip safety checks (dev only) |

## Session Persistence

Codex uses \`previous_response_id\` for session continuity. The adapter serializes and restores this across heartbeats, allowing the agent to maintain conversation context.

## Skills Injection

The adapter symlinks Sanad AI skills into the global Codex skills directory (\`~/.codex/skills\`). Existing user skills are not overwritten.

## Environment Test

Checks: Codex CLI is installed, working directory is valid, \`OPENAI_API_KEY\` is present, and a live hello probe passes.`,
      },
      {
        id: "gemini-local",
        title: "Gemini Local",
        content: `# Gemini Local Adapter

The \`gemini_local\` adapter runs Google's Gemini CLI locally. It supports session persistence with \`--resume\`, skills injection, and structured output parsing.

## Prerequisites

- Gemini CLI installed (\`gemini\` command available)
- \`GEMINI_API_KEY\` or \`GOOGLE_API_KEY\` set, or local Gemini CLI auth configured

## Configuration Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| \`cwd\` | string | Yes | Working directory for the agent process |
| \`model\` | string | No | Gemini model to use (defaults to \`auto\`) |
| \`promptTemplate\` | string | No | Prompt used for all runs |
| \`instructionsFilePath\` | string | No | Markdown instructions file prepended to the prompt |
| \`env\` | object | No | Environment variables (supports secret refs) |
| \`timeoutSec\` | number | No | Process timeout (0 = no timeout) |
| \`graceSec\` | number | No | Grace period before force-kill |
| \`yolo\` | boolean | No | Pass \`--approval-mode yolo\` for unattended operation |

## Session Persistence

The adapter persists Gemini session IDs between heartbeats. On the next wake, it resumes the existing conversation with \`--resume\`. Session resume is cwd-aware.

## Skills Injection

The adapter symlinks Sanad AI skills into the Gemini global skills directory (\`~/.gemini/skills\`). Existing user skills are not overwritten.`,
      },
      {
        id: "process",
        title: "Process",
        content: `# Process Adapter

The \`process\` adapter executes arbitrary shell commands. Use it for simple scripts, one-shot tasks, or agents built on custom frameworks.

## When to Use

- Running a Python script that calls the Sanad AI API
- Executing a custom agent loop
- Any runtime that can be invoked as a shell command

## When Not to Use

- If you need session persistence across runs (use \`claude_local\` or \`codex_local\`)
- If the agent needs conversational context between heartbeats

## Configuration

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| \`command\` | string | Yes | Shell command to execute |
| \`cwd\` | string | No | Working directory |
| \`env\` | object | No | Environment variables |
| \`timeoutSec\` | number | No | Process timeout |

## How It Works

1. Sanad AI spawns the configured command as a child process
2. Standard environment variables are injected (\`PAPERCLIP_AGENT_ID\`, \`PAPERCLIP_API_KEY\`, etc.)
3. The process runs to completion
4. Exit code determines success/failure

## Example

\`\`\`json
{
  "adapterType": "process",
  "adapterConfig": {
    "command": "python3 /path/to/agent.py",
    "cwd": "/path/to/workspace",
    "timeoutSec": 300
  }
}
\`\`\``,
      },
      {
        id: "http",
        title: "HTTP",
        content: `# HTTP Adapter

The \`http\` adapter sends a webhook request to an external agent service. The agent runs externally and Sanad AI just triggers it.

## When to Use

- Agent runs as an external service (cloud function, dedicated server)
- Fire-and-forget invocation model
- Integration with third-party agent platforms

## When Not to Use

- If the agent runs locally (use \`process\`, \`claude_local\`, or \`codex_local\`)
- If you need stdout capture and real-time run viewing

## Configuration

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| \`url\` | string | Yes | Webhook URL to POST to |
| \`headers\` | object | No | Additional HTTP headers |
| \`timeoutSec\` | number | No | Request timeout |

## How It Works

1. Sanad AI sends a POST request to the configured URL
2. The request body includes the execution context (agent ID, task info, wake reason)
3. The external agent processes the request and calls back to the API
4. Response from the webhook is captured as the run result

## Request Body

\`\`\`json
{
  "runId": "...",
  "agentId": "...",
  "companyId": "...",
  "context": {
    "taskId": "...",
    "wakeReason": "...",
    "commentId": "..."
  }
}
\`\`\``,
      },
      {
        id: "creating-an-adapter",
        title: "Creating an Adapter",
        content: `# Creating an Adapter

Build a custom adapter to connect Sanad AI to any agent runtime.

## Package Structure

\`\`\`
packages/adapters/<name>/
  package.json
  tsconfig.json
  src/
    index.ts            # Shared metadata
    server/
      index.ts          # Server exports
      execute.ts        # Core execution logic
      parse.ts          # Output parsing
      test.ts           # Environment diagnostics
    ui/
      index.ts          # UI exports
      parse-stdout.ts   # Transcript parser
      build-config.ts   # Config builder
    cli/
      index.ts          # CLI exports
      format-event.ts   # Terminal formatter
\`\`\`

## Step 1: Root Metadata

\`\`\`ts
export const type = "my_agent";        // snake_case, globally unique
export const label = "My Agent (local)";
export const models = [
  { id: "model-a", label: "Model A" },
];
\`\`\`

## Step 2: Server Execute

The \`execute.ts\` function receives an \`AdapterExecutionContext\` and returns an \`AdapterExecutionResult\`. Key responsibilities:

1. Read config using safe helpers (\`asString\`, \`asNumber\`, etc.)
2. Build environment with \`buildSanad AI EOIEnv(agent)\` plus context vars
3. Resolve session state from \`runtime.sessionParams\`
4. Render prompt with \`renderTemplate(template, data)\`
5. Spawn the process or call via \`fetch()\`
6. Parse output for usage, costs, session state, errors
7. Handle unknown session errors (retry fresh, set \`clearSession: true\`)

## Step 3: Environment Test

Return structured diagnostics: \`error\` for invalid setup, \`warn\` for non-blocking issues, \`info\` for successful checks.

## Step 4: UI Module

- \`parse-stdout.ts\` — converts stdout lines to transcript entries
- \`build-config.ts\` — converts form values to \`adapterConfig\` JSON

## Step 5: CLI Module

\`format-event.ts\` — pretty-prints stdout for \`sanadai run --watch\`.

## Step 6: Register

Add the adapter to all three registries:

1. \`server/src/adapters/registry.ts\`
2. \`ui/src/adapters/registry.ts\`
3. \`cli/src/adapters/registry.ts\`

## Skills Injection Strategies

1. **Best: tmpdir + flag** — create tmpdir, symlink skills, pass via CLI flag, clean up after
2. **Acceptable: global config dir** — symlink to the runtime's global plugins directory
3. **Acceptable: env var** — point a skills path env var at the repo's skills directory
4. **Last resort: prompt injection** — include skill content in the prompt template

## Security

- Treat agent output as untrusted (parse defensively, never execute)
- Inject secrets via environment variables, not prompts
- Configure network access controls if the runtime supports them
- Always enforce timeout and grace period`,
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // 10. API REFERENCE
  // ─────────────────────────────────────────────────────────────
  {
    id: "api-reference",
    title: "API Reference",
    icon: "Code",
    pages: [
      {
        id: "api-overview",
        title: "Overview",
        content: `# API Overview

Sanad AI exposes a RESTful JSON API for all control plane operations.

## Base URL

Default: \`http://localhost:3100/api\`

All endpoints are prefixed with \`/api\`.

## Authentication

All requests require an \`Authorization\` header:

\`\`\`
Authorization: Bearer <token>
\`\`\`

Tokens are either:

- **Agent API keys** — long-lived keys created for agents
- **Agent run JWTs** — short-lived tokens injected during heartbeats (\`PAPERCLIP_API_KEY\`)
- **User session cookies** — for board operators using the web UI

## Request Format

- All request bodies are JSON with \`Content-Type: application/json\`
- Company-scoped endpoints require \`:companyId\` in the path
- Include \`X-Sanad AI EOI-Run-Id\` header on all mutating requests during heartbeats

## Error Codes

| Code | Meaning | What to Do |
|------|---------|------------|
| \`400\` | Validation error | Check request body against expected fields |
| \`401\` | Unauthenticated | API key missing or invalid |
| \`403\` | Unauthorized | You don't have permission for this action |
| \`404\` | Not found | Entity doesn't exist or isn't in your company |
| \`409\` | Conflict | Another agent owns the task. **Do not retry.** |
| \`422\` | Semantic violation | Invalid state transition |
| \`500\` | Server error | Transient failure. Comment on the task and move on. |

## Pagination

List endpoints support standard pagination query parameters. Results are sorted by priority for issues and by creation date for other entities.`,
      },
      {
        id: "api-auth",
        title: "Authentication",
        content: `# Authentication

Sanad AI supports multiple authentication methods depending on the deployment mode and caller type.

## Agent Authentication

### Run JWTs (Recommended)

During heartbeats, agents receive a short-lived JWT via \`PAPERCLIP_API_KEY\`:

\`\`\`
Authorization: Bearer <PAPERCLIP_API_KEY>
\`\`\`

This JWT is scoped to the agent and the current run.

### Agent API Keys

Long-lived API keys for persistent access:

\`\`\`
POST /api/agents/{agentId}/keys
\`\`\`

Returns a key that should be stored securely. The key is hashed at rest — the full value is only shown at creation time.

### Agent Identity

\`\`\`
GET /api/agents/me
\`\`\`

Returns the agent record including ID, company, role, chain of command, and budget.

## Board Operator Authentication

### Local Trusted Mode

No authentication required. All requests are treated as the local board operator.

### Authenticated Mode

Board operators authenticate via Better Auth sessions (cookie-based). The web UI handles login/logout flows automatically.

## Company Scoping

- Agents can only access entities in their own company
- Board operators can access all companies they're members of
- Cross-company access is denied with \`403\``,
      },
      {
        id: "api-companies",
        title: "Companies",
        content: `# Companies API

## List Companies

\`\`\`
GET /api/companies
\`\`\`

## Get Company

\`\`\`
GET /api/companies/{companyId}
\`\`\`

## Create Company

\`\`\`
POST /api/companies
{
  "name": "My AI Company",
  "description": "An autonomous marketing agency"
}
\`\`\`

## Update Company

\`\`\`
PATCH /api/companies/{companyId}
{
  "name": "Updated Name",
  "description": "Updated description",
  "budgetMonthlyCents": 100000
}
\`\`\`

## Archive Company

\`\`\`
POST /api/companies/{companyId}/archive
\`\`\`

## Company Fields

| Field | Type | Description |
|-------|------|-------------|
| \`id\` | string | Unique identifier |
| \`name\` | string | Company name |
| \`description\` | string | Company description |
| \`status\` | string | \`active\`, \`paused\`, \`archived\` |
| \`budgetMonthlyCents\` | number | Monthly budget limit |
| \`createdAt\` | string | ISO timestamp |
| \`updatedAt\` | string | ISO timestamp |`,
      },
      {
        id: "api-agents",
        title: "Agents",
        content: `# Agents API

## List Agents

\`\`\`
GET /api/companies/{companyId}/agents
\`\`\`

## Get Agent

\`\`\`
GET /api/agents/{agentId}
\`\`\`

## Get Current Agent

\`\`\`
GET /api/agents/me
\`\`\`

Response includes \`chainOfCommand\`, \`budgetMonthlyCents\`, and \`spentMonthlyCents\`.

## Create Agent

\`\`\`
POST /api/companies/{companyId}/agents
{
  "name": "Engineer",
  "role": "engineer",
  "title": "Software Engineer",
  "reportsTo": "{managerAgentId}",
  "capabilities": "Full-stack development",
  "adapterType": "claude_local",
  "adapterConfig": { ... }
}
\`\`\`

## Update Agent

\`\`\`
PATCH /api/agents/{agentId}
{ "adapterConfig": { ... }, "budgetMonthlyCents": 10000 }
\`\`\`

## Pause / Resume / Terminate

\`\`\`
POST /api/agents/{agentId}/pause
POST /api/agents/{agentId}/resume
POST /api/agents/{agentId}/terminate    # Irreversible
\`\`\`

## Create API Key

\`\`\`
POST /api/agents/{agentId}/keys
\`\`\`

## Invoke Heartbeat

\`\`\`
POST /api/agents/{agentId}/heartbeat/invoke
\`\`\`

## Org Chart

\`\`\`
GET /api/companies/{companyId}/org
\`\`\`

## List Adapter Models

\`\`\`
GET /api/companies/{companyId}/adapters/{adapterType}/models
\`\`\`

## Config Revisions

\`\`\`
GET  /api/agents/{agentId}/config-revisions
POST /api/agents/{agentId}/config-revisions/{revisionId}/rollback
\`\`\``,
      },
      {
        id: "api-issues",
        title: "Issues",
        content: `# Issues API

## List Issues

\`\`\`
GET /api/companies/{companyId}/issues
\`\`\`

Query parameters: \`status\` (comma-separated), \`assigneeAgentId\`, \`projectId\`. Results sorted by priority.

## Get Issue

\`\`\`
GET /api/issues/{issueId}
\`\`\`

Returns the issue with \`project\`, \`goal\`, and \`ancestors\`.

## Create Issue

\`\`\`
POST /api/companies/{companyId}/issues
{
  "title": "Implement caching layer",
  "description": "Add Redis caching for hot queries",
  "status": "todo",
  "priority": "high",
  "assigneeAgentId": "{agentId}",
  "parentId": "{parentIssueId}",
  "projectId": "{projectId}",
  "goalId": "{goalId}"
}
\`\`\`

## Update Issue

\`\`\`
PATCH /api/issues/{issueId}
Headers: X-Sanad AI EOI-Run-Id: {runId}
{ "status": "done", "comment": "Implemented caching with 90% hit rate." }
\`\`\`

## Checkout (Claim Task)

\`\`\`
POST /api/issues/{issueId}/checkout
Headers: X-Sanad AI EOI-Run-Id: {runId}
{ "agentId": "{yourAgentId}", "expectedStatuses": ["todo", "backlog", "blocked"] }
\`\`\`

Returns \`409 Conflict\` if another agent owns it. **Never retry a 409.**

## Release Task

\`\`\`
POST /api/issues/{issueId}/release
\`\`\`

## Comments

\`\`\`
GET  /api/issues/{issueId}/comments
POST /api/issues/{issueId}/comments
{ "body": "Progress update in markdown..." }
\`\`\`

## Attachments

\`\`\`
POST   /api/companies/{companyId}/issues/{issueId}/attachments  # multipart/form-data
GET    /api/issues/{issueId}/attachments
GET    /api/attachments/{attachmentId}/content
DELETE /api/attachments/{attachmentId}
\`\`\`

## Issue Lifecycle

\`\`\`mermaid
graph LR
    backlog --> todo --> in_progress --> in_review --> done
    in_progress --> blocked
\`\`\`

Terminal states: \`done\`, \`cancelled\`. \`started_at\` auto-set on \`in_progress\`, \`completed_at\` auto-set on \`done\`.`,
      },
      {
        id: "api-approvals",
        title: "Approvals",
        content: `# Approvals API

## List Approvals

\`\`\`
GET /api/companies/{companyId}/approvals
\`\`\`

Query parameter: \`status\` (e.g. \`pending\`).

## Get Approval

\`\`\`
GET /api/approvals/{approvalId}
\`\`\`

## Create Approval Request

\`\`\`
POST /api/companies/{companyId}/approvals
{
  "type": "approve_ceo_strategy",
  "requestedByAgentId": "{agentId}",
  "payload": { "plan": "Strategic breakdown..." }
}
\`\`\`

## Create Hire Request

\`\`\`
POST /api/companies/{companyId}/agent-hires
{
  "name": "Marketing Analyst",
  "role": "researcher",
  "reportsTo": "{managerAgentId}",
  "capabilities": "Market research",
  "budgetMonthlyCents": 5000
}
\`\`\`

## Approve / Reject / Revise

\`\`\`
POST /api/approvals/{approvalId}/approve
{ "decisionNote": "Approved." }

POST /api/approvals/{approvalId}/reject
{ "decisionNote": "Budget too high." }

POST /api/approvals/{approvalId}/request-revision
{ "decisionNote": "Please reduce the budget." }

POST /api/approvals/{approvalId}/resubmit
{ "payload": { "updated": "config..." } }
\`\`\`

## Linked Issues & Comments

\`\`\`
GET  /api/approvals/{approvalId}/issues
GET  /api/approvals/{approvalId}/comments
POST /api/approvals/{approvalId}/comments
{ "body": "Discussion comment..." }
\`\`\`

## Lifecycle

\`\`\`
pending -> approved
        -> rejected
        -> revision_requested -> resubmitted -> pending
\`\`\``,
      },
      {
        id: "api-goals-projects",
        title: "Goals & Projects",
        content: `# Goals & Projects API

## Goals

Goals form a hierarchy: company goals break down into team goals, then agent-level goals.

\`\`\`
GET  /api/companies/{companyId}/goals
GET  /api/goals/{goalId}
POST /api/companies/{companyId}/goals
{ "title": "Launch MVP by Q1", "description": "Ship minimum viable product", "level": "company", "status": "active" }

PATCH /api/goals/{goalId}
{ "status": "completed" }
\`\`\`

## Projects

Projects group related issues toward a deliverable.

\`\`\`
GET  /api/companies/{companyId}/projects
GET  /api/projects/{projectId}
POST /api/companies/{companyId}/projects
{
  "name": "Auth System",
  "description": "End-to-end authentication",
  "goalIds": ["{goalId}"],
  "status": "planned",
  "workspace": {
    "name": "auth-repo",
    "cwd": "/path/to/workspace",
    "repoUrl": "https://github.com/org/repo",
    "repoRef": "main",
    "isPrimary": true
  }
}

PATCH /api/projects/{projectId}
{ "status": "in_progress" }
\`\`\`

## Project Workspaces

\`\`\`
POST   /api/projects/{projectId}/workspaces
{ "name": "auth-repo", "cwd": "/path/to/workspace", "isPrimary": true }

GET    /api/projects/{projectId}/workspaces
PATCH  /api/projects/{projectId}/workspaces/{workspaceId}
DELETE /api/projects/{projectId}/workspaces/{workspaceId}
\`\`\`

Agents use the primary workspace to determine their working directory for project-scoped tasks.`,
      },
      {
        id: "api-costs",
        title: "Costs",
        content: `# Costs API

## Report Cost Event

\`\`\`
POST /api/companies/{companyId}/cost-events
{
  "agentId": "{agentId}",
  "provider": "anthropic",
  "model": "claude-sonnet-4-20250514",
  "inputTokens": 15000,
  "outputTokens": 3000,
  "costCents": 12
}
\`\`\`

Typically reported automatically by adapters after each heartbeat.

## Company Cost Summary

\`\`\`
GET /api/companies/{companyId}/costs/summary
\`\`\`

Returns total spend, budget, and utilization for the current month.

## Costs by Agent

\`\`\`
GET /api/companies/{companyId}/costs/by-agent
\`\`\`

## Costs by Project

\`\`\`
GET /api/companies/{companyId}/costs/by-project
\`\`\`

## Budget Management

\`\`\`
PATCH /api/companies/{companyId}
{ "budgetMonthlyCents": 100000 }

PATCH /api/agents/{agentId}
{ "budgetMonthlyCents": 5000 }
\`\`\`

## Budget Enforcement

| Threshold | Effect |
|-----------|--------|
| 80% | Soft alert — agent should focus on critical tasks |
| 100% | Hard stop — agent is auto-paused |

Budget windows reset on the first of each month (UTC).`,
      },
      {
        id: "api-activity",
        title: "Activity",
        content: `# Activity API

## List Activity

\`\`\`
GET /api/companies/{companyId}/activity
\`\`\`

Query parameters:

| Param | Description |
|-------|-------------|
| \`agentId\` | Filter by actor agent |
| \`entityType\` | Filter by entity type (\`issue\`, \`agent\`, \`approval\`) |
| \`entityId\` | Filter by specific entity |

## Activity Record

| Field | Description |
|-------|-------------|
| \`actor\` | Agent or user who performed the action |
| \`action\` | What was done (created, updated, commented, etc.) |
| \`entityType\` | What type of entity was affected |
| \`entityId\` | ID of the affected entity |
| \`details\` | Specifics of the change |
| \`createdAt\` | When the action occurred |

The activity log is append-only and immutable. All mutations are recorded: issue and agent lifecycle events, approval decisions, comment creation, budget changes, and company configuration changes.`,
      },
      {
        id: "api-dashboard",
        title: "Dashboard",
        content: `# Dashboard API

## Get Dashboard

\`\`\`
GET /api/companies/{companyId}/dashboard
\`\`\`

Returns a health summary including:

- **Agent counts** by status (active, idle, running, error, paused)
- **Task counts** by status (backlog, todo, in_progress, blocked, done)
- **Stale tasks** — tasks in progress with no recent activity
- **Cost summary** — current month spend vs budget
- **Recent activity** — latest mutations

## Use Cases

- Board operators: quick health check from the web UI
- CEO agents: situational awareness at the start of each heartbeat
- Manager agents: check team status and identify blockers`,
      },
      {
        id: "api-secrets",
        title: "Secrets",
        content: `# Secrets API

## List Secrets

\`\`\`
GET /api/companies/{companyId}/secrets
\`\`\`

Returns secret metadata (not decrypted values).

## Create Secret

\`\`\`
POST /api/companies/{companyId}/secrets
{
  "name": "anthropic-api-key",
  "value": "sk-ant-..."
}
\`\`\`

The value is encrypted at rest. Only the secret ID and metadata are returned.

## Update Secret

\`\`\`
PATCH /api/secrets/{secretId}
{
  "value": "sk-ant-new-value..."
}
\`\`\`

Creates a new version. Agents referencing \`"version": "latest"\` automatically get the new value on next heartbeat.

## Using Secrets in Agent Config

\`\`\`json
{
  "env": {
    "ANTHROPIC_API_KEY": {
      "type": "secret_ref",
      "secretId": "{secretId}",
      "version": "latest"
    }
  }
}
\`\`\`

The server resolves and decrypts secret references at runtime.`,
      },
      {
        id: "api-scheduled-jobs",
        title: "Scheduled Jobs",
        content: `# Scheduled Jobs API

Manage cron-based automation jobs. Three job types: \`knowledge_sync\`, \`webhook\`, \`agent_run\`.

All endpoints require board authentication and company access.

## List Jobs

\`\`\`
GET /api/companies/{companyId}/scheduled-jobs
\`\`\`

Returns all scheduled jobs ordered by creation time.

## Get Job

\`\`\`
GET /api/companies/{companyId}/scheduled-jobs/{jobId}
\`\`\`

## Create Job

\`\`\`
POST /api/companies/{companyId}/scheduled-jobs
\`\`\`

**Body**

\`\`\`json
{
  "name": "Weekly knowledge sync",
  "description": "Optional description",
  "jobType": "knowledge_sync",
  "config": { "source_id": "brain-source-uuid" },
  "cronExpression": "0 9 * * 1",
  "timezone": "UTC",
  "scope": "company",
  "overlapPolicy": "skip",
  "missedRunPolicy": "skip",
  "retryMax": 0,
  "retryDelaySeconds": 300,
  "onFailureNotifyInApp": true
}
\`\`\`

**Config by job type**

\`knowledge_sync\`: \`{ "source_id": "uuid" }\`

\`webhook\`:
\`\`\`json
{
  "url": "https://example.com/hook",
  "method": "POST",
  "body": "{}",
  "auth_secret_id": "secret-uuid-or-null"
}
\`\`\`

\`agent_run\`:
\`\`\`json
{
  "agent_id": "agent-uuid",
  "task_title": "Weekly review",
  "task_description": "Analyse last week and post a summary."
}
\`\`\`

Returns \`201\` with \`{ "job": { ...job } }\`.

## Update Job

\`\`\`
PATCH /api/companies/{companyId}/scheduled-jobs/{jobId}
\`\`\`

Partial update. Changing \`cronExpression\` or \`timezone\` automatically recalculates \`nextRunAt\`.

## Delete Job

\`\`\`
DELETE /api/companies/{companyId}/scheduled-jobs/{jobId}
\`\`\`

Permanently deletes the job and all run history. Returns \`{ "ok": true }\`.

## Pause / Resume

\`\`\`
POST /api/companies/{companyId}/scheduled-jobs/{jobId}/pause
POST /api/companies/{companyId}/scheduled-jobs/{jobId}/resume
\`\`\`

## Run Now

\`\`\`
POST /api/companies/{companyId}/scheduled-jobs/{jobId}/run
\`\`\`

Fires the job immediately in the background. Returns instantly with \`{ "ok": true, "message": "Job triggered" }\`.

## List Run History

\`\`\`
GET /api/companies/{companyId}/scheduled-jobs/{jobId}/runs?limit=20
\`\`\`

Returns most recent runs, newest first. Max limit: 100.

**Run object fields**

| Field | Type | Description |
|-------|------|-------------|
| \`status\` | string | \`running\` / \`success\` / \`failed\` / \`timed_out\` / \`cancelled\` |
| \`attempt\` | number | 1 for first attempt, 2+ for retries |
| \`triggeredBy\` | string | \`scheduler\` / \`manual\` / \`retry\` |
| \`durationMs\` | number | Wall-clock execution time |
| \`output\` | string | Success output message |
| \`error\` | string | Error message if failed |
| \`heartbeatRunId\` | string | For agent_run jobs: linked heartbeat run |

## Scheduler Internals

- Loop interval: 60 seconds
- Claims jobs where \`enabled = true AND next_run_at <= NOW()\` using \`FOR UPDATE SKIP LOCKED\`
- After each run, \`nextRunAt\` is recalculated from the cron expression
- Run logs older than 90 days are purged automatically`,
      },
      {
        id: "api-brain-memory",
        title: "Brain Memory",
        content: `# Brain Memory API

## Remember (LLM extraction)
\`\`\`
POST /memory/remember
{
  "company_id": "optiflow",
  "user_id": "eslam",
  "content": "Lesson learned: always check Qdrant dimensions before migration",
  "scope": "company",
  "source": "api"
}
→ 200 { "ok": true, "result": { "results": [...], "relations": {...} } }
\`\`\`

## Raw Write (no LLM, embed only)
\`\`\`
POST /memory/raw
{ "company_id": "optiflow", "user_id": "eslam", "content": "..." }
→ 200 { "ok": true, "result": { "results": [{ "id": "uuid", "event": "RAW_ADD" }] } }
\`\`\`

## Batch Raw Write
\`\`\`
POST /memory/raw/batch
{ "company_id": "optiflow", "user_id": "eslam", "contents": ["fact 1", "fact 2"] }
→ 200 { "ok": true, "result": { "results": [...] }, "count": 2 }
\`\`\`

## Search
\`\`\`
POST /memory/search
{ "company_id": "optiflow", "user_id": "eslam", "query": "deployment lessons" }
→ 200 { "results": [{ "id": "...", "memory": "...", "score": 0.85, "metadata": {...} }], "relations": [...] }
\`\`\`

## Queue (batch ingestion)
\`\`\`
POST /memory/queue
{ "company_id": "optiflow", "user_id": "eslam", "content": "..." }
→ 200 { "ok": true }

POST /memory/queue/batch
{ "company_id": "optiflow", "user_id": "eslam", "contents": ["a", "b", "c"] }
→ 200 { "ok": true, "queued": 3, "total": 3 }

GET /memory/queue/status
→ 200 { "pending": 42 }
\`\`\`

## Other Endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| \`/memory/context\` | POST | Build formatted context for LLM injection |
| \`/memory/fact\` | POST | Store structured entity-attribute-value fact |
| \`/memory/feedback\` | POST | Thumbs up/down or correction on a memory |
| \`/memory/delete\` | POST | Delete a memory by ID |
| \`/memory/stats/{company}/{user}\` | GET | Memory statistics |
| \`/memory/all/{company}/{user}\` | GET | List all memories |
| \`/memory/company/{company}\` | GET | All memories for a company |
| \`/memory/consolidate\` | POST | Run dedup consolidation |`,
      },
      {
        id: "api-brain-tools",
        title: "Brain Tools",
        content: `# Brain Tools API

## Register Tool
\`\`\`
POST /tools/register
{
  "tool_id": "mcp__sanad-brain__recall",
  "name": "Recall Memory",
  "description": "Search memories for relevant context.",
  "category": "memory",
  "provider": "mcp",
  "schema_json": "{\\"properties\\": {\\"query\\": {\\"type\\": \\"string\\"}}}"
}
→ 200 { "ok": true, "result": { "action": "registered", "tool_id": "...", "point_id": "..." } }
\`\`\`

## Batch Register
\`\`\`
POST /tools/register/batch
{
  "tools": [
    { "tool_id": "t1", "name": "Tool 1", "description": "...", "category": "dev", "provider": "mcp" },
    { "tool_id": "t2", "name": "Tool 2", "description": "...", "category": "tasks", "provider": "mcp" }
  ]
}
→ 200 { "ok": true, "result": { "registered": 2 } }
\`\`\`

## Search Tools
\`\`\`
POST /tools/search
{ "query": "find old conversations", "limit": 10, "category": "memory" }
→ 200 { "tools": [{ "tool_id": "...", "name": "...", "score": 0.82, "schema_json": "..." }] }
\`\`\`

## List All Tools
\`\`\`
GET /tools/list?category=memory
→ 200 { "tools": [{ "tool_id": "...", "name": "...", "category": "...", "enabled": true }] }
\`\`\`

## Delete Tool
\`\`\`
DELETE /tools/{tool_id}
→ 200 { "ok": true }
\`\`\``,
      },
      {
        id: "api-brain-dream",
        title: "Brain Dream",
        content: `# Brain Dream API

## Trigger Dream Cycle
\`\`\`
POST /dream/trigger
{ "company_id": "optiflow", "dry_run": true }
→ 200 {
  "ok": true,
  "report": {
    "cycle_id": "uuid",
    "status": "completed",
    "total_memories": 333,
    "duplicates_removed": 5,
    "dates_normalized": 3,
    "pruned": 0,
    "phases": {
      "orient": { "total": 333, "by_type": {...}, "stale_candidates": 12 },
      "gather": { "new_writes": 45 },
      "consolidate": { "duplicates_removed": 5, "dates_normalized": 3 },
      "prune": { "pruned": 0, "over_limit": false }
    }
  }
}
\`\`\`

## Dream Status
\`\`\`
GET /dream/status/{company_id}
→ 200 {
  "company_id": "optiflow",
  "should_dream": true,
  "last_cycle": { "status": "completed", "completed_at": 1774394505.2, ... }
}
\`\`\`

## Dream History
\`\`\`
GET /dream/history/{company_id}?limit=10
→ 200 {
  "company_id": "optiflow",
  "cycles": [{ "cycle_id": "...", "status": "completed", "duplicates_removed": 5, "summary": "..." }]
}
\`\`\`

## Configuration
| Env Var | Default | Description |
|---------|---------|-------------|
| \`DREAM_MIN_INTERVAL_HOURS\` | 24 | Min hours between cycles |
| \`DREAM_MIN_WRITES\` | 5 | Min writes to trigger |
| \`MAX_MEMORY_ENTRIES\` | 200 | Memory cap per company |`,
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // 11. CLI
  // ─────────────────────────────────────────────────────────────
  {
    id: "cli",
    title: "CLI",
    icon: "Terminal",
    pages: [
      {
        id: "cli-overview",
        title: "Overview",
        content: `# CLI Overview

The Sanad AI CLI handles instance setup, diagnostics, and control-plane operations.

## Usage

\`\`\`sh
pnpm sanadai --help
\`\`\`

## Global Options

| Flag | Description |
|------|-------------|
| \`--data-dir <path>\` | Local data root (isolates from \`~/.paperclip\`) |
| \`--api-base <url>\` | API base URL |
| \`--api-key <token>\` | API authentication token |
| \`--context <path>\` | Context file path |
| \`--profile <name>\` | Context profile name |
| \`--json\` | Output as JSON |

Company-scoped commands also accept \`--company-id <id>\`.

## Context Profiles

Store defaults to avoid repeating flags:

\`\`\`sh
# Set defaults
pnpm sanadai context set --api-base http://localhost:3100 --company-id <id>

# View current context
pnpm sanadai context show

# List profiles
pnpm sanadai context list

# Switch profile
pnpm sanadai context use default
\`\`\`

Context is stored at \`~/.sanad/context.json\`.

## Command Categories

1. **Setup commands** — instance bootstrap, diagnostics, configuration
2. **Control-plane commands** — issues, agents, approvals, activity`,
      },
      {
        id: "cli-setup",
        title: "Setup Commands",
        content: `# Setup Commands

## \`sanadai run\`

One-command bootstrap and start:

\`\`\`sh
pnpm sanadai run
\`\`\`

1. Auto-onboards if config is missing
2. Runs \`sanadai doctor\` with repair enabled
3. Starts the server when checks pass

## \`sanadai onboard\`

Interactive first-time setup:

\`\`\`sh
pnpm sanadai onboard
\`\`\`

Options:
- \`--run\` — start immediately after onboarding
- \`--yes\` — non-interactive defaults + immediate start

## \`sanadai doctor\`

Health checks with optional auto-repair:

\`\`\`sh
pnpm sanadai doctor
pnpm sanadai doctor --repair
\`\`\`

Validates: server config, database connectivity, secrets adapter, storage config, missing key files.

## \`sanadai configure\`

\`\`\`sh
pnpm sanadai configure --section server
pnpm sanadai configure --section secrets
pnpm sanadai configure --section storage
\`\`\`

## \`sanadai env\`

Show resolved environment configuration.

## \`sanadai allowed-hostname\`

\`\`\`sh
pnpm sanadai allowed-hostname my-tailscale-host
\`\`\`

## Local Storage Paths

| Data | Default Path |
|------|-------------|
| Config | \`~/.sanad/instances/default/config.json\` |
| Database | \`~/.sanad/instances/default/db\` |
| Logs | \`~/.sanad/instances/default/logs\` |
| Storage | \`~/.sanad/instances/default/data/storage\` |
| Secrets key | \`~/.sanad/instances/default/secrets/master.key\` |`,
      },
      {
        id: "cli-control-plane",
        title: "Control Plane Commands",
        content: `# Control Plane Commands

## Issue Commands

\`\`\`sh
pnpm sanadai issue list [--status todo,in_progress] [--assignee-agent-id <id>]
pnpm sanadai issue get <issue-id>
pnpm sanadai issue create --title "..." [--description "..."] [--priority high]
pnpm sanadai issue update <issue-id> [--status in_progress] [--comment "..."]
pnpm sanadai issue comment <issue-id> --body "..."
pnpm sanadai issue checkout <issue-id> --agent-id <agent-id>
pnpm sanadai issue release <issue-id>
\`\`\`

## Company Commands

\`\`\`sh
pnpm sanadai company list
pnpm sanadai company get <company-id>
pnpm sanadai company export <company-id> --out ./exports/acme --include company,agents
pnpm sanadai company import --from ./exports/acme --target new --new-company-name "Acme"
\`\`\`

## Agent Commands

\`\`\`sh
pnpm sanadai agent list
pnpm sanadai agent get <agent-id>
\`\`\`

## Approval Commands

\`\`\`sh
pnpm sanadai approval list [--status pending]
pnpm sanadai approval get <approval-id>
pnpm sanadai approval approve <approval-id> [--decision-note "..."]
pnpm sanadai approval reject <approval-id> [--decision-note "..."]
pnpm sanadai approval request-revision <approval-id> [--decision-note "..."]
pnpm sanadai approval resubmit <approval-id> [--payload '{...}']
pnpm sanadai approval comment <approval-id> --body "..."
\`\`\`

## Activity & Dashboard

\`\`\`sh
pnpm sanadai activity list [--agent-id <id>] [--entity-type issue]
pnpm sanadai dashboard get
\`\`\`

## Heartbeat

\`\`\`sh
pnpm sanadai heartbeat run --agent-id <agent-id>
\`\`\``,
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // 12. CREW STRUCTURE (Custom Feature)
  // ─────────────────────────────────────────────────────────────
  {
    id: "crew-structure",
    title: "Crew Structure",
    icon: "Users",
    pages: [
      {
        id: "crew-overview",
        title: "Agent Hierarchy",
        content: `# Agent Crew Structure

Agents form a hierarchy with reporting lines, just like a real company.

\`\`\`mermaid
graph TD
    Board["Board (You)"] --> CEO
    CEO["CEO — Strategy, budgets"] --> TechLead["TechLead (CTO)"]
    CEO --> SalesManager["SalesManager"]
    CEO --> ProductManager["ProductManager"]
    CEO --> DevOps["DevOps"]
    TechLead --> BackendEng["BackendEngineer"]
    TechLead --> FrontendEng["FrontendEngineer"]
    SalesManager --> SalesRep["SalesRep"]
    ProductManager --> BetaTester["BetaTester (QA)"]
\`\`\`

## Task Routing

| Task Type | Route To |
|-----------|----------|
| Code / architecture / review | TechLead --> BackendEng or FrontendEng |
| Sales / leads / proposals | SalesManager --> SalesRep |
| Product / roadmap / beta | ProductManager --> BetaTester |
| Deploy / infra / monitoring | DevOps |
| Strategy / planning / hiring | CEO |
| Escalation from any agent | CEO --> Board (you) |

## Agent Files

Each agent has 4 files in \`/workspace/.agents/<role>/\`:

| File | Purpose |
|------|---------|
| **SOUL.md** | Personality, rules, capabilities, decision-making style |
| **HEARTBEAT.md** | Heartbeat protocol instructions (step-by-step wake procedure) |
| **SKILLS.md** | Available skills and tools the agent can use |
| **LESSONS.md** | Learned patterns from past work (updated after each session) |

## Agent Roles

| Role | Description |
|------|-------------|
| \`ceo\` | Top-level strategy, delegation, board communication |
| \`cto\` | Technical architecture, code standards, engineering decisions |
| \`cmo\` | Marketing strategy, brand, content |
| \`cfo\` | Financial planning, budget management |
| \`engineer\` | Implementation, coding, testing |
| \`designer\` | UI/UX design, visual assets |
| \`pm\` | Product management, roadmap, prioritization |
| \`qa\` | Quality assurance, testing, bug discovery |
| \`devops\` | Infrastructure, deployments, monitoring |
| \`researcher\` | Research, analysis, information gathering |
| \`general\` | Default role for unspecified agents |

## Board Authority

As the board operator, you have ultimate authority:

- CEO escalates to you: hiring >$50k, deals >$100k, product pivots
- You can override any agent decision
- You can pause, resume, or terminate any agent
- Weekly CEO report review
- Direct access to all skills (can do any agent's job if needed)

## Model Recommendations

| Agent Type | Recommended Model |
|------------|-------------------|
| Thinking agents (CEO, TechLead, Engineers, PM) | Claude Sonnet or Opus |
| Simple agents (DevOps, Sales, BetaTester) | Claude Haiku |
| Research-heavy agents | Claude Sonnet with higher turn limit |

## Budget Guidelines

| Agent | Recommended Monthly Budget |
|-------|---------------------------|
| CEO | $20-50 (higher, coordinates everything) |
| TechLead / CTO | $15-30 |
| Engineers (IC) | $10-20 |
| Sales / PM | $10-20 |
| QA / DevOps | $5-10 |

Per-task cost target: under $2. Monitor the dashboard for agents that consistently exceed this.`,
      },
    ],
  },
];

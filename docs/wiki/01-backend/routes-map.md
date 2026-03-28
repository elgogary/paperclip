# Routes Map

All REST API endpoints in `server/src/routes/`. Total: 47 files, ~13,800 LOC, ~150 endpoints.

## Authentication & Access

### access.ts (stub → 4 sub-routers)

**access-auth.ts** — Auth flows
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/auth/*` | BetterAuth handler |
| POST | `/api/auth/cli-challenge` | Create CLI auth challenge |
| GET/POST | `/api/auth/cli-challenge/:id` | Poll/approve challenge |
| POST | `/api/auth/board-api-key` | Create board API key |
| DELETE | `/api/board-api-key/:id` | Revoke board API key |

**access-invites.ts** — Invites & join requests
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/invites` | Create invite |
| GET | `/api/invites/:token` | Get invite details |
| POST | `/api/invites/:token/accept` | Accept invite |
| GET/POST | `/api/companies/:id/join-requests` | List/create join requests |
| PATCH/DELETE | `/api/join-requests/:id` | Approve/reject/delete |

**access-members.ts** — Members
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/companies/:id/members` | List members |
| POST | `/api/companies/:id/members` | Add member |
| PATCH/DELETE | `/api/members/:memberId` | Update/remove member |

## Agents

### agents.ts (stub → 3 sub-routers)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/companies/:companyId/agents` | List agents (ACL filtered) |
| GET | `/api/agents/me` | Agent's own profile |
| GET | `/api/agents/:id` | Agent detail |
| GET | `/api/companies/:companyId/org` | Org tree JSON |
| GET | `/api/companies/:companyId/org.svg` | Org chart SVG |

**agent-config.ts** — Agent CRUD
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/companies/:companyId/agents` | Create agent |
| PATCH | `/api/agents/:id` | Update agent config |
| GET/POST/DELETE | `/api/agents/:id/api-keys` | API key management |

**agent-lifecycle.ts** — Agent state
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/agents/:id/wakeup` | Wake agent |
| POST | `/api/agents/:id/pause` | Pause agent |
| POST | `/api/agents/:id/resume` | Resume agent |
| DELETE | `/api/agents/:id` | Terminate agent |

**agent-heartbeats.ts** — Runs
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/agents/:id/heartbeat` | Submit heartbeat |
| GET | `/api/agents/:id/runs` | List runs |
| GET | `/api/heartbeat-runs/:runId` | Run detail |

## Issues

### issues.ts (828 lines + 3 sub-routers)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/companies/:companyId/issues` | List issues (filters) |
| POST | `/api/companies/:companyId/issues` | Create issue |
| GET | `/api/issues/:id` | Issue detail |
| PATCH | `/api/issues/:id` | Update issue |
| DELETE | `/api/issues/:id` | Delete issue |
| POST | `/api/issues/:id/checkout` | Lock to agent |
| POST | `/api/issues/:id/release` | Release lock |
| GET/POST | `/api/issues/:id/approvals` | Approvals |

**issue-comments.ts** — Comments
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET/POST | `/api/issues/:id/comments` | List/add comments |
| PATCH/DELETE | `/api/issue-comments/:id` | Edit/delete comment |

**issue-attachments.ts** — Attachments
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/companies/:cid/issues/:id/attachments` | List |
| POST | `/api/companies/:cid/issues/:id/attachments` | Upload (chunked) |
| DELETE | `/api/attachments/:id` | Delete |

**issue-documents.ts** — Documents
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET/POST/PATCH | `/api/issues/:id/documents` | CRUD |

## Companies

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/companies` | List companies |
| POST | `/api/companies` | Create (admin only) |
| GET/PATCH | `/api/companies/:id` | Get/update |
| DELETE | `/api/companies/:id` | Delete |
| POST | `/api/companies/:id/export` | Export bundle |
| POST | `/api/companies/import` | Import bundle |

## Skills

**company-skills.ts** — Per-company skills
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET/POST | `/api/companies/:id/skills` | List/create |
| GET/PATCH/DELETE | `/api/companies/:id/skills/:skillId` | CRUD |
| POST | `/api/companies/:id/skills/:skillId/sync` | Sync from source |

**skills.ts** — Global skills
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET/POST/PATCH/DELETE | `/api/companies/:id/global-skills` | CRUD |

## Scheduled Jobs

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET/POST | `/api/companies/:id/scheduled-jobs` | List/create |
| GET/PATCH/DELETE | `/api/.../scheduled-jobs/:jobId` | CRUD |
| POST | `/api/.../scheduled-jobs/:jobId/run` | Manual trigger |
| POST | `/api/.../scheduled-jobs/:jobId/pause` | Pause |
| POST | `/api/.../scheduled-jobs/:jobId/resume` | Resume |
| GET | `/api/.../scheduled-jobs/:jobId/runs` | Run history |

## Swarm (Capability Marketplace)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET/POST | `/api/companies/:id/swarm/sources` | Sources CRUD |
| GET | `/api/companies/:id/swarm/capabilities` | Browse catalog |
| GET/POST | `/api/companies/:id/swarm/installs` | Install/list |
| POST | `/api/.../swarm/installs/:id/disable` | Disable |
| DELETE | `/api/.../swarm/installs/:id` | Remove |
| GET | `/api/companies/:id/swarm/audit` | Audit log |

## Sanad Brain (Proxy)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| ALL | `/api/brain/*path` | Reverse proxy to Brain API |

Allowed prefixes: `memory/`, `admin/`, `mcp/`, `knowledge/`, `health`, `metrics`

## Other Routes

| File | Endpoints |
|------|-----------|
| `routines.ts` | CRUD + triggers + run |
| `projects.ts` | CRUD + workspaces |
| `approvals.ts` | CRUD + resolve/reject |
| `costs.ts` | Budgets, costs, finance, quotas |
| `secrets.ts` | CRUD + rotate |
| `goals.ts` | CRUD |
| `execution-workspaces.ts` | CRUD + cleanup |
| `attachments.ts` | Chunked upload/download |
| `assets.ts` | Image upload (multer) |
| `dashboard.ts` | GET summary |
| `sidebar-badges.ts` | GET badge counts |
| `instance-settings.ts` | GET/PATCH general + experimental |
| `mcp-servers.ts` | CRUD + agent access |
| `connectors.ts` | CRUD |
| `plugins.ts` | CRUD + agent access |
| `public-chat.ts` | Session create/message/close (no auth) |
| `health.ts` | GET server status |
| `llms.ts` | List adapters + models |

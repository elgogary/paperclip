# Toolkit & Capabilities — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a `/toolkit` page to Paperclip with 4 sections — Skills, MCP Servers, Connectors, Plugins — allowing users to extend agent capabilities through reusable skills, external tool servers, OAuth integrations, and dynamic plugins.

**Architecture:** Each section follows the same pattern: Drizzle schema → SQL migration → service layer → Express routes → React page with card/list views and slide-out detail drawers. Company-scoped with per-agent access grants. Backend-first, then frontend.

**Tech Stack:** Drizzle ORM (PostgreSQL), Express routes, React + TanStack Query, shadcn/ui patterns, Tailwind CSS (oklch dark theme)

**Prototype:** `docs/prototypes/toolkit.html` (open at http://100.109.59.30:8901/toolkit.html)

---

## Phase 1: Database Schema (Migration)

### Task 1: Create Drizzle schema for `skills` table

**Files:**
- Create: `packages/db/src/schema/skills.ts`

**Step 1: Create the schema file**

```typescript
// packages/db/src/schema/skills.ts
import { pgTable, uuid, text, boolean, timestamp, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

export const skills = pgTable(
  "skills",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    icon: text("icon"),
    category: text("category"), // coding | research | communication | data | custom
    source: text("source").notNull().default("user"), // user | builtin | community
    instructions: text("instructions").notNull().default(""),
    triggerHint: text("trigger_hint"),
    invokedBy: text("invoked_by").notNull().default("user_or_agent"), // user | agent | user_or_agent
    enabled: boolean("enabled").notNull().default(true),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companySlugIdx: uniqueIndex("skills_company_slug_idx").on(table.companyId, table.slug),
    companyIdx: index("skills_company_idx").on(table.companyId),
  }),
);
```

**Step 2: Export from schema index**

Add to `packages/db/src/schema/index.ts`:
```typescript
export { skills } from "./skills.js";
export { skillAgentAccess } from "./skill_agent_access.js";
export { mcpServerConfigs } from "./mcp_server_configs.js";
export { mcpAgentAccess } from "./mcp_agent_access.js";
export { mcpCatalog } from "./mcp_catalog.js";
export { connectors } from "./connectors.js";
export { plugins } from "./plugins.js";
export { pluginAgentAccess } from "./plugin_agent_access.js";
```

### Task 2: Create Drizzle schema for `skill_agent_access` table

**Files:**
- Create: `packages/db/src/schema/skill_agent_access.ts`

```typescript
// packages/db/src/schema/skill_agent_access.ts
import { pgTable, uuid, boolean, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { skills } from "./skills.js";
import { agents } from "./agents.js";

export const skillAgentAccess = pgTable(
  "skill_agent_access",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    skillId: uuid("skill_id").notNull().references(() => skills.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
    granted: boolean("granted").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    skillAgentIdx: uniqueIndex("skill_agent_access_unique_idx").on(table.skillId, table.agentId),
  }),
);
```

### Task 3: Create Drizzle schema for `mcp_server_configs` table

**Files:**
- Create: `packages/db/src/schema/mcp_server_configs.ts`

```typescript
// packages/db/src/schema/mcp_server_configs.ts
import { pgTable, uuid, text, boolean, timestamp, jsonb, integer, uniqueIndex, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

export const mcpServerConfigs = pgTable(
  "mcp_server_configs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    direction: text("direction").notNull().default("outbound"), // outbound | inbound | both
    transport: text("transport").notNull().default("stdio"), // stdio | sse | streamable-http
    command: text("command"),
    args: jsonb("args").$type<string[]>().notNull().default([]),
    env: jsonb("env").$type<Record<string, string>>().notNull().default({}),
    url: text("url"),
    enabled: boolean("enabled").notNull().default(true),
    healthStatus: text("health_status").notNull().default("unknown"), // healthy | unhealthy | unknown
    lastHealthCheck: timestamp("last_health_check", { withTimezone: true }),
    catalogId: text("catalog_id"),
    configJson: jsonb("config_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companySlugIdx: uniqueIndex("mcp_server_configs_company_slug_idx").on(table.companyId, table.slug),
    companyIdx: index("mcp_server_configs_company_idx").on(table.companyId),
  }),
);
```

### Task 4: Create Drizzle schema for `mcp_agent_access` table

**Files:**
- Create: `packages/db/src/schema/mcp_agent_access.ts`

```typescript
// packages/db/src/schema/mcp_agent_access.ts
import { pgTable, uuid, boolean, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { mcpServerConfigs } from "./mcp_server_configs.js";
import { agents } from "./agents.js";

export const mcpAgentAccess = pgTable(
  "mcp_agent_access",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    mcpServerId: uuid("mcp_server_id").notNull().references(() => mcpServerConfigs.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
    granted: boolean("granted").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    mcpAgentIdx: uniqueIndex("mcp_agent_access_unique_idx").on(table.mcpServerId, table.agentId),
  }),
);
```

### Task 5: Create Drizzle schema for `mcp_catalog` table

**Files:**
- Create: `packages/db/src/schema/mcp_catalog.ts`

```typescript
// packages/db/src/schema/mcp_catalog.ts
import { pgTable, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";

export const mcpCatalog = pgTable("mcp_catalog", {
  id: text("id").primaryKey(), // e.g. "github", "slack"
  name: text("name").notNull(),
  description: text("description"),
  icon: text("icon"),
  category: text("category"), // dev-tools | communication | data | search | files | ai | infra
  npmPackage: text("npm_package"),
  transport: text("transport").notNull().default("stdio"),
  defaultCommand: text("default_command"),
  defaultArgs: jsonb("default_args").$type<string[]>().notNull().default([]),
  requiredEnv: jsonb("required_env").$type<Array<{ key: string; label: string; required: boolean }>>().notNull().default([]),
  docsUrl: text("docs_url"),
  popularity: integer("popularity").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

### Task 6: Create Drizzle schema for `connectors` table

**Files:**
- Create: `packages/db/src/schema/connectors.ts`

```typescript
// packages/db/src/schema/connectors.ts
import { pgTable, uuid, text, boolean, timestamp, jsonb, uniqueIndex, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

export const connectors = pgTable(
  "connectors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    provider: text("provider").notNull(), // gmail | google-calendar | google-sheets | slack-oauth | notion | jira
    status: text("status").notNull().default("pending"), // pending | connected | error | revoked
    oauthTokenEncrypted: text("oauth_token_encrypted"),
    oauthRefreshTokenEncrypted: text("oauth_refresh_token_encrypted"),
    oauthExpiresAt: timestamp("oauth_expires_at", { withTimezone: true }),
    scopes: jsonb("scopes").$type<string[]>().notNull().default([]),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    connectedBy: text("connected_by"),
    connectedAt: timestamp("connected_at", { withTimezone: true }),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyProviderIdx: uniqueIndex("connectors_company_provider_idx").on(table.companyId, table.provider),
    companyIdx: index("connectors_company_idx").on(table.companyId),
  }),
);
```

### Task 7: Create Drizzle schema for `plugins` and `plugin_agent_access` tables

**Files:**
- Create: `packages/db/src/schema/plugins.ts`
- Create: `packages/db/src/schema/plugin_agent_access.ts`

```typescript
// packages/db/src/schema/plugins.ts
import { pgTable, uuid, text, boolean, timestamp, jsonb, integer, uniqueIndex, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

export const plugins = pgTable(
  "plugins",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    icon: text("icon"),
    transport: text("transport").notNull().default("stdio"),
    command: text("command"),
    args: jsonb("args").$type<string[]>().notNull().default([]),
    env: jsonb("env").$type<Record<string, string>>().notNull().default({}),
    url: text("url"),
    toolCount: integer("tool_count").notNull().default(0),
    tools: jsonb("tools").$type<Array<{ name: string; description: string }>>().notNull().default([]),
    healthStatus: text("health_status").notNull().default("unknown"),
    lastHealthCheck: timestamp("last_health_check", { withTimezone: true }),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companySlugIdx: uniqueIndex("plugins_company_slug_idx").on(table.companyId, table.slug),
    companyIdx: index("plugins_company_idx").on(table.companyId),
  }),
);
```

```typescript
// packages/db/src/schema/plugin_agent_access.ts
import { pgTable, uuid, boolean, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { plugins } from "./plugins.js";
import { agents } from "./agents.js";

export const pluginAgentAccess = pgTable(
  "plugin_agent_access",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pluginId: uuid("plugin_id").notNull().references(() => plugins.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
    granted: boolean("granted").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pluginAgentIdx: uniqueIndex("plugin_agent_access_unique_idx").on(table.pluginId, table.agentId),
  }),
);
```

### Task 8: Generate and apply the SQL migration

**Step 1: Generate migration**

```bash
cd /home/eslam/data/projects/paperclip/packages/db
npx drizzle-kit generate --name toolkit_capabilities
```

This creates `src/migrations/0029_toolkit_capabilities.sql` (number will be next in sequence).

**Step 2: Review the generated SQL**

Verify it creates all 8 tables: `skills`, `skill_agent_access`, `mcp_server_configs`, `mcp_agent_access`, `mcp_catalog`, `connectors`, `plugins`, `plugin_agent_access`.

**Step 3: Apply migration**

```bash
cd /home/eslam/data/projects/paperclip
pnpm --filter @paperclipai/db run migrate
```

**Step 4: Commit**

```bash
git add packages/db/src/schema/ packages/db/src/migrations/
git commit -m "feat(db): add toolkit tables — skills, mcp servers, connectors, plugins"
```

---

## Phase 2: Backend Services

### Task 9: Skills service

**Files:**
- Create: `server/src/services/skills.ts`

Service follows the same pattern as `scheduled-jobs.ts`: function that takes `db: Db` and returns CRUD methods.

**Methods:**
- `list(companyId)` — list all skills for company
- `get(skillId)` — get single skill
- `create(input)` — create skill, auto-generate slug from name
- `update(skillId, input)` — update skill fields
- `remove(skillId)` — delete skill + cascades access
- `listAccess(skillId)` — list agent access grants for skill
- `updateAccess(skillId, agentId, granted)` — upsert agent access
- `bulkUpdateAccess(skillId, grants: {agentId, granted}[])` — batch update

**Step 1: Implement the service** (follow `scheduled-jobs.ts` pattern exactly)

**Step 2: Export from services index**

Add to `server/src/services/index.ts`:
```typescript
export { skillsService } from "./skills.js";
```

**Step 3: Commit**

```bash
git add server/src/services/skills.ts server/src/services/index.ts
git commit -m "feat(server): add skills service with CRUD + agent access"
```

### Task 10: MCP Servers service

**Files:**
- Create: `server/src/services/mcp-servers.ts`

**Methods:**
- `list(companyId)` — list all MCP servers
- `get(serverId)` — get single server
- `create(input)` — create server config
- `update(serverId, input)` — update config
- `remove(serverId)` — delete server + cascades
- `toggleEnabled(serverId, enabled)` — quick enable/disable
- `updateHealth(serverId, status)` — update health status + timestamp
- `listAccess(serverId)` — agent access
- `updateAccess(serverId, agentId, granted)` — upsert access
- `listCatalog()` — list MCP catalog entries
- `installFromCatalog(companyId, catalogId, env)` — create server from catalog template

**Step 1: Implement following same pattern**

**Step 2: Export from index**

**Step 3: Commit**

```bash
git add server/src/services/mcp-servers.ts server/src/services/index.ts
git commit -m "feat(server): add MCP servers service with CRUD, health, catalog"
```

### Task 11: Connectors service

**Files:**
- Create: `server/src/services/connectors.ts`

**Methods:**
- `list(companyId)` — list connectors
- `get(connectorId)` — get single
- `create(companyId, provider, metadata)` — create pending connector
- `updateStatus(connectorId, status, tokens?)` — update after OAuth
- `remove(connectorId)` — delete
- `disconnect(connectorId)` — set status to revoked, clear tokens

**Step 1: Implement**

**Step 2: Export, commit**

```bash
git add server/src/services/connectors.ts server/src/services/index.ts
git commit -m "feat(server): add connectors service for OAuth integrations"
```

### Task 12: Plugins service

**Files:**
- Create: `server/src/services/plugins.ts`

**Methods:**
- `list(companyId)` — list plugins
- `get(pluginId)` — get single
- `create(input)` — install plugin
- `update(pluginId, input)` — update config
- `remove(pluginId)` — uninstall
- `updateHealth(pluginId, status, tools?)` — update health + discovered tools
- `listAccess(pluginId)` — agent access
- `updateAccess(pluginId, agentId, granted)` — upsert access

**Step 1: Implement, export, commit**

```bash
git add server/src/services/plugins.ts server/src/services/index.ts
git commit -m "feat(server): add plugins service with CRUD + agent access"
```

---

## Phase 3: Backend Routes (API)

### Task 13: Skills API routes

**Files:**
- Create: `server/src/routes/skills.ts`

**Endpoints:**
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/companies/:companyId/skills` | List skills |
| POST | `/companies/:companyId/skills` | Create skill |
| GET | `/companies/:companyId/skills/:skillId` | Get skill |
| PATCH | `/companies/:companyId/skills/:skillId` | Update skill |
| DELETE | `/companies/:companyId/skills/:skillId` | Delete skill |
| GET | `/companies/:companyId/skills/:skillId/access` | List agent access |
| PUT | `/companies/:companyId/skills/:skillId/access` | Bulk update access |

Follow `scheduled-jobs.ts` route pattern: `assertBoard`, `assertCompanyAccess`, verify ownership.

**Step 1: Implement**

**Step 2: Register in `routes/index.ts`**

```typescript
export { skillRoutes } from "./skills.js";
```

**Step 3: Mount in `app.ts`** (find where other routes are mounted and add)

**Step 4: Commit**

```bash
git add server/src/routes/skills.ts server/src/routes/index.ts server/src/app.ts
git commit -m "feat(server): add skills API routes"
```

### Task 14: MCP Servers API routes

**Files:**
- Create: `server/src/routes/mcp-servers.ts`

**Endpoints:**
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/companies/:companyId/mcp-servers` | List servers |
| POST | `/companies/:companyId/mcp-servers` | Create server |
| GET | `/companies/:companyId/mcp-servers/:serverId` | Get server |
| PATCH | `/companies/:companyId/mcp-servers/:serverId` | Update server |
| DELETE | `/companies/:companyId/mcp-servers/:serverId` | Delete server |
| POST | `/companies/:companyId/mcp-servers/:serverId/test` | Test connection |
| POST | `/companies/:companyId/mcp-servers/:serverId/toggle` | Enable/disable |
| GET | `/companies/:companyId/mcp-servers/:serverId/access` | Agent access |
| PUT | `/companies/:companyId/mcp-servers/:serverId/access` | Update access |
| GET | `/companies/:companyId/mcp-catalog` | Browse catalog |
| POST | `/companies/:companyId/mcp-servers/install` | Install from catalog |

**Step 1–4: Same pattern as Task 13**

```bash
git add server/src/routes/mcp-servers.ts server/src/routes/index.ts server/src/app.ts
git commit -m "feat(server): add MCP servers API routes"
```

### Task 15: Connectors API routes

**Files:**
- Create: `server/src/routes/connectors.ts`

**Endpoints:**
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/companies/:companyId/connectors` | List |
| POST | `/companies/:companyId/connectors` | Create |
| POST | `/companies/:companyId/connectors/:id/disconnect` | Disconnect |
| DELETE | `/companies/:companyId/connectors/:id` | Remove |

```bash
git commit -m "feat(server): add connectors API routes"
```

### Task 16: Plugins API routes

**Files:**
- Create: `server/src/routes/plugins.ts`

**Endpoints:**
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/companies/:companyId/plugins` | List |
| POST | `/companies/:companyId/plugins` | Install |
| GET | `/companies/:companyId/plugins/:id` | Get |
| PATCH | `/companies/:companyId/plugins/:id` | Update |
| DELETE | `/companies/:companyId/plugins/:id` | Uninstall |
| POST | `/companies/:companyId/plugins/:id/test` | Test |
| GET | `/companies/:companyId/plugins/:id/access` | Agent access |
| PUT | `/companies/:companyId/plugins/:id/access` | Update access |

```bash
git commit -m "feat(server): add plugins API routes"
```

---

## Phase 4: Seed Data

### Task 17: Seed MCP catalog with curated servers

**Files:**
- Create: `packages/db/src/seed-mcp-catalog.ts`

Seed ~12 entries: GitHub, GitLab, Linear, Slack, Discord, PostgreSQL, MySQL, Brave Search, Google Drive, Filesystem, Puppeteer, Sentry.

Each entry has: id, name, description, icon, category, npmPackage, transport, defaultCommand, defaultArgs, requiredEnv, docsUrl.

```bash
git commit -m "feat(db): seed MCP catalog with 12 curated servers"
```

---

## Phase 5: Frontend — API Layer

### Task 18: Frontend API clients

**Files:**
- Create: `ui/src/api/skills.ts`
- Create: `ui/src/api/mcp-servers.ts`
- Create: `ui/src/api/connectors.ts`
- Create: `ui/src/api/plugins.ts`

Each file exports a typed API client object (same pattern as `ui/src/api/scheduled-jobs.ts`):

```typescript
// Example: ui/src/api/skills.ts
export const skillsApi = {
  list: (companyId: string) => fetchJson<{ skills: Skill[] }>(`/api/companies/${companyId}/skills`),
  get: (companyId: string, id: string) => fetchJson<{ skill: Skill }>(`/api/companies/${companyId}/skills/${id}`),
  create: (companyId: string, data: CreateSkillInput) => postJson(`/api/companies/${companyId}/skills`, data),
  update: (companyId: string, id: string, data: Partial<Skill>) => patchJson(`/api/companies/${companyId}/skills/${id}`, data),
  remove: (companyId: string, id: string) => deleteJson(`/api/companies/${companyId}/skills/${id}`),
  getAccess: (companyId: string, id: string) => fetchJson(`/api/companies/${companyId}/skills/${id}/access`),
  updateAccess: (companyId: string, id: string, grants: AgentGrant[]) => putJson(`/api/companies/${companyId}/skills/${id}/access`, { grants }),
};
```

```bash
git commit -m "feat(ui): add API clients for skills, mcp-servers, connectors, plugins"
```

---

## Phase 6: Frontend — Routing

### Task 19: Add `toolkit` route

**Files:**
- Modify: `ui/src/lib/company-routes.ts` — add `"toolkit"` to `BOARD_ROUTE_ROOTS`
- Modify: `ui/src/App.tsx` — import `Toolkit` page, add `<Route path="toolkit" element={<Toolkit />} />`
- Modify: Layout/sidebar component — add "Toolkit" nav item

```bash
git commit -m "feat(ui): add toolkit route and sidebar nav"
```

---

## Phase 7: Frontend — Toolkit Page

### Task 20: Create the Toolkit page shell

**Files:**
- Create: `ui/src/pages/Toolkit.tsx`

The page has:
- Inner sidebar with 4 nav items (Skills, MCP Servers, Connectors, Plugins)
- State to track which section is active
- Renders the active section component

```bash
git commit -m "feat(ui): add Toolkit page shell with 4-section nav"
```

### Task 21: Skills section component

**Files:**
- Create: `ui/src/components/toolkit/SkillsSection.tsx`
- Create: `ui/src/components/toolkit/SkillCard.tsx`
- Create: `ui/src/components/toolkit/SkillDetailDrawer.tsx`

Features: stats row, search + filter chips, card/list view toggle, skill cards with agent avatars, detail drawer with instructions editor + agent access chips.

```bash
git commit -m "feat(ui): add Skills section with cards, list view, detail drawer"
```

### Task 22: MCP Servers section component

**Files:**
- Create: `ui/src/components/toolkit/McpServersSection.tsx`
- Create: `ui/src/components/toolkit/McpServerCard.tsx`
- Create: `ui/src/components/toolkit/McpDetailDrawer.tsx`
- Create: `ui/src/components/toolkit/McpLogsDrawer.tsx`

Features: stats row (healthy/unhealthy/tools/agents), card/list toggle, health dots, configure drawer, logs drawer, test connection button.

```bash
git commit -m "feat(ui): add MCP Servers section with cards, health, logs drawer"
```

### Task 23: Connectors section component

**Files:**
- Create: `ui/src/components/toolkit/ConnectorsSection.tsx`

Features: stats (connected/pending), connector cards with Connect/Manage/Disconnect buttons, OAuth status indicators.

```bash
git commit -m "feat(ui): add Connectors section with OAuth cards"
```

### Task 24: Plugins section component

**Files:**
- Create: `ui/src/components/toolkit/PluginsSection.tsx`
- Create: `ui/src/components/toolkit/PluginDetailDrawer.tsx`

Features: stats, plugin cards with health dots and tool count, configure drawer with tools list + agent access.

```bash
git commit -m "feat(ui): add Plugins section with cards and detail drawer"
```

### Task 25: Browse modals (Skill Library + MCP Marketplace + Plugin Browse)

**Files:**
- Create: `ui/src/components/toolkit/SkillLibraryModal.tsx`
- Create: `ui/src/components/toolkit/McpMarketplaceModal.tsx`
- Create: `ui/src/components/toolkit/PluginBrowseModal.tsx`

Each modal: search, filter chips, grid of cards with Add/Install buttons.

```bash
git commit -m "feat(ui): add browse modals for skills, MCP marketplace, plugins"
```

---

## Phase 8: Integration & Polish

### Task 26: Wire MCP server test connection endpoint

**Files:**
- Modify: `server/src/routes/mcp-servers.ts` — implement the `/test` endpoint

The test endpoint spawns the MCP process (stdio) or pings the URL (sse/http), discovers tools, updates health status, returns result.

```bash
git commit -m "feat(server): implement MCP server test connection endpoint"
```

### Task 27: Sidebar badge counts

**Files:**
- Modify: `server/src/services/sidebar-badges.ts` — add toolkit counts
- Modify: UI sidebar — show counts next to Toolkit nav item

```bash
git commit -m "feat: add toolkit badge counts to sidebar"
```

### Task 28: Final commit — update docs

**Files:**
- Update: `docs/plans/2026-03-25-toolkit-capabilities.md` — mark phases complete

```bash
git commit -m "docs: mark toolkit implementation plan complete"
```

---

## Execution Order Summary

```
Phase 1: DB Schema (Tasks 1-8)        ~2-3 hours
Phase 2: Backend Services (Tasks 9-12) ~2-3 hours
Phase 3: Backend Routes (Tasks 13-16)  ~2 hours
Phase 4: Seed Data (Task 17)           ~30 min
Phase 5: Frontend API (Task 18)        ~1 hour
Phase 6: Frontend Routing (Task 19)    ~30 min
Phase 7: Frontend Pages (Tasks 20-25)  ~4-5 hours
Phase 8: Integration (Tasks 26-28)     ~2 hours
```

**Total: ~28 tasks across 8 phases**

Backend phases (1-4) can run independently from frontend (5-7). Phase 8 requires both.

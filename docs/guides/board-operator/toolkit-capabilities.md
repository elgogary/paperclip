# Toolkit & Capabilities

## Overview

The Toolkit page (`/toolkit`) lets you extend your agents' capabilities through 4 sections:

| Section | Purpose | How it works |
|---------|---------|-------------|
| **Skills** | Reusable instruction templates | Write markdown prompts, assign to agents — agents use them during runs |
| **MCP Servers** | External tool servers (MCP protocol) | Connect GitHub, Slack, PostgreSQL, etc. — agents call their tools |
| **Connectors** | OAuth integrations | One-click Google, Slack OAuth — no API keys needed |
| **Plugins** | Dynamic MCP plugins | Auto-discovered at runtime, extend agent tool capabilities |

## Getting Started

Navigate to **Toolkit** in the sidebar, or go to `/<company>/toolkit`.

## Skills

### What are Skills?

Skills are reusable instruction sets that give agents domain expertise. A skill has:
- **Name** — e.g., "code-review", "add-api-method"
- **Trigger** — when should agents auto-invoke this skill
- **Instructions** — the full prompt/template in markdown
- **Agent Access** — which agents can use it

### Creating a Skill

1. Click **+ New Skill** in the Skills section
2. Fill in name, description, category, trigger hint
3. Write instructions in the markdown editor
4. Assign access to agents via the agent chips
5. Click **Save**

### Skill Library

Browse pre-built skill templates:
- Click **Browse Library** to see available templates
- Click **Add** to copy a template into your skills
- Customize the instructions for your use case

### Categories

| Category | Use for |
|----------|---------|
| Coding | Code generation, review, debugging |
| Research | Web research, data gathering |
| Communication | Emails, memos, announcements |
| Data | ETL, analysis, transformation |
| Custom | Anything else |

## MCP Servers

### What are MCP Servers?

MCP (Model Context Protocol) servers provide tools that agents can call. Each server exposes a set of tools (like "create_issue", "search_repositories").

### Adding an MCP Server

**From Marketplace:**
1. Click **Marketplace** to browse curated servers
2. Click **Install** on a server
3. Fill in required environment variables (API keys)
4. Test the connection
5. Assign access to agents

**Custom Server:**
1. Click **+ Add Server**
2. Enter server name, transport (stdio/sse/http), command/URL
3. Add environment variables
4. Test and save

### Health Monitoring

Each server shows a health dot:
- Green = healthy (last check passed)
- Red = unhealthy (connection failed)
- Gray = unknown (never checked)

Click **Test** to run a health check.

### Logs

Click **Logs** on any server to see tool call history:
- Tool name, calling agent, timestamp
- Success/error status with duration
- Error details for failed calls

### Available Servers (Marketplace)

| Server | Category | Tools |
|--------|----------|-------|
| GitHub | Dev Tools | 12 (repos, issues, PRs, files) |
| GitLab | Dev Tools | 10 (repos, MRs, pipelines) |
| Slack | Communication | 8 (messages, channels, threads) |
| PostgreSQL | Data | 5 (queries, schemas) |
| Brave Search | Search | 2 (web search) |
| Filesystem | Files | 4 (read, write, search) |
| Google Drive | Files | 4 (browse, read, create) |
| Puppeteer | Dev Tools | 5 (navigate, screenshot, fill) |
| Sentry | Dev Tools | 4 (errors, releases) |
| Linear | Dev Tools | 6 (issues, projects, cycles) |
| Discord | Communication | 4 (messages, servers) |
| MySQL | Data | 3 (queries, schemas) |

## Connectors

### What are Connectors?

Connectors are OAuth-based integrations. Instead of API keys, you click **Connect** and authorize via the service's OAuth flow.

### Current Connectors

| Connector | Status |
|-----------|--------|
| Gmail | Available |
| Google Calendar | Available |
| Google Sheets | Available |
| Slack OAuth | Available |
| Notion | Coming soon |
| Jira | Coming soon |

## Plugins

### What are Plugins?

Plugins are dynamic MCP servers that are auto-discovered at runtime. They extend agent capabilities with specialized tools.

### Managing Plugins

- Enable/disable plugins with the toggle
- Click **Configure** to see tools and manage agent access
- Click **Test** to verify the plugin is responding
- Browse available plugins with **Browse Plugins**

## Agent Access

All 4 sections support per-agent access control:
- Click agent chips to grant/revoke access
- Green chip + checkmark = granted
- Gray chip = no access
- Changes take effect immediately for new agent runs

## API Reference

### Skills API

| Method | Endpoint |
|--------|----------|
| List | `GET /api/companies/:id/skills` |
| Create | `POST /api/companies/:id/skills` |
| Get | `GET /api/companies/:id/skills/:skillId` |
| Update | `PATCH /api/companies/:id/skills/:skillId` |
| Delete | `DELETE /api/companies/:id/skills/:skillId` |
| Get Access | `GET /api/companies/:id/skills/:skillId/access` |
| Update Access | `PUT /api/companies/:id/skills/:skillId/access` |

### MCP Servers API

| Method | Endpoint |
|--------|----------|
| List | `GET /api/companies/:id/mcp-servers` |
| Create | `POST /api/companies/:id/mcp-servers` |
| Get | `GET /api/companies/:id/mcp-servers/:serverId` |
| Update | `PATCH /api/companies/:id/mcp-servers/:serverId` |
| Delete | `DELETE /api/companies/:id/mcp-servers/:serverId` |
| Test | `POST /api/companies/:id/mcp-servers/:serverId/test` |
| Toggle | `POST /api/companies/:id/mcp-servers/:serverId/toggle` |
| Access | `GET/PUT /api/companies/:id/mcp-servers/:serverId/access` |
| Catalog | `GET /api/companies/:id/mcp-catalog` |
| Install | `POST /api/companies/:id/mcp-servers/install` |

### Connectors API

| Method | Endpoint |
|--------|----------|
| List | `GET /api/companies/:id/connectors` |
| Create | `POST /api/companies/:id/connectors` |
| Disconnect | `POST /api/companies/:id/connectors/:id/disconnect` |
| Delete | `DELETE /api/companies/:id/connectors/:id` |

### Plugins API

| Method | Endpoint |
|--------|----------|
| List | `GET /api/companies/:id/plugins` |
| Create | `POST /api/companies/:id/plugins` |
| Get | `GET /api/companies/:id/plugins/:pluginId` |
| Update | `PATCH /api/companies/:id/plugins/:pluginId` |
| Delete | `DELETE /api/companies/:id/plugins/:pluginId` |
| Test | `POST /api/companies/:id/plugins/:pluginId/test` |
| Access | `GET/PUT /api/companies/:id/plugins/:pluginId/access` |

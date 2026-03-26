# Agent Capabilities

You have access to the following tools, skills, and integrations. USE THEM.

## MCP Tools (Available via MCP protocol)

### Sanad Brain (Memory System)
Your persistent memory across sessions. **Always use these.**

| Tool | What it does | When to use |
|------|-------------|-------------|
| `recall` | Search memories by query | Start of every task — check what you already know |
| `remember` | Store a new memory | After completing work — save lessons, decisions, facts |
| `remember_fact` | Store a single fact | Quick fact storage: "FACT: X is Y" |
| `remember_raw` | Store raw text directly | Bulk text storage without LLM extraction |
| `forget` | Delete a memory | Remove outdated or wrong information |
| `build_context` | Get relevant context for a query | Before starting complex tasks |
| `memory_stats` | Check memory system health | Debugging, health checks |
| `feedback` | Rate if a recalled memory was useful | After using recalled info |
| `consolidate` | Trigger memory consolidation | Rarely — system does this automatically |

**Rules:**
- At task START: always `recall` relevant info before working
- At task END: always `remember` what you learned or decided
- Prefix memories with type: `LESSON:`, `FACT:`, `DECISION:`, `PATTERN:`, `EVENT:`

### Infisical (Secrets Management)
Access to encrypted secrets across projects.

| Tool | What it does |
|------|-------------|
| `list-projects` | List all Infisical projects |
| `list-secrets` | List secrets in a project/environment |
| `get-secret` | Get a specific secret value |
| `create-secret` | Create a new secret |
| `update-secret` | Update an existing secret |
| `delete-secret` | Delete a secret |

### Paperclip (Task Management)
Your primary coordination tool — already in your SOUL.md.

---

## Native Claude Code Tools (CRITICAL — read before ANY file or shell work)

You run inside Claude Code CLI. Most tools are **deferred** — they are NOT available until you load them.

### The Deferred-Tool Rule (MANDATORY)
Before calling ANY native tool, call `ToolSearch` first to load its schema:

```
Step 1 — ToolSearch(query="select:Write")    → loads Write schema
Step 2 — Write(file_path=..., content=...)   → now works
```

Skipping Step 1 causes: `InputValidationError: This tool's schema was not sent to the API`

### ToolSearch (always available — never needs loading)
```
ToolSearch(query="select:Write")             # exact name
ToolSearch(query="select:Write,Read,Bash")   # multiple at once
ToolSearch(query="file write create")        # keyword search
```

### Core Native Tools

| Tool | Purpose | Load before use? |
|------|---------|-----------------|
| `Write` | Create/overwrite a file | YES |
| `Read` | Read a file | YES |
| `Edit` | Edit part of a file (preferred over Write for edits) | YES |
| `Bash` | Run shell commands (Python scripts, curl, git) | YES |
| `Grep` | Search file contents by regex pattern | YES |
| `Glob` | Find files by name pattern (*.py, *.json) | YES |

### Correct patterns

**Create a file:**
```
1. ToolSearch(query="select:Write")
2. Write(file_path="/workspace/docs/report.md", content="...")
```

**Run a script:**
```
1. ToolSearch(query="select:Write,Bash")
2. Write(file_path="/tmp/gen.py", content="import zipfile...")
3. Bash(command="python3 /tmp/gen.py")
```

**Edit existing file:**
```
1. ToolSearch(query="select:Read,Edit")
2. Read(file_path="/workspace/file.py")   ← required before Edit
3. Edit(file_path=..., old_string=..., new_string=...)
```

### Rules
- Always use absolute paths (`/workspace/...`, not `./...`)
- Must `Read` a file before using `Edit` on it
- Never use Bash for file reading — use `Read` instead
- Load a tool once per session — no need to reload it

---

## Skills (119 available at /workspace/skills/)

You have 119 reusable skills. Before doing any task, check if a skill exists for it.

### How to use skills:
1. Check `/workspace/skills/` for relevant skill directories
2. Read the `SKILL.md` file inside the skill directory
3. Follow the skill's instructions exactly

### Key skills by role:

**All agents:**
- `clean-code` — Code quality checks
- `code-review` — Review code for issues
- `bug-fix` — Systematic bug investigation
- `create-test` — TDD, test-first development
- `security-review` — Security audit
- `web-research` — Structured web research
- `market-research` — Market analysis

**Engineering (TechLead, BackendEng, FrontendEng):**
- `create-prototype` — HTML prototype before implementation
- `implement-prototype` — Convert prototype to real code
- `research-architect` — Architecture research and design
- `create-doctype` — ERPNext DocType creation
- `create-controller` — Shared controller creation
- `create-client-script` — Client script creation
- `add-api-method` — API endpoint creation
- `erpnext-syntax-*` — ERPNext syntax reference (8 skills)
- `erpnext-impl-*` — ERPNext implementation guides (8 skills)
- `erpnext-errors-*` — ERPNext error handling (7 skills)

**Sales (SalesManager, SalesRep):**
- `scrape-leads` — Lead generation from web
- `gmaps-leads` — Google Maps lead scraping
- `classify-leads` — Lead classification
- `create-proposal` — Proposal generation
- `instantly-campaigns` — Cold email campaigns
- `humanizer` — Make text sound natural
- `casualize-names` — Casual name conversion

**Product (ProductManager, BetaTester):**
- `interview` — PRD interview skill
- `recommend-improvements` — App improvement analysis
- `ui-ux-ba` — UI/UX business analysis
- `project-audit-wiki` — Project documentation

**DevOps:**
- `press-provision` — Frappe Press server provisioning
- `sync-fork` — Fork synchronization
- `modal-deploy` — Modal cloud deployment

## Plugins (9 available)

| Plugin | Tools | Purpose |
|--------|-------|---------|
| context7 | 2 | Library documentation on demand |
| serena | 15+ | Semantic code navigation |
| superpowers | 14 | Workflow skills (brainstorm, plan, debug, TDD) |
| code-review | 1 | Unbiased code review |
| frontend-design | 1 | UI component generation |
| figma | 6 | Figma design access |
| github | 12 | GitHub repos, PRs, issues |
| playwright | 10 | Browser automation |
| stitch | 5+ | Design system management |

## Knowledge Base

All project docs, research, plans, and architecture references are indexed at:

**`/workspace/.agents/_common/PROJECT-KNOWLEDGE-INDEX.md`**

Read this index when you need context about:
- AccuBuild pricing, competitors, sales pipeline
- Project architecture (AccuBuild, Lipton)
- Strategic plans and roadmap
- Agent crew structure
- Market research and competitive analysis

---

## Mandatory Workflow

Every heartbeat:
1. **Recall** — `recall` relevant context from brain before working
2. **Check knowledge** — check `PROJECT-KNOWLEDGE-INDEX.md` for relevant docs, read them if needed
3. **Check skills** — is there a skill for this task? Use it.
4. **Do the work** — execute the task
5. **Remember** — `remember` what you learned, decided, or discovered
6. **Report** — post results as issue comment via Paperclip API

---
name: codegraph-visual
description: Use when user asks to visualize codebase structure, map module dependencies, generate code graph, create architecture diagram from code, or understand how modules connect. Triggers on "visualize codebase", "module dependencies", "code graph", "architecture map", "dependency graph".
---

# Codegraph Visual

Generate an interactive HTML dependency graph for any project. Combines Codegraph index + codebase analysis + ERPNext auto-detection.

## Graph Modes

**Ask the user which mode before starting:**

| Mode | When to use | ERPNext layer | DB scripts |
|------|-------------|---------------|------------|
| **App Graph** | Single custom app (default) | Auto if `hooks.py` found | No |
| **Site Graph** | Full site with all installed apps | Yes | Yes — exports Client/Server Scripts |
| **Generic** | Non-Frappe project (Django, Node, etc.) | No | No |

## Step 0 — Discovery (ALWAYS run first)

Before touching any code, run this self-interview. Answer each question, then report findings to user.

### 0a. Probe the project

Ask yourself and verify:
```
Q: What is this project?
→ Check: ls for hooks.py, setup.py, pyproject.toml, package.json, go.mod, Cargo.toml, pom.xml

Q: What framework?
→ hooks.py + doctype/ → Frappe/ERPNext app
→ manage.py + settings.py → Django
→ package.json + node_modules → Node.js
→ None of above → Generic

Q: What languages?
→ Count: find . -name "*.py" | wc -l, find . -name "*.js" | wc -l, etc.

Q: Is this part of a Frappe bench?
→ Check: ls ../../sites/ (two levels up from app = bench structure)
→ If yes: which site uses this app? → bench --site X list-apps

Q: Are there DB-stored scripts?
→ Only if bench accessible: bench --site X execute frappe.db.count --args '{"doctype":"Client Script"}'
→ bench --site X execute frappe.db.count --args '{"doctype":"Server Script"}'

Q: Are there external system connections?
→ Grep for: requests, supabase, boto3, google.cloud, pymongo, httpx, selenium
→ Check for .env, site_config.json, credentials files
```

### 0b. Check prerequisites

| Tool | Check command | If missing |
|------|---------------|------------|
| Codegraph | `which codegraph` | `npm install -g @colbymchenry/codegraph` |
| Node.js | `node --version` | Required — cannot proceed |
| Python 3 | `python3 --version` | Required — cannot proceed |
| bench CLI | `which bench` | Only needed for Site Graph mode |
| better-sqlite3 | bundled with Codegraph | Auto-available via NODE_PATH |

### 0c. Report to user

Output a discovery summary:
```
Project: <name>
Framework: Frappe/ERPNext | Django | Node | Generic
Languages: Python (431 files), JS (137 files)
Mode: App Graph | Site Graph | Generic
Prerequisites: [OK] Codegraph, [OK] Node, [OK] Python, [MISSING] bench
Data sources:
  [OK] Source code on disk (573 files)
  [OK] DocType JSONs (79 DocTypes with Link fields)
  [SKIP] DB scripts (no bench access — 0 Client Scripts, 0 Server Scripts)
  [FOUND] External systems: supabase, requests (in 12 files)
  [FOUND] hooks.py — scheduler_events, override_doctype_class
ERPNext layer: Will auto-add (hooks.py detected)
```

Then proceed with the detected mode. Do NOT ask the user to choose — auto-detect and go. Only ask if something is ambiguous or missing.

## Workflow

```
Step 0:      Discovery → detect stack, check tools, identify data sources
App Graph:   Init & Index → Extract → ERPNext Layer (auto) → Manual Layers → HTML → Serve
Site Graph:  list-apps → Export DB Scripts → Index All → Extract → ERPNext Layer → HTML → Serve
Generic:     Init & Index → Extract → HTML → Serve
```

### Step 1 — Init & Index

```bash
codegraph init /path/to/project
codegraph index /path/to/project
```

Config tuning (`.codegraph/config.json`): add `"**/.tmp/**"`, `"**/.bk/**"`, `"**/fixtures/**"` to exclude.

### Step 2 — Extract Graph from Codegraph DB

```bash
NODE_PATH=~/.npm-global/lib/node_modules/@colbymchenry/codegraph/node_modules \
  node ~/.claude/skills/codegraph-visual/extract_graph.js \
  /path/to/project/.codegraph/codegraph.db \
  --app-root <root_dir_name> --depth <1|2|3> \
  > /path/to/project/docs/codegraph-data.json
```

- `--app-root`: strip this prefix from file paths (e.g. `accubuild_core`)
- `--depth`: how deep to slice modules (1=multi-module apps, 2-3=flat apps)
- For **flat apps** (all code under one module), write a custom `getModule()` in a build script instead

### Step 3 — Add ERPNext Layer (AUTO for Frappe apps)

```bash
python3 ~/.claude/skills/codegraph-visual/add_erpnext_layer.py \
  /path/to/project/docs/codegraph-data.json \
  /path/to/project
```

This auto-scans all DocType JSONs for Link fields pointing to standard ERPNext/Frappe/HRMS DocTypes and adds virtual ERPNext module nodes + dependency links. Uses `erpnext_modules.json` (200+ DocTypes mapped to 15 modules).

**Always run this for Frappe/ERPNext apps. No manual work needed.**

### Step 4 — Add Manual Layers (optional)

For external systems (data lakes, APIs), edit `build_manual_deps.py` and run it:
```bash
python3 ~/.claude/skills/codegraph-visual/build_manual_deps.py /path/to/project/docs/codegraph-data.json
```

### Step 5 — Copy HTML & Serve

```bash
cp ~/.claude/skills/codegraph-visual/codegraph-visual.html /path/to/project/docs/
cd /path/to/project/docs && python3 -m http.server 8888
```

## Site Graph Mode (ROADMAP — not yet implemented)

For full-site visualization including DB-stored scripts:

```bash
# 1. Get installed apps for a specific site
bench --site <sitename> list-apps

# 2. Export Client Scripts + Server Scripts from DB to temp files
bench --site <sitename> execute frappe.get_all \
  --args '{"doctype":"Client Script","fields":["name","dt","script"]}'
bench --site <sitename> execute frappe.get_all \
  --args '{"doctype":"Server Script","fields":["name","reference_doctype","script"]}'

# 3. Index all installed apps together as one project
# 4. Map each Client/Server Script's `dt` field to the module owning that DocType
```

**Code that lives in the DB (invisible to Codegraph):**

| DB DocType | What it contains | How it connects |
|---|---|---|
| Client Script | `frappe.ui.form.on()` — field events, UI logic | `dt` field → target DocType |
| Server Script | Document Events, API endpoints, schedulers | `reference_doctype` → target DocType |
| Print Format (Jinja) | Templates with Python logic | `doc_type` → target DocType |
| Custom Field | Extra fields on any DocType | `dt` → target DocType |
| Property Setter | Field property overrides | `doc_type` → target DocType |
| Workflow | State transitions, conditions | `document_type` → target DocType |

**Key insight**: a bench has ALL apps but each site uses a subset. Must use `bench --site X list-apps` to get the right app list — never index the entire bench blindly.

## Skill Files

| File | Purpose |
|------|---------|
| `extract_graph.js` | Extract nodes/links/classes from Codegraph SQLite DB |
| `add_erpnext_layer.py` | Auto-detect ERPNext DocType Link deps (zero-config) |
| `erpnext_modules.json` | 200+ standard DocTypes mapped to 15 ERPNext/Frappe/HRMS modules |
| `build_manual_deps.py` | Template for adding external systems (data lakes, APIs) |
| `codegraph-visual.html` | Interactive D3.js visualization template |
| `setup-codegraph.sh` | Post-pull setup — rebuilds DB + graph data in one command |

## HTML Controls

- **Full Graph / Modules Only** — toggle class nodes visibility
- **Layer checkboxes** — codegraph, hooks, doctype_link, js_call, external
- **Hide Dep Arrows** — show only class clusters without connecting arrows
- **Compact / Normal / Spread** — adjust node spacing
- **Click module** — sidebar shows all deps with layer tags
- **Hover** — tooltip with classes, functions, in/out dependencies

## Output Files & .gitignore

Add these to the project's `.gitignore` during Step 0:

```gitignore
# Codegraph (DB is 16+ MB — regenerate with: codegraph index)
.codegraph/codegraph.db
# Keep .codegraph/config.json tracked (shared exclude/include rules for team)
codegraph-data.json   # Generated output — regenerate with extract_graph.js
```

| File | Commit to git? | Why |
|------|----------------|-----|
| `.codegraph/config.json` | Yes | Shared config — team uses same exclude/include rules |
| `.codegraph/codegraph.db` | No | 16+ MB, machine-specific, `codegraph index` regenerates |
| `codegraph-data.json` | No | Generated output, 400KB+, `extract_graph.js` regenerates |
| `codegraph-visual.html` | Yes | Static viewer, 24KB, opens in any browser |
| `docs/wiki/` copies | Yes | Part of project documentation |

## Lessons Learned

### Codegraph edges are function-level, not class-level
Classes don't directly connect in Codegraph. To derive class-to-class edges:
`ClassA contains MethodX` → `MethodX calls MethodY` → `ClassB contains MethodY` = `ClassA → ClassB`

### SVG marker scaling trap
SVG arrowhead markers scale with `stroke-width` by default — a 5px line makes a 10px marker appear as 50px. Fix: `markerUnits="userSpaceOnUse"` for fixed-size arrowheads.

### Flat apps need custom module mapping
Apps like Lipton have all code under `app_name/app_name/`. The `--depth` flag helps but for proper grouping, write a custom `getModule(file_path)` function that maps directories to logical modules.

### Broken links = invisible graph
D3 silently fails when links reference non-existent node IDs. **Always verify**: `nodeIdSet.has(source) && nodeIdSet.has(target)`.

### ERPNext is the missing glue
Custom app DocType modules appear as isolated islands without ERPNext. They connect through standard DocTypes (Customer, Employee, Item, etc.). Always run `add_erpnext_layer.py`.

### Contains links must be near-invisible
Module→class `contains` links should be 0.4px / 0.06 opacity. Otherwise they visually compete with dependency arrows.

### Stroke-width needs a cap
Heavy deps (160 calls) create massive bands. Cap at 5px: `Math.min(Math.max(1.5, Math.sqrt(weight) * 1.2), 5)`.

### Arrowhead scaling — use fixed-size markers
SVG markers with default `markerUnits="strokeWidth"` scale with line thickness — heavy links create giant triangles. Use `markerUnits="userSpaceOnUse"` with fixed `markerWidth/markerHeight` (14x10).

### Team workflow — don't commit the DB
`.codegraph/codegraph.db` is 16+ MB binary. Commit `.codegraph/config.json` (shared rules) and use `setup-codegraph.sh` post-pull to regenerate. Same pattern as `node_modules/`.

### Bench ≠ Site — site-aware indexing
A Frappe bench has ALL apps, but each site uses a subset. Use `bench --site X list-apps` to get the right app list. Wrong scope = wrong graph.

### DB-stored code is invisible to Codegraph
Client Scripts, Server Scripts, Print Formats, Workflows, Custom Fields live in the site DB. For Site Graph mode, export via `bench --site X execute frappe.get_all` then index alongside app code.

### Auto-detect ERPNext — don't ask
If `hooks.py` exists, it's a Frappe app. Always auto-run `add_erpnext_layer.py` — virtual ERPNext modules connect isolated DocType islands.

## Agent Access (Paperclip / Sanad AI)

Agents don't need the HTML viewer or the CLI. They need architecture context.

### 3-Layer Access Pattern

**Layer 1: Markdown summary (read first)**
After generating a graph, also generate a markdown architecture summary:
```bash
python3 generate_arch_summary.py codegraph-data.json > knowledge/resources/<app>-architecture.md
```
Place in the agent knowledge base (e.g. `/workspace/knowledge/resources/`).
Agents read this for quick module/dependency overview without parsing JSON.

**Layer 2: JSON data (deep detail)**
Agents can read `codegraph-data.json` directly for programmatic queries.
In Docker setups, ensure the data directory is mounted (e.g. `/data/erpnext-app-repos/`).

**Layer 3: Codegraph MCP (live queries)**
Run `codegraph serve --port 3333` on the host. Agents query via HTTP.
For Docker: use `http://host.docker.internal:3333` or the host IP.

### What goes where

| Asset | Location | Who uses it |
|-------|----------|-------------|
| `*-architecture.md` | `knowledge/resources/` | Agents (quick context) |
| `codegraph-data.json` | `<project>/docs/` | Agents (deep queries), HTML viewer |
| `codegraph-visual.html` | `<project>/docs/` | Humans only (browser) |
| `.codegraph/codegraph.db` | `<project>/.codegraph/` | Codegraph CLI/MCP only |

### Auto-generate architecture markdown
After running the full pipeline, always generate the markdown summary:
```python
# Reads codegraph-data.json, outputs markdown with:
# - Module table (files, classes, functions)
# - Cross-module dependencies with weights
# - ERPNext dependencies
# - Class-to-class references (top 20)
# - External systems
```

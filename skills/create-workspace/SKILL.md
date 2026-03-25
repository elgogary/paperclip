---
name: create-workspace
description: Create Frappe Workspaces with shortcuts, links, number cards, charts, icons, and fixtures for any ERPNext/Frappe project via config.md
argument-hint: "Workspace-name module icon mode fast deep"
---

## Input
Target: $ARGUMENTS

**Required**:
- **Workspace name**: Display label (e.g., "Sanad AI", "Accounting", "HR Module")
- **Module**: Frappe module that owns the workspace (e.g., "AI Core", "Accounts")

**Optional**:
- **mode**: "fast" (default) or "deep"
  - **fast**: Workspace JSON with shortcuts + link sections only
  - **deep**: Full workspace with Number Cards, Dashboard Charts, Quick Lists, and fixture files
- **icon**: Frappe icon name (see Icon Reference below). Default: "tool"
- **indicator_color**: green, cyan, blue, orange, yellow, gray, red, pink, darkgrey, purple, light-blue
- **sections**: Section names with doctypes (prompted if not given)
- **parent_page**: Parent workspace name for nested workspaces

**Fallback behavior**:
- Workspace name missing → Ask for name and purpose
- Module missing → Suggest based on project structure
- Icon missing → Default to "tool", show icon list
- Sections missing → Auto-detect from module doctypes

---

## Preflight Rules (HARD GATES)

### Gate 1 — Project Docs & Config Check (MANDATORY)
1) Read project documentation:
   - Check `CLAUDE.md`, `docs/`, `wiki/`, `README.md`
   - Read `config.md` if present (for project patterns)
2) Verify module directory exists in `modules.txt`
3) Check if workspace already exists:
   - Search for `workspace/` directories in all modules
   - If exists, ask: "Update existing or create new?"
4) Verify app name from `hooks.py` or `pyproject.toml`

### Gate 2 — Minimal Research Loop (MANDATORY)

**Fast Mode (1 pass)**:
- List all regular (non-child-table) doctypes in target module(s)
- Identify pages in target module(s)
- Group doctypes into logical sections

**Deep Mode (2 passes)**:
*Pass 1*: List all doctypes, pages, reports across relevant modules
*Pass 2*: Identify candidates for:
   - Number Cards (countable doctypes with useful status fields)
   - Dashboard Charts (doctypes with date fields + numeric aggregates)
   - Quick Lists (high-traffic doctypes users check frequently)

Stop after configured passes.

### Gate 3 — Clarifying Questions (MANDATORY)
Ask ONLY if critical:

**Fast Mode**:
- "Which doctypes should appear as top shortcuts?" (max 8)
- "How should doctypes be grouped into sections?"

**Deep Mode**:
- All fast mode questions, plus:
- "Which stats do you want as Number Cards?" (suggest based on scanned fields)
- Charts — DO NOT ask "what charts do you want?" Instead:
  1. Scan doctype fields first (see Chart Discovery section)
  2. Present business questions: "How many X per week?", "What's the breakdown by Y?"
  3. Let user pick which questions matter — YOU map to chart configs
- "Is this workspace for daily monitoring, weekly review, or monthly reporting?" (sets chart timespan)
- "Quick Lists — which of these do you want to preview inline?" (suggest high-activity doctypes)
- "Role-based access restrictions?"

**Default assumptions**:
- Public workspace (visible to all roles)
- No parent page (top-level workspace)
- sequence_id = 10.0
- No Quick Lists (fast mode)
- No Charts (fast mode)

### Gate 4 — Implementation Plan (MANDATORY)
Before creating files, output:

**Fast Mode**:
```
Scope: Create [Workspace] in [module]
Files to Create:
- [module]/workspace/[name]/[name].json

Shortcuts: [list with types]
Sections: [section names with doctype counts]
Icon: [icon name]
```

**Deep Mode**:
```
Scope: Create [Workspace] in [module] with fixtures
Files to Create:
- [module]/workspace/[name]/[name].json
- fixtures/number_card.json (or merge into existing)
- fixtures/dashboard_chart.json (or merge into existing)

Shortcuts: [list with types]
Sections: [section names with doctype counts]
Number Cards: [list with functions]
Charts: [list with types]
Quick Lists: [list]
Icon: [icon name]

hooks.py Changes:
- Add Number Card to fixtures
- Add Dashboard Chart to fixtures
- Add Workspace to fixtures
```

Then ask approval.

---

## Rules (Engineering Standards)

### Workspace File Location
```
<app>/<module>/workspace/<workspace_name>/<workspace_name>.json
```
Example: `sanad_business_intelligence_ai/ai_core/workspace/sanad_ai/sanad_ai.json`

The workspace JSON is a **full document dict** — not wrapped in a fixtures array. Frappe reads it on `bench migrate` and upserts into the database.

### Parent/Child Workspace Hierarchy

Workspaces can be nested using the `parent_page` field. This creates a collapsible tree in Frappe's sidebar.

**How it works:**
- Set `parent_page` to the **exact `label`** of the parent workspace (not the route slug)
- The child workspace appears indented under the parent in the sidebar
- Clicking the parent expands/collapses children
- Each child is a fully independent workspace JSON file — it just declares its parent
- Multiple nesting levels are supported (grandchild workspaces)

**Sidebar structure example:**
```
▼ Sanad AI              ← parent (parent_page: "")
    Agents              ← child  (parent_page: "Sanad AI")
    Conversations       ← child  (parent_page: "Sanad AI")
    Infrastructure      ← child  (parent_page: "Sanad AI")
      MCP Servers       ← grandchild (parent_page: "Infrastructure")
```

**File structure — each workspace is a separate JSON file:**
```
ai_core/workspace/
  sanad_ai/sanad_ai.json                    ← parent
  sanad_ai_agents/sanad_ai_agents.json      ← child
  sanad_ai_conversations/sanad_ai_conversations.json  ← child
  sanad_ai_infra/sanad_ai_infra.json        ← child
```

**Parent workspace JSON** (top-level, no `parent_page`):
```json
{
  "label": "Sanad AI",
  "parent_page": "",
  "sequence_id": 10.0
}
```

**Child workspace JSON** (nested under parent):
```json
{
  "label": "Agents",
  "parent_page": "Sanad AI",
  "sequence_id": 11.0
}
```

**`sequence_id` convention** (from Frappe core):
Frappe uses **independent integers** for sidebar ordering — lower values appear higher. There is no parent/child decimal nesting.

Real values from Frappe/ERPNext core workspaces:
- Home = 1.0, Accounting = 2.0, Stock = 7.0, Build = 27.0

For child workspaces, assign sequential integers after the parent:
- Parent: `sequence_id: 10.0`
- Child 1: `sequence_id: 11.0`
- Child 2: `sequence_id: 12.0`
- Child 3: `sequence_id: 13.0`

Or use higher ranges if other workspaces exist in between.

**Rules:**
- `parent_page` is a `Data` field (plain string, not a Link) — must match the parent's `label` exactly (case-sensitive)
- `sequence_id` is a `Float` field — controls sidebar ordering globally, not scoped to parent
- Both fields are `read_only: 1` in the doctype — they're set programmatically, not via form
- Parent and child can be in different modules — `parent_page` is resolved by label, not file path
- If the parent workspace is deleted/renamed, children become orphaned (appear as top-level)
- Each child workspace has its own independent shortcuts, links, number cards, charts
- Parent workspaces can have their own content too — they don't have to be just containers

**When to use child workspaces vs one flat workspace:**

| Approach | When |
|---|---|
| **Single workspace** | < 30 doctypes, single module, simple app |
| **Parent + children** | 30+ doctypes, multiple modules, distinct user workflows (admin vs operator) |
| **One per module** | Large app where each module is independent (billing team doesn't need security) |

**Decision tree:**
```
How many doctypes?
  < 15 → Single workspace, no children
  15-30 → Single workspace with well-organized sections
  30+ → Consider parent + children split

Multiple distinct user roles?
  Yes → Split by role: "Admin", "Operators", "Analysts" as children
  No → Keep flat

Multiple modules with independent workflows?
  Yes → One child workspace per module under a parent
  No → Keep flat with section cards
```

### Workspace JSON — Top-Level Fields

| Field | Type | Required | Notes |
|---|---|---|---|
| `doctype` | String | Yes | Always `"Workspace"` |
| `label` | String | Yes | Unique name, autoname source |
| `title` | String | Yes | Display title (usually same as label) |
| `module` | String | Yes | Must match `modules.txt` entry exactly |
| `icon` | String | No | Icon name from built-in set (see reference) |
| `indicator_color` | String | No | green, cyan, blue, orange, yellow, gray, red, pink, darkgrey, purple, light-blue |
| `public` | Int | Yes | 1 for visible to all, 0 for private |
| `is_hidden` | Int | No | Default 0 |
| `hide_custom` | Int | No | Default 0 |
| `for_user` | String | No | Empty for public workspaces |
| `parent_page` | Data | No | Parent workspace label for nesting (plain string, not Link — matched by label) |
| `sequence_id` | Float | No | Controls sidebar order globally (lower = higher in sidebar). Default 10.0. Frappe core uses integers: Home=1, Accounting=2, Stock=7, Build=27 |
| `restrict_to_domain` | String | No | Link to Domain doctype |
| `content` | String | Yes | JSON-encoded array of layout blocks |
| `shortcuts` | Array | No | Workspace Shortcut child rows |
| `links` | Array | No | Workspace Link child rows |
| `charts` | Array | No | Workspace Chart child rows |
| `number_cards` | Array | No | Workspace Number Card child rows |
| `quick_lists` | Array | No | Workspace Quick List child rows |
| `custom_blocks` | Array | No | Workspace Custom Block child rows |
| `roles` | Array | No | Has Role child rows for access control |

### Content Blocks — Layout System

The `content` field is a **JSON-encoded string** (stringified array). Each block has:
```json
{"id": "<random-10-char>", "type": "<block_type>", "data": {<type_specific>}}
```

**Block types** (10 types, verified from `frappe/public/js/frappe/views/workspace/blocks/index.js`):

**UI label → JSON type mapping** (the workspace editor shows different labels than the JSON `type` values):
| Editor UI Label | JSON `type` value |
|---|---|
| Heading | `header` |
| Text | `paragraph` |
| Card | `card` |
| Chart | `chart` |
| Shortcut | `shortcut` |
| Spacer | `spacer` |
| Onboarding | `onboarding` |
| Quick List | `quick_list` |
| Number Card | `number_card` |
| *(Custom Blocks tab)* | `custom_block` |

| Type | Data Fields | Typical `col` | Description |
|---|---|---|---|
| `header` | `text` (HTML), `level` (1-6) | 12 | Section heading (h1-h6). Use `<b>Title</b>` in text. Level via `header_size` tune. |
| `paragraph` | `text` (HTML) | 12 | Rich text block. Supports `<b>`, `<i>`, `<a>`, `<span>`, `<br>`. Use for descriptions, notes, instructions between sections. |
| `spacer` | (none) | 12 | Empty vertical space between sections. |
| `shortcut` | `shortcut_name` (matches shortcut `label`) | 3 or 4 | Quick-access tile. Must have matching entry in `shortcuts` array. |
| `card` | `card_name` (matches Card Break `label`) | 4 or 6 | Link group card. Must have matching Card Break in `links` array. |
| `number_card` | `number_card_name` (matches Number Card name) | 4 or 6 | Stat card showing count/sum/avg. Must have matching entry in `number_cards` array + Number Card fixture. |
| `chart` | `chart_name` (matches Dashboard Chart name) | 6 or 12 | Visual chart. Must have matching entry in `charts` array + Dashboard Chart fixture. |
| `quick_list` | `quick_list_name` (matches doctype name) | 4 or 6 | Inline filtered list of recent records from a doctype. Must have matching entry in `quick_lists` array. |
| `onboarding` | `onboarding_name` | 12 | Guided setup wizard. References a **Module Onboarding** doctype record. Data is fetched from page config at load time. Hidden on mobile. |
| `custom_block` | `custom_block_name` | 4, 6, or 12 | Custom HTML/JS/CSS widget. References a **Custom HTML Block** doctype record (via `Workspace Custom Block` child table link). |

**Column grid**: 12-column system. 12=full, 6=half, 4=third, 3=quarter.

**ID generation**: Random 10-char alphanumeric string, unique within the workspace.

**Paragraph vs Header**: `header` renders as `<h1>`-`<h6>` headings. `paragraph` renders as a `<div>` with rich text — use it for descriptive text, instructions, or notes between sections.

**Onboarding block — full doctype chain** (4 doctypes, all in Desk module):

```
Workspace content block        →  onboarding_name = "My Module Setup"
  ↓
Module Onboarding              →  standalone doctype, autonamed by title
  ├── title                    →  Display name (reqd)
  ├── subtitle                 →  Secondary text
  ├── module                   →  Link to Module Def (reqd)
  ├── success_message          →  Shown when all steps complete
  ├── documentation_url        →  Link to docs
  ├── is_complete              →  Check (read-only, auto-set)
  ├── steps                    →  Table → Onboarding Step Map
  └── allow_roles              →  Table MultiSelect → Onboarding Permission
                                   (System Manager allowed by default)
  ↓
Onboarding Step Map            →  child table (1 field)
  └── step                     →  Link to Onboarding Step
  ↓
Onboarding Step                →  standalone doctype, autonamed by title
  ├── title                    →  Step name (reqd)
  ├── description              →  Markdown editor
  ├── intro_video_url          →  Optional video
  ├── action                   →  Select: Create Entry | Update Settings |
  │                                Show Form Tour | View Report |
  │                                Go to Page | Watch Video
  ├── action_label             →  Button text
  ├── reference_document       →  Link to DocType (for Create Entry / Update Settings / Show Form Tour)
  ├── show_full_form           →  Check (Create Entry only)
  ├── show_form_tour / form_tour → Link to Form Tour doctype
  ├── reference_report         →  Link to Report (for View Report)
  ├── path                     →  URL path (for Go to Page)
  ├── video_url                →  URL (for Watch Video)
  ├── validate_action          →  Check (Update Settings only)
  ├── field / value_to_validate → Validate a setting was changed
  ├── callback_title / callback_message → Post-action feedback
  ├── is_complete              →  Check (auto-set per user)
  └── is_skipped               →  Check (user can skip)
  ↓
Onboarding Permission          →  child table (1 field)
  └── role                     →  Link to Role (reqd)
```

To use onboarding in a workspace:
1. Create **Onboarding Step** records (one per step)
2. Create a **Module Onboarding** record, add steps via Onboarding Step Map child table, set allowed roles
3. Add `onboarding` content block with `onboarding_name` matching the Module Onboarding title
4. Hidden on mobile. System Managers see it by default.

**Custom Block — full doctype chain** (2 doctypes):

```
Workspace content block        →  custom_block_name = "My Widget"
  ↓
Workspace Custom Block         →  child table in workspace
  └── custom_block_name        →  Link to Custom HTML Block
  └── label                    →  Display label
  ↓
Custom HTML Block              →  standalone doctype (Desk module)
  ├── html                     →  Code (HTML) — the markup
  ├── script                   →  Code (JS) — use `root_element` as scoped parent
  ├── style                    →  Code (CSS)
  ├── private                  →  Check (read-only)
  └── roles                    →  Table → Has Role (access control)
```

To use custom blocks in a workspace:
1. Create a **Custom HTML Block** record with HTML/JS/CSS
2. Add a row to the workspace's `custom_blocks` array with `custom_block_name` linking to it
3. Add a `custom_block` content block with matching `custom_block_name`

### Shortcuts Child Table (Workspace Shortcut)

| Field | Type | Values |
|---|---|---|
| `type` | Select | `DocType`, `Report`, `Page`, `Dashboard`, `URL` |
| `label` | Data | Display name (reqd) |
| `link_to` | Dynamic Link | Target (DocType name, Page name, etc.) |
| `url` | Data | Only if type=URL |
| `doc_view` | Select | `List`, `Report Builder`, `Dashboard`, `Tree`, `New`, `Calendar`, `Kanban` (DocType only) |
| `color` | Color | Hex color or name |
| `format` | Data | e.g. `"{} Open"` for count display |
| `stats_filter` | Code (JSON) | Count filter for badge display |
| `icon` | Data | Icon name (developer_mode only) |

### Links Child Table (Workspace Link)

Two row types — **Card Break** (section header) and **Link** (item under a card).
A Card Break groups the Link rows that follow it until the next Card Break.

**Card Break row** (section header):
| Field | Type | Required | Notes |
|---|---|---|---|
| `type` | Select | Yes | `"Card Break"` |
| `label` | Data | Yes | Card title (matches `card_name` in content block) |
| `icon` | Data | No | Icon name for section header |
| `description` | HTML Editor | No | Card description (XSS filter disabled, max 7rem) |
| `hidden` | Check | No | 0 or 1, hide entire section |
| `link_count` | Int | No | Number of Link rows in this section (auto-managed, hidden field) |

**Link row** (item under a card):
| Field | Type | Required | Notes |
|---|---|---|---|
| `type` | Select | Yes | `"Link"` |
| `label` | Data | Yes | Display name |
| `link_type` | Select | Yes | `"DocType"`, `"Page"`, or `"Report"` |
| `link_to` | Dynamic Link | Yes | Target name (linked via `link_type`) |
| `onboard` | Check | No | 1 to highlight as onboarding item |
| `is_query_report` | Check | No | 1 if link_type=Report and it's a Script/Query report |
| `report_ref_doctype` | Link | No | Reference DocType for reports (read-only, auto-set) |
| `dependencies` | Data | No | Comma-separated module dependencies |
| `only_for` | Link | No | Country filter (Link to Country doctype) |

**How Card + Links connect** — full example:

```json
{
  "content": "[..., {\"id\":\"abc1234567\",\"type\":\"card\",\"data\":{\"card_name\":\"Accounting\",\"col\":4}}]",

  "links": [
    {
      "type": "Card Break",
      "label": "Accounting",
      "icon": "accounting",
      "description": "Core accounting doctypes",
      "hidden": 0,
      "link_count": 4
    },
    {
      "type": "Link",
      "label": "Chart of Accounts",
      "link_type": "DocType",
      "link_to": "Account",
      "onboard": 0,
      "is_query_report": 0
    },
    {
      "type": "Link",
      "label": "Company",
      "link_type": "DocType",
      "link_to": "Company",
      "onboard": 0,
      "is_query_report": 0
    },
    {
      "type": "Link",
      "label": "Customer",
      "link_type": "DocType",
      "link_to": "Customer",
      "onboard": 0,
      "is_query_report": 0
    },
    {
      "type": "Link",
      "label": "Supplier",
      "link_type": "DocType",
      "link_to": "Supplier",
      "onboard": 0,
      "is_query_report": 0
    }
  ]
}
```

The `card_name` in the content block **must match** the Card Break's `label` exactly.
The `link_count` should equal the number of Link rows between this Card Break and the next.

### Real-World Reference — ERPNext Accounting Workspace

Patterns observed from the production ERPNext `Accounting` workspace (v15):

**Content layout order** (top to bottom):
```
onboarding (col:12)          ← "Accounts" Module Onboarding
chart (col:12)               ← "Profit and Loss" full-width chart
number_card x4 (col:3 each)  ← 4 stats in a row (quarter width)
spacer (col:12)
header (col:12)              ← "<span class=\"h4\"><b>Shortcuts</b></span>"
shortcut x10 (col:3 each)   ← 10 shortcuts in rows of 4
spacer (col:12)
header (col:12)              ← "<span class=\"h4\"><b>Reports &amp; Masters</b></span>"
card x9 (col:4 each)        ← 9 card sections in rows of 3
```

**Header text pattern**: Always wrapped in `<span class=\"h4\"><b>Title</b></span>`, not plain text.

**Shortcut types used** (all 4 types in one workspace):
```json
{"type": "DocType", "link_to": "Sales Invoice", "label": "Sales Invoice"}
{"type": "Report", "link_to": "General Ledger", "label": "General Ledger"}
{"type": "Dashboard", "link_to": "Accounts", "label": "Dashboard"}
{"type": "URL", "url": "https://school.frappe.io/...", "label": "Learn Accounting", "color": "Grey"}
```

**Card Break — some have `link_type: "DocType"` set** (Frappe artifact, not required but present):
```json
{"type": "Card Break", "label": "Banking", "link_type": "DocType", "link_count": 6}
```

**Link with `only_for` country filter**:
```json
{"type": "Link", "label": "Lower Deduction Certificate", "link_type": "DocType",
 "link_to": "Lower Deduction Certificate", "only_for": "India"}
```

**Link with `onboard: 1`** (highlighted for onboarding):
```json
{"type": "Link", "label": "Company", "link_type": "DocType", "link_to": "Company", "onboard": 1}
```

**Link with `dependencies` and `is_query_report`** (Script/Query reports):
```json
{"type": "Link", "label": "Budget Variance Report", "link_type": "Report",
 "link_to": "Budget Variance Report", "dependencies": "Cost Center", "is_query_report": 1}
```

**Number cards child table** — each row has `number_card_name` + `label`:
```json
{"number_card_name": "Total Outgoing Bills", "label": "Total Outgoing Bills"}
```

**Charts child table** — each row has `chart_name` + `label`:
```json
{"chart_name": "Profit and Loss", "label": "Profit and Loss"}
```

**Child table rows include full Frappe metadata** (auto-generated, not manually set):
`name`, `owner`, `creation`, `modified`, `modified_by`, `docstatus`, `idx`, `parent`, `parentfield`, `parenttype`, `doctype`
— When generating workspace JSON, you can **omit** these fields. Frappe populates them on migrate.

**Key takeaways for workspace generation:**
1. Header text uses `<span class=\"h4\"><b>...</b></span>` — not plain text
2. Use `col:3` for number cards and shortcuts (4 per row), `col:4` for cards (3 per row)
3. Always add `spacer` between major sections (shortcuts, cards)
4. Card Break `link_count` matches the actual number of Link rows that follow
5. `only_for` enables country-specific links without hiding the whole card
6. `onboard: 1` on Link rows highlights items for first-time setup
7. Child table metadata fields are auto-generated — only set the semantic fields

### Number Card Doctype — Fixture Schema

```json
{
  "doctype": "Number Card",
  "name": "Unique Card Name",
  "label": "Display Label",
  "type": "Document Type",
  "document_type": "Target DocType",
  "function": "Count|Sum|Average|Minimum|Maximum",
  "aggregate_function_based_on": "field_name (for Sum/Avg/Min/Max)",
  "filters_json": "[[\"DocType\",\"field\",\"=\",\"value\"]]",
  "dynamic_filters_json": "[]",
  "is_public": 1,
  "is_standard": 1,
  "module": "Module Name",
  "show_percentage_stats": 1,
  "stats_time_interval": "Daily|Weekly|Monthly|Yearly",
  "color": "#hex or null",
  "show_full_number": 0
}
```

For **Report-based** cards: set `type: "Report"`, `report_name`, `report_field`, `report_function`.
For **Custom method** cards: set `type: "Custom"`, `method: "dotted.python.path"`.

### Dashboard Chart Doctype — Fixture Schema

```json
{
  "doctype": "Dashboard Chart",
  "name": "Unique Chart Name",
  "chart_name": "Unique Chart Name",
  "chart_type": "Count|Sum|Average|Group By|Custom|Report",
  "type": "Line|Bar|Percentage|Pie|Donut|Heatmap",
  "document_type": "Target DocType",
  "based_on": "date_field (for timeseries)",
  "value_based_on": "numeric_field (for Sum/Avg)",
  "timeseries": 1,
  "timespan": "Last Year|Last Quarter|Last Month|Last Week|Select Date Range",
  "time_interval": "Yearly|Quarterly|Monthly|Weekly|Daily",
  "group_by_based_on": "field (for Group By type)",
  "group_by_type": "Count|Sum|Average",
  "number_of_groups": 0,
  "filters_json": "[]",
  "is_public": 1,
  "is_standard": 1,
  "module": "Module Name",
  "color": "#hex or null"
}
```

### Quick List — Workspace Quick List Schema

```json
{
  "document_type": "Target DocType",
  "label": "Display Label",
  "quick_list_filter": "[[\"DocType\",\"status\",\"=\",\"Open\"]]"
}
```

Quick Lists show an inline mini-list of recent records directly in the workspace. The `quick_list_filter` uses the same JSON filter format as Frappe list views.

**When to use Quick Lists vs Shortcuts vs Links:**
| Use | When |
|---|---|
| **Shortcut** | User needs to navigate to a list/form frequently (action-oriented) |
| **Link** | User needs to find a doctype from a categorized menu (discovery) |
| **Quick List** | User needs to see recent/filtered records at a glance without leaving the workspace (monitoring) |

Best candidates for Quick Lists: doctypes with high read frequency, status workflows (Open/Pending items), recent activity logs.

---

### Chart Discovery — Scan & Suggest (MANDATORY in Deep Mode)

**This is the most complex part of the skill.** Do NOT guess charts — scan doctype fields first, then ask the user business questions based on what you find.

#### Step 1: Scan Doctype Fields

For each doctype that will appear in the workspace, read the doctype JSON to identify:

| Field Type | What It Enables | Example |
|---|---|---|
| `Date` / `Datetime` | Timeseries charts (`based_on`) | `creation`, `started_at`, `due_date` |
| `Int` / `Float` / `Currency` | Aggregate charts (`value_based_on`) | `total_cost`, `token_count`, `duration_ms` |
| `Select` / `Link` | Group By charts (`group_by_based_on`) | `status`, `model_provider`, `agent` |
| `Check` (0/1) | Filtered counts | `enabled`, `is_active` |

**How to scan**: Read the doctype JSON file's `fields` array. Look for `fieldtype` values:
- Date fields: `fieldtype` in `["Date", "Datetime"]`
- Numeric fields: `fieldtype` in `["Int", "Float", "Currency", "Percent"]`
- Categorical fields: `fieldtype` in `["Select", "Link"]` (with `options` having 2-10 values for Select)
- Every doctype has `creation` and `modified` (implicit date fields — always available)

#### Step 2: Build Chart Candidates

From the scan, generate a **candidate list** — do NOT create charts yet:

```
Chart Candidates Found:
━━━━━━━━━━━━━━━━━━━━━

1. [DocType] over time
   based_on: [date_field] | chart_type: Count | type: Line
   → Answers: "How many [DocType] are created per [week/month]?"

2. [DocType] by [select_field]
   group_by: [field] | chart_type: Group By | type: Donut
   → Answers: "What's the breakdown of [DocType] by [field]?"

3. [DocType] [numeric_field] over time
   based_on: [date_field] | value_based_on: [numeric_field] | chart_type: Sum | type: Bar
   → Answers: "How much [numeric_field] is accumulated per [week/month]?"

4. [DocType] [numeric_field] by [category_field]
   group_by: [category_field] | value_based_on: [numeric_field] | chart_type: Group By/Sum | type: Bar
   → Answers: "Which [category] has the highest [metric]?"
```

#### Step 3: Ask Business Questions

Present the candidates to the user as business questions, NOT as technical chart configs:

```
Based on your doctypes, I can create these dashboard charts:

📊 Activity & Volume
  □ "How many Agent Runs happen per week?" (Line chart)
  □ "How many Conversations are created per month?" (Line chart)

📊 Breakdowns
  □ "What's the success vs failure rate of Agent Runs?" (Donut chart)
  □ "Which AI model provider is used most?" (Donut chart)
  □ "Which agents generate the most runs?" (Bar chart)

📊 Costs & Resources
  □ "How much token cost per week/month?" (Bar chart)
  □ "Which agent costs the most?" (Bar chart, group by agent)

📊 Security & Compliance
  □ "How many security events per week by risk level?" (Stacked Bar)

Which of these matter for your team? (pick any, or describe your own)
```

#### Step 4: Chart Type Decision Tree

Once the user picks their business questions, map to the right chart config:

```
Question pattern → Chart config
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

"How many X per [time]?"
  → chart_type: Count, timeseries: 1, type: Line
  → based_on: creation (or relevant date field)
  → time_interval: Weekly or Monthly (ask user)

"How much [metric] per [time]?"
  → chart_type: Sum, timeseries: 1, type: Bar
  → based_on: creation, value_based_on: [metric field]
  → time_interval: Weekly or Monthly

"What's the breakdown of X by Y?"
  → chart_type: Group By, type: Donut or Pie
  → group_by_based_on: [categorical field]
  → number_of_groups: 5-10

"Which Y has the most X?"
  → chart_type: Group By, group_by_type: Count, type: Bar
  → group_by_based_on: [link/select field]
  → number_of_groups: 10

"Which Y has the highest [metric]?"
  → chart_type: Group By, group_by_type: Sum, type: Bar
  → group_by_based_on: [link/select field]
  → value_based_on: [numeric field]
  → number_of_groups: 10

"Success vs failure rate?"
  → chart_type: Group By, type: Donut
  → group_by_based_on: status (Select field)
  → number_of_groups: 5
```

#### Step 5: Timespan & Interval Defaults

| Business context | Timespan | Interval |
|---|---|---|
| Daily operations (support tickets, runs) | Last Month | Daily |
| Weekly review (activity, costs) | Last Quarter | Weekly |
| Monthly reporting (usage, billing) | Last Year | Monthly |
| Annual planning (growth, trends) | Last Year | Quarterly |

Ask user: "Is this workspace for daily monitoring, weekly review, or monthly reporting?" — then apply the matching defaults.

#### Chart Configuration Examples

**Example 1: Timeseries Count (Line)**
```json
{
  "doctype": "Dashboard Chart",
  "name": "Agent Runs Per Week",
  "chart_name": "Agent Runs Per Week",
  "chart_type": "Count",
  "type": "Line",
  "document_type": "AI Agent Run",
  "based_on": "creation",
  "timeseries": 1,
  "timespan": "Last Quarter",
  "time_interval": "Weekly",
  "filters_json": "[]",
  "is_public": 1,
  "is_standard": 1,
  "module": "AI Core",
  "color": "#4B89DC"
}
```

**Example 2: Group By Status (Donut)**
```json
{
  "doctype": "Dashboard Chart",
  "name": "Agent Runs by Status",
  "chart_name": "Agent Runs by Status",
  "chart_type": "Group By",
  "type": "Donut",
  "document_type": "AI Agent Run",
  "group_by_based_on": "status",
  "group_by_type": "Count",
  "number_of_groups": 5,
  "filters_json": "[]",
  "is_public": 1,
  "is_standard": 1,
  "module": "AI Core"
}
```

**Example 3: Sum Over Time (Bar)**
```json
{
  "doctype": "Dashboard Chart",
  "name": "Monthly Token Cost",
  "chart_name": "Monthly Token Cost",
  "chart_type": "Sum",
  "type": "Bar",
  "document_type": "AI Usage Log",
  "based_on": "creation",
  "value_based_on": "total_cost",
  "timeseries": 1,
  "timespan": "Last Year",
  "time_interval": "Monthly",
  "filters_json": "[]",
  "is_public": 1,
  "is_standard": 1,
  "module": "AI Core",
  "color": "#F59F00"
}
```

**Example 4: Group By with Sum (Bar — "Which agent costs the most?")**
```json
{
  "doctype": "Dashboard Chart",
  "name": "Cost by Agent",
  "chart_name": "Cost by Agent",
  "chart_type": "Group By",
  "type": "Bar",
  "document_type": "AI Usage Log",
  "group_by_based_on": "agent",
  "group_by_type": "Sum",
  "value_based_on": "total_cost",
  "number_of_groups": 10,
  "filters_json": "[]",
  "is_public": 1,
  "is_standard": 1,
  "module": "AI Core",
  "color": "#E64980"
}
```

### Fixture File Conventions

- Location: `<app>/fixtures/<doctype_snake_case>.json`
- Format: JSON array of document dicts
- **CRITICAL**: Every dict in the array **MUST** have a `"doctype"` key (e.g., `"doctype": "Number Card"`, `"doctype": "Dashboard Chart"`). Without it, `import_file_by_path` raises `KeyError: 'doctype'` during `bench migrate`. Never generate a fixture dict without this key.
- If fixture file already exists, **merge** new entries (don't overwrite)
- Add to `hooks.py` `fixtures` list:
  ```python
  {"dt": "Number Card", "filters": [["module", "=", "Module Name"]]},
  {"dt": "Dashboard Chart", "filters": [["module", "=", "Module Name"]]},
  {"dt": "Workspace", "filters": [["module", "=", "Module Name"]]},
  ```

### hooks.py Fixture Pattern
```python
fixtures = [
    {"dt": "Number Card", "filters": [["module", "=", "My Module"]]},
    {"dt": "Dashboard Chart", "filters": [["module", "=", "My Module"]]},
    # Workspace auto-loads from workspace/ folder — no fixture entry needed
    # unless using fixtures-based export
]
```

Note: Workspaces in `<module>/workspace/<name>/<name>.json` are auto-discovered by Frappe on migrate. They do NOT need a fixtures entry. Only add a fixtures entry if exporting via `bench export-fixtures`.

---

## Icon Reference (Verified from Frappe v15 `icons.svg`)

Source: `frappe/public/icons/timeless/icons.svg` — 158 icons total.
In workspace JSON, use the name **without** the `icon-` prefix (e.g., `"icon": "integration"`).

### Workspace Sidebar Icons (recommended for workspace `icon` field)
These are the domain/module icons designed for the sidebar:

| Icon Name | Best For |
|---|---|
| `accounting` | Finance, GL, accounting modules |
| `agriculture` | Agriculture, farming |
| `assets` | Asset management, fixed assets |
| `buying` | Procurement, purchasing |
| `crm` | CRM, leads, opportunities |
| `customization` | Settings, customization |
| `education` | Training, learning, education |
| `equity` | Equity, investments |
| `expenses` | Expense tracking |
| `getting-started` | Onboarding, setup wizards |
| `healthcare` | Healthcare, medical |
| `hr` | Human resources, employees |
| `income` | Revenue, income tracking |
| `integration` | Integrations, APIs, connectors |
| `liabilities` | Liabilities, debt |
| `loan` | Loans, lending |
| `money-coins-1` | Billing, payments, pricing |
| `non-profit` | NGO, non-profit |
| `organization` | Company, organization structure |
| `project` | Projects (style 1) |
| `project-1` | Projects (style 2) |
| `project-2` | Projects (style 3) |
| `projects` | Projects (folder style) |
| `quality` | Quality, testing, QA |
| `quality-3` | Quality (alternate style) |
| `quantity-1` | Inventory, quantities |
| `retail` | Retail, POS |
| `sell` | Sales, selling |
| `stock` | Stock, warehouse, inventory |
| `support` | Support, helpdesk |
| `tool` | Tools, utilities (default) |
| `users` | Users, people, teams |
| `website` | Website, web pages |

### Section Card Icons (recommended for link section `icon` field)

| Icon Name | Best For |
|---|---|
| `assign` | Assignment, delegation |
| `attachment` | File attachments |
| `branch` | Branches, version control |
| `calendar` | Calendar, scheduling |
| `call` | Phone, calling |
| `chart` | Charts, analytics |
| `comment` | Comments, notes |
| `customer` | Customers, contacts |
| `dashboard` | Dashboards, overview |
| `file` | Files, documents |
| `folder-normal` | Folders (closed) |
| `folder-open` | Folders (open) |
| `image` | Images, media |
| `keyboard` | Keyboard, dev tools |
| `link-url` | Links, URLs, connections |
| `list` | Lists, list views |
| `lock` | Security, locked items |
| `mail` | Email, messaging |
| `map` | Maps, locations |
| `message` | Chat, messages |
| `message-1` | Messages (alternate) |
| `notification` | Notifications, alerts |
| `permission` | Permissions, access |
| `printer` | Print, print formats |
| `refresh` | Refresh, sync |
| `restriction` | Restrictions, rules |
| `review` | Reviews, ratings |
| `search` | Search |
| `setting` | Settings (wrench) |
| `setting-gear` | Settings (gear) |
| `share` | Sharing |
| `share-people` | Share with people |
| `star` | Favorites, starred |
| `tag` | Tags, labels |
| `upload` | Upload, import |
| `view` | View, visibility |
| `workflow` | Workflows, processes |

### All 158 Valid Icon Names (complete list)

**Navigation**: `up-line`, `small-up`, `down`, `small-down`, `right`, `left`, `up-arrow`, `down-arrow`, `arrow-left`, `arrow-right`, `arrow-up-right`, `arrow-down-left`, `arrow-down-right`

**Actions**: `move`, `unhide`, `hide`, `sidebar-collapse`, `sidebar-expand`, `change`, `sort`, `select`, `expand`, `collapse`, `expand-alt`, `shrink`, `external-link`, `up`, `both`

**CRUD**: `small-add`, `add`, `remove`, `close`, `close-alt`, `check`, `tick`, `pen`, `edit`, `edit-fill`, `delete`, `delete-active`, `duplicate`, `crop`, `scan`

**UI**: `dot-horizontal`, `dot-vertical`, `drag`, `drag-sm`, `dialpad`, `unread-status`, `read-status`, `mark-as-read`, `insert-below`, `insert-above`, `full-page`

**Views**: `group-by`, `kanban`, `sort-descending`, `sort-ascending`, `gantt`, `filter`, `filter-x`, `list`, `menu`, `table_2`, `table`, `list-alt`, `image-view`

**Status**: `heart`, `heart-active`, `lock`, `unlock`, `review`, `star`, `notification`, `notification-with-indicator`, `clap`, `criticize`, `primitive-dot`

**Communication**: `message`, `message-1`, `small-message`, `comment`, `mail`, `reply`, `reply-all`, `call`

**Files**: `file`, `small-file`, `image`, `attachment`, `upload`, `folder-open`, `folder-normal`, `link-url`

**Tools**: `refresh`, `tag`, `restriction`, `view`, `search`, `tool`, `setting`, `setting-gear`, `keyboard`, `printer`, `permission`

**Domain/Sidebar**: `website`, `users`, `support`, `stock`, `sell`, `retail`, `quantity-1`, `quality`, `quality-3`, `projects`, `project`, `project-2`, `project-1`, `folder-open`, `folder-normal`, `organization`, `non-profit`, `money-coins-1`, `loan`, `integration`, `hr`, `getting-started`, `education`, `customization`, `crm`, `equity`, `buying`, `assets`, `agriculture`, `accounting`, `healthcare`, `expenses`, `income`, `liabilities`

**Layout**: `today`, `month-view`, `calendar`, `dashboard`, `chart`, `shortcut`, `spacer`, `onboarding`, `number-card`, `dashboard-list`, `card`, `header`, `text`, `workflow`, `milestone`

**People**: `share`, `share-people`, `branch`, `customer`, `assign`, `map`

---

## Indicator Colors

green, cyan, blue, orange, yellow, gray, grey, red, pink, darkgrey, purple, light-blue

---

## What to do

### Fast Mode
1. Run all 4 preflight gates
2. List all regular doctypes in target module(s) using `get_symbols_overview` or directory listing
3. Group doctypes into logical sections (ask user to confirm)
4. Select shortcuts (top 5-8 most important doctypes/pages)
5. Generate workspace JSON:
   - Build `shortcuts` array
   - Build `links` array (Card Break + Link rows per section)
   - Build `content` blocks (header → shortcuts → spacer → headers + cards per section)
   - Generate random 10-char IDs for each content block
6. Write workspace JSON file to `<module>/workspace/<name>/<name>.json`
7. Verify module directory exists, create workspace subfolder

### Deep Mode
1. Run all 4 preflight gates (2-pass research)
2. All fast mode steps for workspace JSON
3. **Number Card discovery**:
   - For each doctype: read JSON, identify countable fields and useful filters
   - Suggest cards: total counts, filtered counts (by status/enabled), sums of numeric fields
   - Ask user: "Which of these stats matter on your dashboard?"
4. Generate Number Card fixture JSON for approved cards
5. **Chart discovery (see "Chart Discovery — Scan & Suggest" section)**:
   - Step 1: Scan doctype fields (date, numeric, categorical)
   - Step 2: Build chart candidates from field combinations
   - Step 3: Present as business questions, NOT technical configs
   - Step 4: User picks which questions matter → map to chart type via decision tree
   - Step 5: Ask "daily monitoring, weekly review, or monthly reporting?" → set timespan/interval
6. Generate Dashboard Chart fixture JSON for approved charts
7. Add Number Card + Chart references to workspace JSON (`number_cards`, `charts` arrays + `content` blocks)
8. **Quick List discovery**:
   - Identify high-activity doctypes (logs, runs, messages)
   - Identify doctypes with status workflows (Open/Pending items)
   - Ask user: "Which lists do you want to preview directly on the workspace?"
   - Set `quick_list_filter` for relevant status/date filters
9. Add Quick List entries to workspace JSON
10. **Layout arrangement**:
    - Top: shortcuts (col 3 each)
    - Below: number cards row (col 4 each, max 2 rows)
    - Below: charts (col 6 for side-by-side, col 12 for full-width)
    - Below: quick lists (col 4 or 6)
    - Below: card link sections (col 4 each)
11. Update `hooks.py` fixtures list
12. Write all files

---

## Output format

### A) Preflight Results
```
Project: [app name]
Module: [module name]
Existing Workspaces: [list or "None"]
DocTypes Found: [count] regular, [count] child tables
Pages Found: [list]
Reports Found: [list]
```

### B) Workspace Design
```
Workspace: [name]
Icon: [icon] ([indicator_color])
Route: /app/[slug]

Shortcuts:
1. [Label] → [Type] ([doc_view])
2. ...

Sections:
[Section Name] ([count] items)
  - [DocType/Page/Report]
  - ...

Number Cards: (deep mode)
  - [Card Name] → [Function] of [DocType] [filter]
  - ...

Charts: (deep mode)
  - [Chart Name] → [chart_type] [type] of [DocType]
  - ...
```

### C) Implementation Plan
```
Files to Create:
- [path] (~[lines] lines)
- ...

Files to Modify:
- [path] — [what changes]
- ...
```

### D) Awaiting Approval
"Ready to create workspace. Approve to proceed."

---

## Examples

### Example 1: Fast Mode
```
/create-workspace "HR Module" "HR" icon=hr fast
```
Creates: `hr/workspace/hr_module/hr_module.json` with shortcuts to Employee, Attendance, Leave Application, etc.

### Example 2: Deep Mode
```
/create-workspace "Sanad AI" "AI Core" icon=integration deep
```
Creates:
- `ai_core/workspace/sanad_ai/sanad_ai.json` (workspace with all sections + number card/chart references)
- `fixtures/number_card.json` (6 number cards)
- `fixtures/dashboard_chart.json` (2 charts)
- Updates `hooks.py` fixtures

---

## Checklist
- [ ] Preflight gates passed (project docs, module exists, no conflicts)
- [ ] Doctypes grouped into logical sections
- [ ] Shortcuts selected (max 8)
- [ ] Workspace JSON generated with valid `content` blocks
- [ ] Icon selected from built-in set
- [ ] Number Cards created (deep mode)
- [ ] Dashboard Charts created (deep mode)
- [ ] Quick Lists added (deep mode, if applicable)
- [ ] Fixture files written (deep mode)
- [ ] hooks.py updated (deep mode)
- [ ] Implementation plan approved before file creation

---

## Config.md Integration

The skill reads `config.md` for project-specific settings:

```markdown
## Workspace Conventions
- **Default icon**: tool
- **Default indicator_color**: blue
- **Module grouping**: Single workspace per app | One per module
- **Number Card stats_time_interval**: Monthly
- **Shortcut colors**: Use module theme color
- **Role restrictions**: [list of roles] or "All"
```

If no `config.md` exists, use defaults listed in the Fallback behavior section.

---

**Last Updated**: 2026-03-01
**Version**: 1.0 (initial)
**Dependencies**: none (standalone skill)

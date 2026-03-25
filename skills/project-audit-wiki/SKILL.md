---
name: project-audit-wiki
description: Full audit and project wiki builder for ERPNext/Frappe apps. Scans the repo to understand app structure, doctypes, workflows, reports, patches, hooks, permissions patterns, and generates a project wiki.
argument-hint: "request_text mode output focus"
---

## Input
Target: $ARGUMENTS

Scope examples:
- "scan full app and build wiki"
- "audit module Procurement + doctypes + workflows"
- "rebuild docs for existing app, ensure doctype tree and app structure are correct"

Optional controls:
- **mode**:
  - **full**: Full audit (recommended when app is new or docs are missing)
  - **targeted**: Audit only the specified module/feature
- **output**:
  - **docs**: Write/produce wiki in `docs/` (default)
  - **wiki**: Write/produce in `wiki/` (if your repo uses it)
- **focus**:
  - `architecture` | `doctypes` | `workflows` | `reports` | `all` (default: all)

**Fallback behavior**:
- If scope unclear → Scan full app
- If output unspecified → Use `docs/` folder
- If mode unspecified → Default to `full` mode

---

## Preconditions / Safety Rules

### Read-First Analysis (MANDATORY)
- This skill performs READ + ANALYSIS first
- MUST NOT change code or JSON models unless explicitly approved
- MAY propose doc/wiki file creation or updates as outputs
- If the repo is large, prefer targeted scanning based on scope

### Scan Discipline
- Start with high-signal files first (README, hooks.py, modules.txt, doctype folders)
- Expand scan only where needed to build accurate documentation
- Always list what was scanned and what was skipped

---

## When to Run (Triggers)

Run this skill when:
1. No wiki/docs exist or they are clearly incomplete
2. You explicitly ask: "scan and understand the app"
3. You are onboarding a new developer/team and need a reliable source of truth
4. You will extend an existing app and want the doctype tree + structure documented first

---

## Gate 1 — Project Config & Existing Docs Check (MANDATORY)

1. **Read project documentation**:
   - Check for `config.md` if present (for project-specific patterns)
   - Check `docs/` or `wiki/` or `README.md`
   - Read `hooks.py` for app structure

2. **Verify module structure**:
   - List all modules in the app
   - Verify doctype folders exist
   - Check for custom patterns

3. **If docs mismatch repo reality**:
   - Report mismatch clearly
   - Propose exact doc updates
   - Do not proceed to audit until structure is verified

---

## Gate 2 — Minimal Discovery Loop (MANDATORY)

**Full Mode (Broad Scan)**:
- Scan all doctype folders
- Find all controllers, client scripts, reports
- Find hooks, workflows, patches, fixtures
- Stop when comprehensive coverage achieved

**Targeted Mode (Focused Scan)**:
- Scan only specified module/doctype
- Find related controllers, hooks, workflows
- Stop when module coverage complete

**Disciplined Scanning**:
- Always start with hooks.py, modules.txt, README
- Expand only to relevant modules
- Skip vendor/, node_modules/, build/

---

## Gate 3 — Clarifying Questions (MINIMAL)

Ask ONLY what changes audit scope:
- "Specific modules to include/exclude?"
- "Depth of analysis (doctype fields only vs full controller analysis)?"
- "Any known areas to skip (test data, deprecated modules)?"

**Default assumptions**:
- Scan all modules (unless specified)
- Full depth analysis (doctype fields + controllers)
- Include all patterns (hooks, workflows, patches)

---

## Full Audit Discovery Rules

Unlike normal skills, this one is allowed to do a broad scan.

However, it must still be disciplined:
- Start with high-signal files first (README, hooks.py, modules.txt, doctype folders)
- Expand scan only where needed to build accurate documentation
- Always list what was scanned and what was skipped

---

## Audit Checklist (What to Scan)

### A) Project Identity & Structure
- Apps and app names (folder layout)
- ERPNext/Frappe version cues (pyproject.toml, requirements, apps.json if exists)
- Main modules inside the app
- Standard folder map:
  - `doctype/`
  - `report/`
  - `workflow/` or `workflows/` or `fixtures/`
  - `patches/`
  - `public/` (js/css)
  - `utils/services`
  - `hooks.py`, `config/boot`, `overrides`

### B) DocTypes Inventory (Core Requirement)

For each DocType discovered:
- Doctype name + module
- Is it a table (istable) or main doctype
- Key fields (especially Link fields)
- Child tables
- Naming rule, permissions pattern (where possible)
- Relationships (parent/child, links)
- Key methods/events in controller (validate, on_submit, on_update, etc.)
- Client-side behavior (doctype.js) if present

### C) Workflows & Approvals
- Workflow files (json) and where they live
- States, transitions, roles
- Approval maps and docstatus constraints
- Any custom workflow logic in code

### D) Reports & Dashboards
- Script reports vs query reports
- Key filters and performance concerns
- Dependencies on custom fields / doctypes

### E) Patches / Migrations / Fixtures
- Patch history and version folders
- Backfills or schema assumptions
- Fixtures for custom fields, workflows, roles, property setters

### F) Hooks & Integrations
- hooks.py: overrides, doc_events, scheduler events, permissions hooks
- external integrations (APIs, webhooks, background jobs)
- whitelisted methods + endpoints

### G) Conventions & Patterns
- Naming rules used in practice (fieldname patterns)
- Folder ownership (where logic lives)
- Common utilities and "service layer" conventions

---

## Wiki Output Standard (What to Produce)

This skill MUST output a wiki structure that becomes a source of truth.

### Default Output Folder
- If `docs/` exists → Use `docs/`
- Else create `docs/` (recommended)
- If user specifies `output=wiki` → Use `wiki/`

### Recommended Wiki File Tree (Numbered-Folder Pattern)

Based on the AccuBuild gold-standard wiki. Use numbered folders for sections, with a master README.md index.

```
docs/wiki/
├── README.md                              ← Master index with full TOC + links

├── 00-getting-started/
│   ├── overview.md                        ← What the app does, who it's for
│   ├── architecture.md                    ← System design, data flow, module map
│   ├── development-setup.md               ← Prerequisites, install, IDE setup
│   └── developer-onboarding.md            ← Learning path, codebase tour

├── 01-backend-development/
│   ├── doctypes-guide.md                  ← DocType creation, controllers, child tables
│   ├── doctype-tree.md                    ← Parent/child/link relationship map (CORE)
│   ├── controllers-hooks.md               ← Hook system, shared controllers, doc_events
│   ├── api-reference.md                   ← All whitelisted methods with examples
│   ├── database-schema.md                 ← Key tables, ORM patterns, queries
│   └── background-jobs.md                 ← Scheduler, enqueue, background tasks

├── 02-frontend-development/
│   ├── ui-ux-style-guide.md               ← Colors, typography, dialog standards
│   ├── client-scripts.md                  ← Client scripting patterns and frm API
│   └── [feature]-guide.md                 ← Feature-specific guides (DevExtreme, etc.)

├── 03-module-guides/
│   ├── [module-name].md                   ← One file per module with workflows, doctypes
│   └── ...

├── 04-integrations/
│   └── [integration-name].md              ← External systems, APIs, AI, webhooks

├── 05-testing-quality/
│   ├── testing-guide.md                   ← Unit, integration, frontend tests
│   └── code-standards.md                  ← Python/JS standards, linting config

├── 06-deployment-ops/                     ← Optional: deployment, CI/CD, backups
│   └── deployment-guide.md

└── 07-implementation-status/              ← Optional: roadmap, known issues
    ├── README.md                          ← Current status summary
    ├── roadmap.md                         ← Feature roadmap
    └── critical-issues.md                 ← Priority bugs tracker
```

### Numbering Rules
- `00-09`: Getting started (architecture, setup, onboarding)
- `10-19`: Backend (doctypes, controllers, hooks, DB)
- `20-29`: Frontend (UI, client scripts, JS libs)
- `30-39`: Module guides (one per module)
- `40-49`: Integrations (external systems)
- `50-59`: Testing & quality
- `60-69`: Deployment & ops
- `70-79`: Status & tracking

### Minimum Required Files (Even for MVP)
- `docs/wiki/README.md` — master index
- `docs/wiki/00-getting-started/overview.md` — what the app does
- `docs/wiki/00-getting-started/architecture.md` — system design
- `docs/wiki/01-backend-development/doctype-tree.md` — relationship map (CORE deliverable)

---

## Think-With-Me + Business Value (MANDATORY)

Alongside documentation, the skill must:

1. **Explain the "why"** (business value) of the structure
2. **Identify risky areas** (maintenance, performance, permissions)
3. **Propose a practical doc strategy**:
   - MVP docs now
   - Deeper docs later

---

## Devil's Advocate Review (MANDATORY)

Before finalizing the wiki plan:

**What might be wrong in our inferred relationships?**
- Hidden links not discovered
- Dynamic relationships in code
- Conditional logic that changes relationships

**Where could scanning miss hidden behavior?**
- Hooks (doc_events, scheduler_events)
- Custom scripts (not in doctype folders)
- Fixtures that add fields/relationships
- Property setters that modify behavior

**Where does documentation risk becoming stale?**
- Rapidly changing modules
- Features under active development
- Areas with frequent refactorings

**What automation or checklist can reduce docs drift?**
- Pre-commit hooks to update docs
- CI checks for documentation coverage
- Automated doc generation from code

---

## Rules (Engineering Standards)

### ERPNext/Frappe Conventions
- DocType naming: PascalCase for doctypes, snake_case for fields
- Hook registration via hooks.py
- Controller methods: validate, before_submit, on_submit, on_cancel, on_update
- Client scripts: frm API, frappe.ui.form.on()
- Permissions: Role-based, set via DocType or property setters

### Project-Specific Patterns (via config.md)
Read `config.md` for:
- Domain-specific patterns (Healthcare, Manufacturing, Retail, etc.)
- Custom field prefixes
- Module boundaries
- Shared controller locations
- Naming conventions

### Documentation Standards
- Use Mermaid.js for diagrams
- Provide code examples for all patterns
- Include file path references
- Cross-link related documentation
- Update frequency clearly stated

---

## What to Do (Step-by-Step)

### Full Mode
1. Confirm scope + mode and output location
2. Locate existing docs/wiki (if any) and assess quality
3. Perform scan according to checklist A–G
4. Build:
   - App structure map
   - Doctype inventory
   - Doctype relationship tree (core requirement)
   - Workflow/report/patch/hook summaries
5. Draft wiki file tree + content outlines
6. Provide:
   - Proposed wiki contents (ready-to-paste markdown)
   - A maintenance strategy (how to keep docs updated)
7. Ask clarifying questions only if needed
8. Provide implementation plan before writing/adding files

### Targeted Mode
1. Confirm module/feature scope
2. Locate existing docs for that module (if any)
3. Perform focused scan on specified module
4. Build:
   - Module structure map
   - Doctype inventory for module
   - Key workflows and patterns
5. Draft module-specific wiki updates
6. Provide:
   - Proposed module wiki content
   - Integration points with other modules
7. Provide implementation plan
8. Ask for approval

---

## Output Format (Strict)

### A) Audit Summary

```
Scope: [full/targeted]
Mode: [mode]
Output location: [docs/wiki]

What was scanned:
- Modules: [list]
- DocTypes: [count]
- Workflows: [count]
- Reports: [count]
- Patches: [count]
- Hooks: [count]

What was not scanned (and why):
- [Skipped areas with reasons]
```

### B) Findings

```
App Structure Map:
[Module tree with key doctypes]

DocType Inventory:
- Total DocTypes: [count]
- Main DocTypes: [list]
- Child Tables: [list]

Key Workflows:
- [Workflow 1]: [description]
- [Workflow 2]: [description]

Key Reports:
- [Report 1]: [description]
- [Report 2]: [description]

Patches & Migrations:
- [Summary]

Hooks & Integrations:
- [Summary]

Risk Hotspots:
- Permissions: [areas of concern]
- Performance: [slow queries, N+1 issues]
- Hidden Hooks: [areas needing manual review]
```

### C) Doctype Tree (Core)

```
[Readable tree of doctypes and their relationships]

Parent → Child Tables:
- DocType1
  ├── ChildTable1
  ├── ChildTable2
  └── DocType2 (Link)
- DocType3
  └── ChildTable3

Link Relationships:
- DocType1 → DocType4 (via field: link_field)
- DocType2 → DocType5 (via field: parent_ref)
```

### D) Proposed Wiki Structure

Use numbered-folder pattern (AccuBuild standard):

```
docs/wiki/
├── README.md (NEW)                            ← Master index
├── 00-getting-started/
│   ├── overview.md (NEW)
│   ├── architecture.md (NEW)
│   └── development-setup.md (NEW)
├── 01-backend-development/
│   ├── doctypes-guide.md (NEW)
│   ├── doctype-tree.md (NEW)                  ← Core deliverable
│   ├── controllers-hooks.md (NEW)
│   └── api-reference.md (NEW)
├── 02-frontend-development/
│   ├── client-scripts.md (NEW)
│   └── [feature-specific].md (NEW)
├── 03-module-guides/
│   └── [module-name].md (NEW, one per module)
├── 04-integrations/
│   └── [integration].md (if applicable)
├── 05-testing-quality/
│   └── testing-guide.md (NEW)
└── 07-implementation-status/
    └── README.md (NEW, if roadmap/issues exist)

Files to update:
- [Existing files to enhance]
```

### E) Wiki Content Drafts (MVP)

Provide ready-to-paste markdown for at least:
- `docs/wiki/README.md` — master index with links to all sections
- `docs/wiki/00-getting-started/overview.md` — what the app does
- `docs/wiki/00-getting-started/architecture.md` — system design
- `docs/wiki/01-backend-development/doctype-tree.md` — relationship map

### F) Think-With-Me Analysis

```
Business Value of This Structure:
- [Value proposition]
- [Key benefits]
- [Why this architecture]

Risky Areas:
- [Area 1]: [risk description]
- [Area 2]: [risk description]

Doc Strategy:
- MVP Docs (Now): [list]
- Deeper Docs (Later): [list]
```

### G) Devil's Advocate Review

```
Assumptions + Risks:
- Assumption 1: [description] → Risk: [what could be wrong]
- Assumption 2: [description] → Risk: [what could be wrong]

Mitigations:
- [Mitigation strategy 1]
- [Mitigation strategy 2]

Docs Drift Prevention:
- [Automation strategy]
- [Checklist strategy]
- [Review schedule]
```

### H) Implementation Plan (Docs)

```
Files to Create:
1. docs/project_overview.md - [line count, key sections]
2. docs/app_structure.md - [line count, key sections]
[... all files]

Files to Update:
1. [Existing file] - [changes needed]
[... all files]

Rollback Strategy:
- Revert docs changes
- Restore previous versions

Validation Checklist:
- [ ] All doctypes documented
- [ ] All relationships captured
- [ ] All links work
- [ ] All code examples tested
- [ ] Diagrams render correctly
```

### I) Clarifying Questions (Minimal Only)

```
- [Question 1] (only if critical)
```

### J) Awaiting Approval

**Ready to build wiki for [app_name]. Proceed?**

---

## Examples

### Example 1: Full Mode - New App

```bash
/project-audit-wiki "scan full app and build wiki" mode=full output=docs
```

**Output**:
- Complete app scan
- All doctypes documented
- Full wiki structure created
- Relationship tree built

### Example 2: Targeted Mode - Specific Module

```bash
/project-audit-wiki "audit Procurement module" mode=targeted focus=doctypes,workflows
```

**Output**:
- Procurement module scan only
- Procurement doctypes documented
- Procurement workflows documented
- Module-specific wiki updates

### Example 3: Rebuild Existing Docs

```bash
/project-audit-wiki "rebuild docs, ensure accuracy" mode=full output=wiki
```

**Output**:
- Compare existing docs to actual code
- Identify gaps and inaccuracies
- Update/rebuild wiki as needed
- Document what changed

---

## Checklist

- [ ] Config.md read (if present)
- [ ] Existing docs located and assessed
- [ ] App structure mapped
- [ ] All doctypes scanned
- [ ] Relationships documented
- [ ] Workflows documented
- [ ] Reports documented
- [ ] Patches/fixtures documented
- [ ] Hooks documented
- [ ] Wiki structure proposed
- [ ] Wiki content drafted
- [ ] Maintenance strategy defined
- [ ] Devil's advocate review completed
- [ ] Implementation plan provided
- [ ] Approval received

---

## Config.md Integration

Reads `config.md` for project-specific patterns:

```yaml
# Example config.md
Project:
  name: My App
  domain: Healthcare  # or Manufacturing, Retail, etc.
  version: 1.0.0

Modules:
  - patient: Patients, Appointments
  - billing: Invoices, Claims
  - inventory: Items, Stock

DocType Patterns:
  custom_field_prefix: "custom_"
  naming: "automatic"  # or "manual", "series"

Controller Patterns:
  shared_controllers: "app/controllers/"
  base_controller: "app.controllers.base.DocumentController"

Documentation:
  output_folder: "docs/"
  update_frequency: "monthly"
```

---

## Key Features

### 🔍 Full Repository Audit
- Comprehensive scan of doctypes, workflows, reports, hooks
- Discovers hidden relationships and patterns
- Identifies risk hotspots

### 📚 Source of Truth Wiki
- Doctype relationship tree (core requirement)
- App structure map
- Complete documentation of patterns
- Ready-to-paste markdown

### 🧠 Think-With-Me Analysis
- Business value of structure explained
- Risky areas identified
- Practical doc strategy proposed

### 👹 Devil's Advocate Review
- Assumptions challenged
- Hidden behaviors discovered
- Docs drift prevention strategy

### 🎯 Project-Agnostic
- Works with any ERPNext/Frappe app
- Config.md for domain-specific patterns
- Generic examples (Patient, Invoice, Order)

---

**Last Updated**: 2026-03-01
**Version**: 2.0 (numbered-folder wiki pattern from AccuBuild gold standard)
**Dependencies**: config.md (for project patterns), Codebase access, Markdown generation

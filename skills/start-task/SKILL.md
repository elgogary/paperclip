---
name: start-task
description: Meta-skill router. Classifies the request and builds a multi-skill pipeline with preflight gates, plan-first workflow, and approval before action. Project-agnostic via CLAUDE.md context.
argument-hint: "request text optional paths routes doctypes priority"
user-invokable: true
---

## Input
Target: $ARGUMENTS

The user may provide:
- A general request ("implement bid versioning", "improve this screen UX", "add a chat dialog")
- A route (Form/List/Report)
- Doctype name(s)
- File paths
- Constraints (MVP, upgrade-safe, performance)

Fallback behavior:
- If input is ambiguous, ask at most 2 clarification questions.
- Otherwise proceed with classification and propose a pipeline.

---

## Preflight Rules (HARD GATES — MUST RUN BEFORE ANY ACTION)

### Gate 0 — Project CLAUDE.md Exists? (MANDATORY — runs first)
1) Check if the project root has a `CLAUDE.md` file.
2) **If it exists** → read it, extract: stack, conventions, file organization, tech debt.
3) **If it does NOT exist** → STOP. Before doing anything else:
   a) Scan the project: `hooks.py`, module folders, `setup.py`/`pyproject.toml`, `public/`, key files
   b) Create a `CLAUDE.md` using the template from `rules/project-docs.md`
   c) Fill in: app name, stack, commands, structure, modules, conventions, file organization rules
   d) Include Feature = Folder rule and file size limits from global CLAUDE.md
   e) Show the draft to user and ask for confirmation before continuing with the actual task
4) **Never skip this gate.** A project without CLAUDE.md will have no conventions enforced — every subsequent skill depends on this file.

### Gate 1 — Project Docs Validation (MANDATORY)
1) Read the project's CLAUDE.md for conventions, structure, tech debt.
2) Validate naming/folder conventions relevant to the request.
3) If docs mismatch repo reality:
   - report mismatch
   - propose a doc update (patch text)
Do not implement anything before this gate.

### Gate 2 — Minimal Context Discovery (MANDATORY: max 2 passes)
Pass 1: Search for the primary entity (doctype/route/file/module).
Pass 2: Search related dependencies (hooks, workflows, reports, patches, utils).
Stop after 2 passes unless a critical dependency is missing.

### Gate 3 — Ask Minimal Questions (MANDATORY)
Ask only what changes routing or architecture:
- primary persona/role (if UI)
- MVP vs long-term
- any non-negotiable constraints (upgrade-safe, no schema changes)

### Gate 4 — Plan Before Action (MANDATORY)
Before any changes or code suggestions:
- provide an implementation plan with files/risks/rollback/tests
- ask approval

---

## Routing Logic (Multi-Skill Pipeline)

You MUST select and sequence the right skills. Build a pipeline with 1–4 stages max.

### Classification → Pipeline

| Request Type | How to Detect | Pipeline |
|---|---|---|
| **New UI** (dialog, page, form section, child table override) | Keywords: dialog, page, screen, UI, button, form, widget, picker, editor | `create-prototype` → approve → `implement-prototype` → `clean-code` |
| **UX Improvement** (redesign, improve existing UI) | Keywords: improve, redesign, better UX, usability | `ui-ux-ba` → `create-prototype` → `implement-prototype` |
| **Bug Fix** | Keywords: bug, broken, error, not working, crash, fix | `bug-fix` → `clean-code` → `code-review` |
| **New DocType** | Keywords: new doctype, create doctype, add doctype | `create-doctype` → `create-controller` → `create-test` |
| **New API Endpoint** | Keywords: API, endpoint, whitelisted method | `add-api-method` → `create-test` |
| **Client Script** | Keywords: client script, form event, field filter | `create-client-script` → `clean-code` |
| **Refactor / Cleanup** | Keywords: refactor, cleanup, split, reorganize, tech debt | `clean-code` → `code-review` |
| **Architecture / Research** | Keywords: architecture, how should, best practice, design | `research-architect` → plan → implement |
| **Full Project Audit** | Keywords: audit, review project, generate wiki | `project-audit-wiki` → `recommend-improvements` |
| **Security Review** | Keywords: security, vulnerability, OWASP | `security-review` → fix → `code-review` |
| **Documentation** | Keywords: update docs, document, README | `update-docs` |
| **PRD / Requirements** | Keywords: interview, requirements, PRD, gather requirements | `interview` → plan |
| **Complex / Multi-concern** | Can't classify into one type | Decompose into 2-3 sub-pipelines |

### MANDATORY ROUTING RULES

1. **Any visible UI change → prototype first**: If the task involves creating or changing any user-facing UI (dialog, page, form section, child table override, button with complex behavior), the pipeline MUST include `create-prototype` before any Frappe code is written. No exceptions.

2. **Any code written → clean-code audit**: Every pipeline that produces new code should end with `clean-code` to verify:
   - ES6+ compliance (no `var`, arrow functions, template literals)
   - Resource cleanup (`before_unload`, `.off()` for every `.on()`)
   - File size limits (≤500 preferred, >700 must split)
   - Feature = Folder (no flat dumping in `utils/`)
   - OOP for complex UI components

3. **Non-trivial changes → code-review**: If the pipeline touches 3+ files or changes business logic, append `code-review` as final stage.

4. **Schema changes → patch plan**: If any DocType JSON changes, include a migration/patch plan before implementation.

### Available Skills (full inventory)

**Workflow Skills:**
- `create-prototype` — standalone HTML prototype for UI work (MANDATORY before UI implementation)
- `implement-prototype` — convert approved prototype to real Frappe code (5-stage pipeline)
- `bug-fix` — systematic investigation with gated checkpoints
- `clean-code` — file structure, code length, ES6+/OOP, resource cleanup, JSON validation
- `code-review` — interactive file/line review with decision tables
- `ui-ux-ba` — UI/UX improvement with business analysis lens
- `create-doctype` — new DocType with controller, permissions, tests
- `create-controller` — shared controllers for cross-DocType logic
- `create-client-script` — form/list/page client scripts
- `add-api-method` — whitelisted API endpoints
- `create-test` — unit/integration/frontend tests
- `project-audit-wiki` — full repo audit and wiki generation
- `recommend-improvements` — actionable improvement recommendations
- `research-architect` — architecture, best practices, module structure
- `security-review` — OWASP, secrets, auth, injection scanning
- `interview` — PRD interviews to uncover hidden requirements
- `update-docs` — keep docs synchronized with codebase
- `review-pr` — review diffs/PRs

**ERPNext Reference Skills (auto-consulted by workflow skills):**
- `erpnext-code-interpreter` — translate vague requirements to technical spec
- `erpnext-code-validator` — validate code against best practices
- `erpnext-syntax-*` (8) — exact syntax for controllers, client scripts, hooks, whitelisted, jinja, scheduler, server scripts, custom apps
- `erpnext-impl-*` (8) — implementation decision trees and workflows
- `erpnext-errors-*` (7) — error handling patterns by area
- `erpnext-database` — ORM patterns and query best practices
- `erpnext-permissions` — 5-layer permission system guide
- `erpnext-api-patterns` — REST/RPC API integration patterns

### Pipeline Construction Rules
- Do not add stages that do not add value.
- Prefer the smallest pipeline that covers risk areas.
- Order: Discovery → Prototype → UX → Implement → Clean → Test → Review
- Max 4 stages per pipeline (combine if needed).

---

## What to do (Step-by-step)
1) **Gate 0**: Check if project has `CLAUDE.md`. If missing → scan project and create one before anything else.
2) Parse the request into:
   - Goal
   - Entities (doctypes/routes/files/modules)
   - Constraints
3) Run Gate 1 (read project CLAUDE.md, validate conventions) and Gate 2 (context discovery).
4) Classify the request type using the table above.
5) Build the pipeline (ordered list of skills) and explain in 2–5 lines.
6) Check mandatory routing rules (prototype-first, clean-code, code-review).
7) Produce the exact commands to run next (copy/paste ready).
8) Ask minimal clarifying questions (only if required).
9) Provide a high-level implementation plan outline (before action) and request approval.

---

## Output format
A) Task Understanding
- Goal:
- Key entities:
- Constraints:

B) Pipeline Decision
- Request type: [from classification table]
- Pipeline stages (ordered):
  1) <skill-name> — purpose
  2) <skill-name> — purpose
  ...
- Why this pipeline (short)

C) Next Commands (copy/paste)
- Command 1:
- Command 2:
- (Stop if approval required before continuing)

D) Preflight Findings
- CLAUDE.md: Exists / **CREATED** (if new, show draft for approval)
- Project docs alignment: Match/Mismatch (+ proposed update)
- Repo context found: key files/modules
- File organization: any feature=folder violations?

E) Clarifying Questions (minimal only)

F) Implementation Plan Outline (before action)
- Scope
- Files likely affected
- Risks + rollback
- Test/validation checklist

G) Awaiting Approval
- Ask to proceed with running the pipeline and implementing changes.

---

**Last Updated**: 2026-03-01
**Version**: 2.1 (+ Gate 0: Auto-create CLAUDE.md if missing)
**Dependencies**: Project CLAUDE.md (auto-created if missing), rules/project-docs.md (template), installed skills

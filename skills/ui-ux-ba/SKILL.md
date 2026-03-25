---
name: ui-ux-ba
description: Analyze and improve AccuBuild screens using UI/UX and Business Analyst mindset with wiki-first validation and a pre-approval implementation plan.
arguments: "request_text"
---

## Input
Target: $ARGUMENTS

Accepted inputs:
- A screen route (e.g., `Form/Bid/BID-2026-00004`, `List/Bid`, `Report/Bid Version Comparison`)
- A Doctype name (e.g., `Bid`, `Bid Estimation`)
- A module area (e.g., `accubuild_bidding`)
- Optional screenshot paths or a short description of the current UI issue

Fallback behavior (if input is unclear):
- Assume the user means the most relevant screen for the provided Doctype/module and proceed with discovery using the minimal search loop.

---

## Preflight Rules (HARD GATES — MUST RUN BEFORE ANY ACTION)

### Gate 1 — Wiki & Product Intent Verification (MANDATORY)
1) Locate the project's wiki/docs that define:
   - module scope, user roles/personas, workflows, and naming conventions
   - any UI guidelines (layout, components, terminology)
2) Confirm the target screen/doctype is documented (or should be) and identify:
   - user persona(s)
   - primary job-to-be-done (JTBD)
   - success metrics (KPIs) if available
3) If the wiki/docs intent conflicts with the current UI or actual code structure:
   - list the mismatch
   - propose the exact wiki update
   - if edits are allowed, provide the patch text to update wiki

### Gate 2 — Minimal Research Loop (MANDATORY: max 2 passes)
Perform at most TWO targeted discovery passes:
Pass 1 (Primary):
- search for the route/doctype in code (doctype folder, JS form script, listview settings, report files)
Pass 2 (Related):
- search for related UI logic (client scripts, hooks, workspace, permissions, workflow JSON, report scripts)

Stop after 2 passes unless a critical dependency is obviously missing.

### Gate 3 — Clarifying Questions (MANDATORY, minimal only)
Before proposing implementation:
Ask only what is required to avoid wrong UX decisions, such as:
- Who is the primary user (Estimator / QS / PM / Procurement / Site Engineer)?
- What is the screen's top goal (speed / accuracy / governance / audit)?
- What pain is happening now (confusion, too many clicks, wrong defaults)?

### Gate 4 — Implementation Plan Before Changes (MANDATORY)
Before any code suggestion/modification:
Provide a concise implementation plan:
- Scope summary
- Proposed UX changes (with rationale)
- Files affected (paths)
- Permissions/workflow impact
- Rollback strategy
- Test/validation steps
Then explicitly ask for approval to proceed.

---

## Rules (UI/UX + Business Analyst Standards)
- Think like a Business Analyst: clarify the process, actors, decisions, inputs/outputs, and approval steps.
- Optimize for the primary JTBD (don't "pretty up" at the expense of speed/accuracy).
- Respect ERPNext/Frappe patterns:
  - avoid heavy custom UI unless necessary
  - prefer configuring forms, list views, reports, and standard components
- Keep terminology consistent with wiki, doctypes, and domain language (construction bidding).
- Minimize cognitive load:
  - reduce visible noise
  - group fields into meaningful sections
  - show the next action clearly
- Reduce clicks and rework:
  - smart defaults
  - inline validation
  - progressive disclosure (show advanced fields only when needed)
- Always consider:
  - Permissions and docstatus/workflow (who can see/edit what and when)
  - Performance (don't add slow queries/UI freezes)
  - Audit trail (changes must be traceable)

---

## What to do (Step-by-step)
1) Define the screen context
   - Identify persona(s)
   - Define JTBD in one sentence
   - List key user decisions on this screen

2) Map the current user flow (as-is)
   - Entry points (from where user comes)
   - Key actions (create/edit/approve/export)
   - Friction points (confusion, duplication, missing info, slow UI)

3) Find quick wins (low effort, high impact)
   - layout/sections/field order
   - required vs optional fields
   - better labels/help text/tooltips
   - defaults and auto-fill
   - reduce scroll and clutter

4) Propose improved flow (to-be)
   - ideal steps (minimum steps)
   - where to validate and prevent errors
   - how to surface important signals (status, totals, warnings)

5) Data & logic impact
   - identify whether changes are:
     - UI-only (JS, form customization)
     - workflow/permissions (risk: governance)
     - backend logic (validation, computed fields)
     - reporting (new KPIs, dashboards)
   - ensure alignment with wiki and architecture

6) Produce an implementation plan (before changes)
   - list exact files (doctype js, python, report, workflow json)
   - list fields to add/change (if any) + patch needs
   - risks + rollback
   - test plan (manual acceptance criteria)

---

## Output format
A) Preflight Results
- Screen target:
- Persona/JTBD (from wiki or inferred):
- Wiki alignment: (Match / Mismatch + proposed wiki update)
- Context found (key files, workflows, permissions):

B) UX Findings (As-Is)
- What users likely love:
- What frustrates users:
- Top 3 risks (errors, governance, slowdowns):

C) Recommendations (To-Be)
- Quick Wins (1–5 items)
- Medium Changes (1–5 items)
- Strategic Enhancements (optional, 1–3 items)
For each: rationale + expected impact (speed/accuracy/governance)

D) Clarifying Questions (minimal only)

E) Implementation Plan (required before any action)
- Scope
- File changes
- Schema/patches (if any)
- Permissions/workflow
- Rollback
- Test/acceptance criteria

F) Awaiting Approval
- Ask to proceed with implementation.

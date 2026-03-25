---
name: create-workflow
description: Create Frappe Workflows with states, transitions, roles, conditions, and auto-export as fixtures for any ERPNext/Frappe project via config.md
argument-hint: "DocType-name workflow-name mode fast deep"
---

## Input
Target: $ARGUMENTS

**Required**:
- **DocType name**: The DocType this workflow applies to (e.g., "Purchase Order", "Payment Certificate")
- **Workflow name**: Display name (e.g., "PO Approval Workflow", "Payment Certificate Approval")

**Optional**:
- **mode**: "fast" (default) or "deep"
  - **fast**: Workflow JSON + fixture entries only
  - **deep**: Full workflow with Assignment Rules, Email Alerts, custom roles, and controller hooks
- **states**: Comma-separated state names (e.g., "Draft, Pending Review, Approved, Rejected")
- **roles**: Comma-separated roles involved (e.g., "Project Manager, Finance Manager, Director")
- **conditions**: Python conditions for transitions (e.g., "doc.grand_total > 50000")

**Fallback behavior**:
- DocType name missing → Ask for DocType and purpose
- Workflow name missing → Auto-generate from DocType (e.g., "Purchase Order Approval")
- States missing → Suggest common pattern based on DocType (Draft → Review → Approved/Rejected)
- Roles missing → Read `fixtures/role.json` and `fixtures/role_profile.json` to get actual project roles. NEVER invent role names.

## Role Resolution Rules (MANDATORY)

**CRITICAL: Workflows use Roles, NOT Role Profiles.**

Before assigning roles to workflow transitions, you MUST:
1. Read `fixtures/role.json` to get the actual custom roles
2. Read `fixtures/role_profile.json` to understand role bundles (but never use profile names in workflows)
3. Check DocType permissions JSON to see which roles already have access
4. Never duplicate — only add roles to the Role fixture if they don't already exist

**Pattern**: AccuBuild uses User/Manager pairs per module:
- `[Module] User` — can create, read, submit (initiator)
- `[Module] Manager` — can approve, cancel, amend (approver)

Use the **Manager** role for approval transitions and the **User** role for submit/create transitions.

**Standard ERPNext roles** (Projects Manager, Accounts Manager, etc.) do NOT need to be added to the Role fixture — they already exist in ERPNext.

---

## Preflight Rules (HARD GATES)

### Gate 1 — Project Docs & Config Check (MANDATORY)
1) Read project documentation:
   - Check `CLAUDE.md`, `docs/`, `wiki/`, `README.md`
   - Read `config.md` if present (for project patterns)
2) Verify DocType exists in the project or ERPNext
3) Check if a workflow already exists for this DocType:
   - Search `fixtures/workflow.json` for matching `document_type`
   - If exists, ask: "Update existing or create new?"
4) Verify app name from `hooks.py` or `pyproject.toml`
5) Check existing fixtures list in `hooks.py`

### Gate 2 — Minimal Research Loop (MANDATORY)

**Fast Mode (1 pass)**:
- Read the target DocType JSON to understand its fields, docstatus support (is_submittable)
- List existing roles in the project
- Check if `workflow_state` field exists on the DocType (Custom Field may be needed)

**Deep Mode (2 passes)**:
*Pass 1*: Analyze DocType structure, fields, existing permissions, is_submittable
*Pass 2*: Search for related patterns:
  - Similar workflows in the project or ERPNext defaults
  - Assignment Rules for the DocType
  - Email notification patterns
  - Controller hooks that interact with workflow_state

Stop after configured passes.

### Gate 3 — Clarifying Questions (MANDATORY)
Ask ONLY if critical:

**Fast Mode**:
- "Does this DocType use Submit/Cancel (docstatus)?" (if not obvious from JSON)
- "How many approval levels?" (1-level, 2-level, multi-level)

**Deep Mode**:
- "Amount-based routing? (e.g., >50K needs Director approval)"
- "Self-approval allowed?"
- "Email notifications on state change?"
- "Auto-assign to specific users/roles?"
- "Parallel approval needed? (multiple approvers at same stage)"

**Default assumptions**:
- Single approval level (Draft → Review → Approved/Rejected)
- No self-approval
- No email alerts (fast mode)
- DocType uses Submit/Cancel if is_submittable=1

### Gate 4 — Implementation Plan (MANDATORY)
Before creating files, output:

**Fast Mode**:
```
Scope: Create workflow "[Workflow Name]" for [DocType]

States:
  Draft (docstatus=0, edit: [Role]) → color: Orange
  Pending Review (docstatus=0, edit: [Role]) → color: Yellow
  Approved (docstatus=1, edit: [Role]) → color: Green
  Rejected (docstatus=0, edit: [Role]) → color: Red

Transitions:
  Draft → [Submit for Review] → Pending Review (allowed: [Role])
  Pending Review → [Approve] → Approved (allowed: [Role])
  Pending Review → [Reject] → Rejected (allowed: [Role])
  Rejected → [Revise] → Draft (allowed: [Role])

Fixtures to add/update:
  - Workflow State (N new states)
  - Workflow Action Master (N new actions)
  - Workflow
  - hooks.py fixtures list update
```

**Deep Mode**:
```
[Same as fast mode, plus:]

Assignment Rules:
  - [Rule name] → [strategy] → [users/role]

Email Alerts:
  - On [state change] → notify [role/user]

Controller Hooks:
  - [hook] in [file] → [purpose]

Custom Fields:
  - workflow_state on [DocType] (if missing)

Roles to create:
  - [New roles if needed]
```

Then ask approval.

---

## Rules (Engineering Standards)

### Frappe Workflow Architecture

**Three DocTypes must always be exported together:**

| DocType | Purpose | Fixture filter |
|---------|---------|---------------|
| `Workflow State` | Global registry of state names + colors | Filter by exact state names |
| `Workflow Action Master` | Global registry of action button labels | Filter by exact action names |
| `Workflow` | The workflow definition with states + transitions | Filter by name or document_type |

**Missing any one of these three breaks the import on fresh sites.**

### State Design Rules
- Every workflow needs at least one state with `doc_status: 0` (Draft)
- If DocType is submittable, map `Approved`/`Final` state to `doc_status: 1`
- Cancelled state maps to `doc_status: 2` (if needed)
- Each state must have `allow_edit` set to a Role
- Use meaningful colors: Orange=pending, Yellow=review, Green=approved, Red=rejected, Blue=in-progress

### Transition Design Rules
- Every state must have at least one outgoing transition (except terminal states)
- Terminal states (Approved, Rejected, Cancelled) can have a "Revise" transition back to Draft
- `allowed` field = which Role sees the action button
- `condition` = Python expression with `doc` in scope (e.g., `doc.grand_total > 50000`)
- Keep conditions simple — complex logic belongs in controller hooks, not condition strings
- `allow_self_approval = 0` by default (the submitter cannot approve their own doc)

### Docstatus Mapping
```
doc_status: 0 = Draft (editable, not submitted)
doc_status: 1 = Submitted (locked, cannot edit most fields)
doc_status: 2 = Cancelled (archived, no further changes)
```

Only ONE active workflow per DocType is allowed. If another exists, it must be deactivated first.

### Fixture `doctype` Key Rule (CRITICAL — BLOCKS MIGRATION)
Every dict in a fixture JSON array **MUST** have a `"doctype"` key. Without it, `import_file_by_path` raises `KeyError: 'doctype'` during `bench migrate`. This applies to ALL fixture files this skill generates:
- `workflow.json` → every entry needs `"doctype": "Workflow"`
- `workflow_state.json` → every entry needs `"doctype": "Workflow State"`
- `workflow_action_master.json` → every entry needs `"doctype": "Workflow Action Master"`
- `role.json` → every entry needs `"doctype": "Role"`

**Never generate a fixture dict without a `doctype` key.** Auto-exported fixtures always have it; hand-crafted ones often miss it.

### Fixture Filter Rules (CRITICAL)
- **ALWAYS** use name filters — never export all Workflow States/Actions unfiltered
- This prevents capturing states from other modules/apps
- Import order is alphabetical by filename:
  - `workflow_action_master.json` < `workflow_state.json` < `workflow.json`
  - This natural order works (actions + states load before the workflow that references them)

### Common Workflow Patterns

**Simple Approval (1-level)**:
```
Draft → [Submit] → Pending Approval → [Approve] → Approved
                                     → [Reject] → Rejected → [Revise] → Draft
```

**Two-Level Approval**:
```
Draft → [Submit] → Pending Review → [Review] → Pending Approval → [Approve] → Approved
                                   → [Reject] → Rejected
                  Pending Approval → [Reject] → Rejected → [Revise] → Draft
```

**Amount-Based Routing**:
```
Draft → [Submit] → Pending Review
  condition: doc.grand_total <= 50000 → Manager Approval
  condition: doc.grand_total > 50000  → Director Approval
Manager Approval → [Approve] → Approved
Director Approval → [Approve] → Approved
```

**With Revision Loop**:
```
Draft → [Submit] → Under Review → [Request Changes] → Under Revision → [Resubmit] → Under Review
                                 → [Approve] → Approved
                                 → [Reject] → Rejected
```

### Project-Specific Patterns (via config.md)
Read `config.md` for:
- **Approval hierarchy**: Who approves what
- **Amount thresholds**: Condition-based routing
- **Custom roles**: Project-specific roles beyond Frappe defaults
- **Module boundaries**: Which module owns the workflow
- **Existing workflow patterns**: Consistency with other workflows in the project

---

## What to do

### Fast Mode
1) Read project docs and config.md (Gate 1)
2) Perform 1-pass research on DocType (Gate 2)
3) Ask minimal questions (Gate 3)
4) Output state/transition plan (Gate 4)
5) After approval, create/update:
   a) Add Workflow State entries to `fixtures` in hooks.py (if not already listed)
   b) Add Workflow Action Master entries to `fixtures` in hooks.py (if not already listed)
   c) Add Workflow entry to `fixtures` in hooks.py
   d) Create the workflow via Frappe API call or instruct user to create in UI then export
   e) Provide the exact `bench --site [site] export-fixtures` command
6) Output summary of what was added

### Deep Mode
1) Read project docs and config.md (Gate 1)
2) Perform 2-pass research (Gate 2)
3) Ask clarifying questions (Gate 3)
4) Output detailed plan with assignment rules and email alerts (Gate 4)
5) After approval, create/update:
   a) All Fast Mode items
   b) Assignment Rule fixture entry in hooks.py
   c) Email notification template (if requested)
   d) Controller hook for workflow_state changes (if complex logic needed)
   e) Custom Field for `workflow_state` on DocType (if missing)
   f) New Role records (if custom roles needed)
   g) Provide full fixture export commands
6) Output summary with integration notes

---

## Output format

### A) Preflight Results
```
DocType: [name]
Submittable: Yes/No
Existing Workflow: None / [name]
Config.md: Yes/No (patterns applied: [list])
Existing Roles: [list from project]
Fixture Status: [what's already in hooks.py]
```

### B) Workflow Design
```
Workflow: [name]
DocType: [target]
Active: Yes

States:
  [State] | docstatus=[0/1/2] | edit: [Role] | color: [color]
  ...

Transitions:
  [From State] → [Action Button] → [To State] | allowed: [Role] | condition: [expr or none]
  ...

Actions (Workflow Action Master):
  [Action1], [Action2], [Action3]
```

### C) Fixture Config
```python
# Add to hooks.py fixtures list:
{
    "dt": "Workflow State",
    "filters": [["name", "in", ["State1", "State2", "State3"]]],
},
{
    "dt": "Workflow Action Master",
    "filters": [["name", "in", ["Action1", "Action2", "Action3"]]],
},
{
    "dt": "Workflow",
    "filters": [["name", "=", "Workflow Name"]],
},
```

### D) Export Command
```bash
bench --site [site] export-fixtures
```

### E) Awaiting Approval
**Ready to create workflow "[Name]" for [DocType]. Proceed?**

---

## Examples

### Example 1: Fast Mode - Simple Approval
```bash
/create-workflow "Purchase Order" "PO Approval" mode=fast
```

**Output**:
- 4 states: Draft, Pending Approval, Approved, Rejected
- 3 transitions: Submit, Approve, Reject
- Fixture entries for hooks.py
- Export command

### Example 2: Deep Mode - Multi-Level with Conditions
```bash
/create-workflow "Payment Certificate" "Payment Certificate Approval" mode=deep
```

**Output**:
- 6 states with amount-based routing
- Transitions with conditions (doc.net_total > threshold)
- Assignment Rule: Round Robin to Finance team
- Email alert on approval
- Controller hook for post-approval actions

### Example 3: With Custom Roles
```bash
/create-workflow "Change Order" "Change Order Approval" roles="Site Engineer, Project Manager, Director"
```

**Output**:
- 3-level approval chain
- Role fixtures if custom
- Escalation path

---

## Checklist

- [ ] Project docs/config read
- [ ] DocType analyzed (fields, docstatus, permissions)
- [ ] Existing workflows checked (no conflicts)
- [ ] States and transitions designed
- [ ] All 3 fixture DocTypes added to hooks.py (Workflow State, Workflow Action Master, Workflow)
- [ ] Export command provided
- [ ] Assignment Rules configured (deep mode)
- [ ] Email alerts configured (deep mode)
- [ ] Controller hooks added (deep mode, if needed)

---

## Config.md Integration

Reads `config.md` for project-specific patterns:

```yaml
# Example config.md workflow section
Approval hierarchy:
  level_1: Project Manager (up to 50,000)
  level_2: Director (up to 200,000)
  level_3: CEO (above 200,000)

Workflow conventions:
  color_scheme: Orange=draft, Yellow=review, Green=approved, Red=rejected
  self_approval: No
  email_on_approval: Yes

Custom roles:
  - Site Engineer
  - Project Manager
  - Quantity Surveyor
```

---

**Last Updated**: 2026-03-06
**Version**: 1.0
**Dependencies**: config.md (for project patterns), target DocType must exist

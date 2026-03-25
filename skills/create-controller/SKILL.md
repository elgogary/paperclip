---
name: create-controller
description: Create shared controllers for any ERPNext/Frappe project with cross-DocType logic, project patterns via config.md
argument-hint: "controller name module mode fast deep purpose"
---

## Input
Target: $ARGUMENTS

**Required**:
- **Controller name**: snake_case name (e.g., budget_validation, invoice_workflow)

**Optional**:
- **module**: Target module (default: core shared controllers)
- **mode**: "fast" (default) or "deep"
  - **fast**: Basic controller with essential methods
  - **deep**: Full controller with integration patterns, hooks, tests
- **purpose**: What the controller does

**Fallback behavior**:
- No purpose → Ask what controller does
- No module → Default to shared controllers location from config.md

---

## Preflight Rules (HARD GATES)

### Gate 1 — Project Docs & Config Check (MANDATORY)
1) Read project documentation:
   - Check `docs/` or `wiki/` or `README.md`
   - Read `config.md` if present (for controller patterns)
2) Verify shared controller location from config.md
3) Check if similar controller exists
4) Flag documentation gaps

### Gate 2 — Minimal Research Loop (MANDATORY)

**Fast Mode (1 pass)**:
- Find existing shared controllers
- Identify common patterns

**Deep Mode (2 passes)**:
*Pass 1*: Find existing shared controllers, identify patterns
*Pass 2*: Find integration points (hooks, DocTypes using similar logic)

Stop after configured passes.

### Gate 3 — Clarifying Questions (MANDATORY)
Ask ONLY if critical:
- "Which DocTypes will use this controller?"
- "Does this controller modify data or just read/validate?"

### Gate 4 — Implementation Plan (MANDATORY)
Before creating, output:
```
Scope: Create [controller] controller
Location: [path from config.md]
DocTypes using it: [list]
Methods: [key methods]
Integration: [hooks, tests]
```

---

## Rules

### ERPNext/Frappe Conventions
- Shared controllers in location specified by config.md
- Functions should be standalone (not class methods)
- Use `frappe.db.sql()` for queries (parameterized only)
- Use `frappe.throw()` for errors
- Return data structures, not DocType objects

### Critical Rules (from erpnext-syntax-controllers)
1. Changes to `self.*` in `on_update` are NOT saved — use `frappe.db.set_value()` instead
2. NEVER call `frappe.db.commit()` inside controller hooks — Frappe handles commits
3. ALWAYS call `super().validate()` (or other method) when overriding parent class
4. Use `flags` system to prevent recursion across linked documents
5. NEVER call `self.save()` inside lifecycle hooks — causes infinite loop
6. Put critical validation in `before_submit`, NOT `on_submit`

### Hook Selection Decision Tree
```
Validate data or calculate fields?   → validate (changes to self ARE saved)
Action after save?                   → on_update (changes NOT saved — use db_set)
Only for NEW documents?              → after_insert
Check before submit?                 → before_submit (last abort point)
Action after submit?                 → on_submit
Custom document naming?              → autoname
Before delete?                       → on_trash
```

### Execution Order
```
INSERT:  before_insert → autoname → validate → before_save → [DB INSERT] → after_insert → on_update
SAVE:    validate → before_save → [DB UPDATE] → on_update → on_change
SUBMIT:  validate → before_submit → [DB: docstatus=1] → on_update → on_submit
```

### Transaction Behavior
| Hook | frappe.throw() Effect |
|------|-----------------------|
| `validate` / `before_save` | Full rollback — NOT saved |
| `on_update` / `after_insert` | IS saved — error shown only |
| `before_submit` | Full rollback — stays Draft |
| `on_submit` | docstatus=1 already set |

### Anti-Patterns (NEVER DO)
| Wrong | Correct |
|-------|---------|
| `self.x = y` in `on_update` | `frappe.db.set_value(...)` |
| `frappe.db.commit()` in hooks | Let framework handle it |
| `self.save()` in lifecycle hook | Infinite loop |
| Override without `super()` | Always `super().method()` first |

> **Deep reference**: See `erpnext-syntax-controllers`, `erpnext-impl-controllers`, `erpnext-errors-controllers`

### Project-Specific (via config.md)
Read `config.md` for:
- **Shared controller location**: Where to create
- **Budget control integration**: Required for procurement modules?
- **Hierarchy patterns**: Required for WBS/BOM modules?
- **Fiscal year validation**: Required for finance modules?

---

## What to do

### Fast Mode
1) Read docs/config (Gate 1)
2) 1-pass research (Gate 2)
3) Ask questions (Gate 3)
4) Output plan (Gate 4)
5) Create controller with basic methods:
   - Essential functions only
   - Basic error handling
   - Scaffold tests

### Deep Mode
1) Read docs/config (Gate 1)
2) 2-pass research (Gate 2)
3) Ask questions (Gate 3)
4) Output plan (Gate 4)
5) Create controller with full integration:
   - All methods
   - Transaction handling
   - Hooks registration
   - Comprehensive tests
   - DocType integrations

---

## Output format

### A) Preflight Results
```
Config.md: Yes/No (controller location: [path])
Similar controllers: [list]
Wiki alignment: Match/Mismatch
```

### B) Controller Design
```
Name: [controller_name]
Location: [path]
Purpose: [description]

Methods:
- [method1]: [purpose]
- [method2]: [purpose]

DocTypes using it:
- [DocType1]
- [DocType2]

Integrations (from config.md):
- [Budget control/Hierarchy/Fiscal year]
```

### C) Implementation Plan
```
Files to create:
- [exact paths]

Functions:
- [function1]: [signature, purpose]
- [function2]: [signature, purpose]

Hooks to register:
- [events]

Tests:
- [test cases]
```

### D) Awaiting Approval
**Ready to create controller. Proceed?**

---

## Examples

### Example 1: Fast Mode - Simple Controller
```bash
/create-controller invoice_workflow sales mode=fast
```

**Output**:
- Basic controller with validation logic
- Essential methods only
- Scaffold tests

### Example 2: Deep Mode - Complex Controller
```bash
/create-controller budget_validation core mode=deep
```

**Output** (reads config.md for budget patterns):
- Full controller with hierarchical lookup
- Transaction handling
- Fiscal year validation
- Hook registration
- Comprehensive tests

---

## Checklist

- [ ] Docs/config read
- [ ] Similar controllers analyzed
- [ ] Methods designed
- [ ] Controller created
- [ ] Hooks registered (deep mode)
- [ ] Tests created (deep mode)
- [ ] Documentation updated

---

## Config.md Integration

```yaml
# Example config.md
Shared controllers:
  location: [app]_core/controllers/
  available: budget_validation, hierarchy_lookup, invoice_workflow

Budget control:
  required: Yes
  hierarchical_lookup: Yes

Fiscal year:
  required: Yes
  validation: before_any_financial_operation
```

---

**Last Updated**: 2026-01-22
**Version**: 2.0 (Project-Agnostic)
**Dependencies**: config.md (for controller patterns), hooks.py

---
name: create-client-script
description: Create client scripts for any ERPNext/Frappe project, project patterns via config.md
argument-hint: "request_text"
---

## Input
Target: $ARGUMENTS

**Required**:
- **DocType name**: Target DocType (PascalCase)
- **Script type**: Form Script, List Script, or Page Script
- **Functionality**: What the script does

**Optional**:
- **mode**: "fast" (default) or "deep"
  - **fast**: Basic script with essential logic
  - **deep**: Full script with performance optimization, mobile considerations
- **Field dependencies**: Fields that trigger actions
- **Custom buttons**: Buttons to add
- **Server methods**: API methods to call

**Fallback**:
- DocType missing → Ask for DocType name
- Script type unclear → Ask "Form, List, or Page?"

---

## Preflight Rules (HARD GATES)

### Gate 1 — Project Docs & Config Check (MANDATORY)
1) Read project docs and config.md
2) Verify client script location from config.md
3) Check if similar script exists
4. Flag documentation gaps

### Gate 2 — Minimal Research Loop (MANDATORY)

**Fast Mode (1 pass)**:
- Find similar client scripts
- Identify basic patterns

**Deep Mode (2 passes)**:
*Pass 1*: Find similar client scripts, identify patterns
*Pass 2*: Find related logic (field calculations, custom buttons, server calls)

Stop after configured passes.

### Gate 3 — Clarifying Questions
Ask ONLY if critical:
- "Does this modify submitted documents?"
- "Does this need server calls?"
- "Mobile-friendly needed?"

**Defaults**: Read-only, no server, fast, desktop-first

### Gate 4 — Implementation Plan
Output plan before implementing:
```
Scope: Create [script_type] for [DocType]
File: [path from config.md]
Features: [list]
Docstatus checks: Yes/No
Mobile: Yes/No (from config.md or default)
```
Ask approval.

---

## Rules

### Frappe Conventions
- `frappe.ui.form.on()` for forms
- `frm` object for form access
- `frappe.call()` for server communication
- `frappe.msgprint()` for messages
- camelCase naming

### Critical Rules (from erpnext-syntax-clientscripts)
1. ALWAYS call `frm.refresh_field('table')` after ANY child table modification
2. NEVER use `frm.doc.field = value` — use `frm.set_value('field', value)` instead
3. ALWAYS use `__('text')` for all translatable/user-facing strings
4. In `validate` event, use `frappe.throw()` to prevent save (not `msgprint`)
5. Set `set_query` filters in `setup`, NOT in `refresh`
6. Wrap ALL async server calls in `try/catch`
7. NEVER call `frappe.db.*` or `frappe.get_doc()` from client-side — server-side only
8. NEVER use `alert()` or `confirm()` — use Frappe methods

### Event Decision Tree (MANDATORY — choose correct event)
```
Set link field filters?            → setup
Add custom buttons?                → refresh
Show/hide fields by condition?     → refresh + {fieldname} (BOTH needed)
Validation before save?            → validate (frappe.throw on error)
Action after successful save?      → after_save
Calculation on field change?       → {fieldname}
Child table row added?             → {tablename}_add
Child table field changed?         → Child DocType event: {fieldname}
One-time initialization?           → setup or onload
```

### Error Feedback Methods
| Method | Blocks Save | Auto-Dismiss | Use For |
|--------|-------------|--------------|---------|
| `frappe.throw()` | YES | No | Validation errors (validate event only) |
| `frappe.msgprint()` | NO | No | Important warnings |
| `frappe.show_alert()` | NO | Yes | Success/info toast |
| `frm.set_intro()` | NO | No | Form-level warnings |

### Anti-Patterns (NEVER DO)
| Wrong | Correct |
|-------|---------|
| `frm.doc.field = value` | `frm.set_value('field', value)` |
| `frappe.call()` without callback | Use callback or `async/await` |
| `frappe.db.get_value()` in JS | `frappe.call()` for server data |
| `frappe.throw()` in `refresh` event | Only in `validate` event |
| `alert('error')` | `frappe.throw()` or `frappe.msgprint()` |
| `set_query` in `refresh` | `set_query` in `setup` |
| No error handling on async | `try/catch` around all `await` calls |
| No `frm.refresh_field()` after child table change | Always call after modifications |

### Docstatus Validation (MANDATORY)
- Check docstatus before modifications
- Hide Submit if docstatus=1
- Show Cancel based on state
- Prevent modifications if docstatus=2

### Performance
- Debounce input events
- Loading indicators for server calls
- Batch DOM updates

### Minimal Change (MANDATORY)
- Small functions (≤20 lines)
- Single purpose
- No global variables

> **Deep reference**: See `erpnext-syntax-clientscripts`, `erpnext-impl-clientscripts`, `erpnext-errors-clientscripts` for complete patterns

### Project-Specific (via config.md)
Read `config.md` for:
- **Frontend framework**: Vue/React/jQuery
- **Mobile considerations**: Required?
- **Performance patterns**: Debouncing, batching
- **UI patterns**: Budget display, validation (if applicable)

---

## What to do

### Fast Mode
1) Read docs/config (Gate 1)
2) 1-pass research (Gate 2)
3) Ask questions (Gate 3)
4) Output plan (Gate 4)
5) Create script with:
   - Basic events
   - Essential logic
   - Docstatus checks
   - Simple validation

### Deep Mode
1) Read docs/config (Gate 1)
2) 2-pass research (Gate 2)
3) Ask questions (Gate 3)
4) Output plan (Gate 4)
5) Create script with:
   - All events
   - Field dependencies
   - Server communication with loading indicators
   - Docstatus validation
   - Performance optimization (debouncing, caching)
   - Mobile considerations (from config.md)
   - Error handling
   - Small functions

---

## Output format

### A) Preflight Results
```
Config.md: Yes/No (frontend framework: [framework])
Similar scripts: [list]
```

### B) Clarifying Questions
```
- [Question 1]
```

### C) Implementation Plan
```
Scope: [script_type] for [DocType]
File: [path]
Features: [list]
Mobile: [Yes/No]
```

### D) Awaiting Approval
**Ready to create client script? Proceed?**

---

## Checklist

- [ ] Script created
- [ ] Events implemented
- [ ] Dependencies added
- [ ] Server calls added (if needed)
- [ ] Docstatus checks added
- [ ] Loading indicators added (if server calls)
- [ ] Error handling added
- [ ] Tested in browser
- [ ] Documentation updated

---

## Config.md Integration

```yaml
# Example config.md
Frontend framework: Vue  # or React, jQuery
Mobile considerations: Yes
Performance patterns:
  - Debounce: 300ms for inputs
  - Batch DOM updates: 16ms max
```

---

**Last Updated**: 2026-01-22
**Version**: 2.0 (Project-Agnostic)

---
name: add-api-method
description: Add whitelisted API methods for any ERPNext/Frappe project with validation, transactions, project patterns via config.md
argument-hint: "request_text"
---

## Input
Target: $ARGUMENTS

**Required**:
- **Method name** (snake_case): e.g., get_budget_summary, calculate_invoice_total
- **Functionality**: What this API method does

**Optional**:
- **File location**: Module path (default from config.md)
- **mode**: "fast" (default) or "deep"
  - **fast**: Basic API with essential validation
  - **deep**: Full API with transactions, comprehensive validation, caching
- **Parameters**: List with types
- **Return value**: What method returns
- **Permissions**: Roles/permissions needed

**Fallback**:
- Method name missing → Ask for name and purpose
- File location missing → Suggest based on config.md

---

## Preflight Rules (HARD GATES)

### Gate 1 — Project Docs & Config Check (MANDATORY)
1) Read project documentation and config.md
2) Verify API patterns
3) Check if similar method exists
4) Flag documentation gaps

### Gate 2 — Minimal Research Loop (MANDATORY)

**Fast Mode (1 pass)**:
- Find similar API methods
- Identify permission/validation patterns

**Deep Mode (2 passes)**:
*Pass 1*: Find similar API methods, identify patterns
*Pass 2*: Find related logic (budget, hierarchy, fiscal year from config.md)

Stop after configured passes.

### Gate 3 — Clarifying Questions
Ask ONLY if critical:
- "Does this modify data or just read?"
- "Specific permissions required?"

### Gate 4 — Implementation Plan
Before creating, output:
```
Scope: Create [method_name]
Location: [path]
Parameters: [list]
Returns: [structure]
Permissions: [roles]
```

---

## Rules

### ERPNext/Frappe Conventions
- Use `@frappe.whitelist()` decorator
- Permission checks FIRST — NEVER skip
- Validate all inputs
- Use transactions for multi-document operations
- Return structured data (dict/list)
- Error handling with `frappe.throw()`

### Critical Rules (from erpnext-syntax-whitelisted)
1. NEVER skip permission checks — always use `frappe.has_permission()` or `frappe.only_for()`
2. NEVER use user input in raw SQL — always parameterized queries `%(param)s`
3. NEVER expose internal error details — log with `frappe.log_error()`, show generic message
4. `allow_guest=True` requires strict input validation — NEVER expose sensitive data
5. Use `ignore_permissions=True` ONLY after explicit role check
6. GET for read-only, POST for state-changing operations

### Security Checklist (MANDATORY for every method)
- [ ] Permission check present (`frappe.has_permission()` or `frappe.only_for()`)
- [ ] Input validation (types, ranges, formats)
- [ ] No SQL injection (parameterized queries only)
- [ ] No sensitive data in error messages
- [ ] `allow_guest=True` only with explicit reason
- [ ] `ignore_permissions=True` only with prior role check

### Permission Decision Tree
```
Anyone (guests)?         → allow_guest=True + strict validation + rate limit
Any logged-in user?      → Default (no allow_guest) + frappe.has_permission()
Specific role?           → frappe.only_for("RoleName")
Document-level check?    → frappe.has_permission(doctype, ptype, doc)
```

### Exception Types
| Exception | HTTP | Use When |
|-----------|------|----------|
| `frappe.ValidationError` | 417 | Bad input |
| `frappe.PermissionError` | 403 | Access denied |
| `frappe.DoesNotExistError` | 404 | Not found |
| `frappe.DuplicateEntryError` | 409 | Duplicate |
| `frappe.AuthenticationError` | 401 | Not logged in |

### Anti-Patterns (NEVER DO)
| Wrong | Correct |
|-------|---------|
| No permission check | `frappe.has_permission()` first |
| `f"WHERE name = '{name}'"` | `frappe.db.sql("WHERE name = %(name)s", {"name": name})` |
| `except: pass` | `except Exception: frappe.log_error(); frappe.throw()` |
| Returning sensitive data in errors | Generic user message + `frappe.log_error()` |

### Version Features
| Feature | v14 | v15 | v16 |
|---------|-----|-----|-----|
| Type annotation validation | No | Yes | Yes |
| Rate limiting decorator | No | Yes | Yes |
| API v2 endpoints | No | Yes | Yes |

> **Deep reference**: See `erpnext-syntax-whitelisted`, `erpnext-impl-whitelisted`, `erpnext-errors-api` for complete patterns

### Project-Specific (via config.md)
- Budget control integration (if applicable)
- Hierarchy validation (if applicable)
- Fiscal year validation (if applicable)

---

## What to do

### Fast Mode
1) Read docs/config (Gate 1)
2) 1-pass research (Gate 2)
3) Ask questions (Gate 3)
4) Output plan (Gate 4)
5) Create API method:
   - Whitelist decorator
   - Permission checks
   - Basic validation
   - Simple return

### Deep Mode
1) Read docs/config (Gate 1)
2) 2-pass research (Gate 2)
3) Ask questions (Gate 3)
4) Output plan (Gate 4)
5) Create API method:
   - Whitelist decorator
   - Permission checks
   - Comprehensive validation
   - Transaction handling (if modifies data)
   - Error handling
   - Caching (if read-heavy)
   - Structured return
   - Docstring

---

## Output format

### A) Preflight Results
```
Config.md: Yes/No
Similar methods: [list]
Location: [path]
```

### B) API Design
```
Method: [method_name]
Location: [path]

Parameters:
- [param1]: [type] - [description]
- [param2]: [type] - [description]

Returns:
- [structure]

Permissions:
- [roles/permissions]

Validation:
- [checks]
```

### C) Implementation
```python
@frappe.whitelist()
def [method_name]([params]):
    # Permission checks
    # Validation
    # Logic
    # Return
    pass
```

### D) Awaiting Approval
**Ready to create API method. Proceed?**

---

**Last Updated**: 2026-01-22
**Version**: 2.0 (Project-Agnostic)

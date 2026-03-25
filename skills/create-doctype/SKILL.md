---
name: create-doctype
description: Create a new DocType for any ERPNext/Frappe project with proper structure, controller, permissions, and project conventions via config.md
argument-hint: "DocType name module is_single mode fast deep key fields"
---

## Input
Target: $ARGUMENTS

**Required**:
- **DocType name** (PascalCase): e.g., "Invoice", "WorkOrder", "PatientVisit"
- **Module**: e.g., "sales", "inventory", "manufacturing"
- **Is single**: 0 or 1

**Optional**:
- **mode**: "fast" (default) or "deep"
  - **fast**: Standard DocType scaffold with basic fields
  - **deep**: Full analysis, controller design, hooks, tests, integration patterns
- **key_fields**: Comma-separated field_name:type:label tuples

**Fallback behavior**:
- DocType name missing → Ask for name and purpose
- Module missing → Suggest based on DocType pattern
- is_single missing → Default to 0
- key_fields missing → Create with minimal standard fields

---

## Preflight Rules (HARD GATES)

### Gate 1 — Project Docs & Config Check (MANDATORY)
1) Read project documentation:
   - Check `docs/` or `wiki/` or `README.md`
   - Read `config.md` if present (for project patterns)
2) Verify module directory exists
3) Check if similar DocType exists:
   - If yes, ask: "Extend existing or create new?"
4) Verify naming conventions
5) Flag documentation gaps

### Gate 2 — Minimal Research Loop (MANDATORY)

**Fast Mode (1 pass)**:
- List existing DocTypes in target module
- Find 1-2 similar DocTypes for templates
- Identify common fields

**Deep Mode (2 passes)**:
*Pass 1*: Find similar DocTypes, identify patterns
*Pass 2*: Search for integration requirements:
   - Budget control patterns (if applicable via config.md)
   - Hierarchy patterns (if applicable via config.md)
   - Fiscal year patterns (if applicable via config.md)
   - Other project-specific patterns

Stop after configured passes.

### Gate 3 — Clarifying Questions (MANDATORY)
Ask ONLY if critical:

**Fast Mode**:
- "Child table of another DocType?"
- "Workflow needed (Draft→Submitted→Approved)?"

**Deep Mode**:
- "Budget control integration needed?" (if applicable via config.md)
- "Hierarchy support needed?" (if applicable via config.md)
- "Fiscal year segmentation?" (if applicable via config.md)
- "Child table of which parent?"
- "Workflow states and transitions?"

**Default assumptions**:
- No budget control (unless config.md says required)
- No workflow (simple submit/cancel)
- Not a child table
- Standard permissions

### Gate 4 — Implementation Plan (MANDATORY)
Before creating files, output:

**Fast Mode**:
```
Scope: Create [DocType] in [module]
Files to Create:
- [module]/doctype/[doc_type]/[doc_type].json
- [module]/doctype/[doc_type]/__init__.py
- [module]/doctype/[doc_type]/test_[doc_type].py
- [module]/doctype/[doc_type]/list.js

Key fields: [list]
Workflow: No (basic submit/cancel)
```

**Deep Mode**:
```
Scope: Create [DocType] in [module]
Files to Create:
- [module]/doctype/[doc_type]/[doc_type].json
- [module]/doctype/[doc_type]/[doc_type].py (controller)
- [module]/doctype/[doc_type]/__init__.py
- [module]/doctype/[doc_type]/test_[doc_type].py
- [module]/doctype/[doc_type]/list.js
- [module]/doctype/[doc_type]/[doc_type].js (client script)

Schema:
- Key fields: [list]
- Links: [from config.md or generic]
- Workflow: [states/transitions]
- Budget control: [Yes/No from config.md]
- Hierarchy: [Yes/No from config.md]
- Fiscal year: [Yes/No from config.md]

Integrations:
- Shared controllers: [list]
- Hooks: [events]
- Permissions: [roles]

Wiki Update Required: Yes/No
```

Then ask approval.

---

## Rules (Engineering Standards)

### ERPNext/Frappe Conventions
- **Naming**: PascalCase for DocType, lowercase_with_underscores for fields
- **Standard fields**: naming_series, owner, modified_by, creation, modified
- **Company field**: Add if multi-tenancy needed
- **Project field**: Add if project-specific
- **Track changes**: track_changes = 1 for audit trail
- **Custom**: custom = 0 for standard DocTypes
- **Module**: Must match folder structure

### Project-Specific Patterns (via config.md)
Read `config.md` for:
- **Budget control**: Required for procurement modules?
- **Hierarchy support**: Parent-child relationships?
- **Fiscal year**: Required for finance modules?
- **Custom field prefixes**: e.g., "custom_"
- **Module boundaries**: Which modules own which domains
- **Shared controller locations**: Where to find them

### Controller Patterns (Deep Mode)
- **validate()**: Data validation — changes to `self.*` ARE saved
- **before_submit()**: Pre-submit checks — LAST abort point before docstatus=1
- **on_submit()**: Post-submit actions — docstatus already set, can't abort cleanly
- **on_cancel()**: Cleanup on cancel — docstatus already set to 2
- **on_update()**: After save — changes to `self.*` NOT saved (use `frappe.db.set_value()`)

### Submittable Document Workflow (docstatus lifecycle)
```
Draft (0) → Submitted (1) → Cancelled (2)
```
- Set `is_submittable = 1` in DocType JSON
- `docstatus` field is auto-managed — NEVER set manually
- Cancelled docs cannot be re-submitted — create amendment instead

### Naming Options
| Pattern | Version | Example |
|---------|---------|---------|
| `field:fieldname` | All | `ABC Company` |
| `naming_series:` | All | `SO-2024-00001` |
| `format:PREFIX-{##}` | All | `INV-2024-0001` |
| `hash` | All | `a1b2c3d4e5` |
| `UUID` | v16+ ONLY | `01948d5f-...` |
| Custom `autoname()` | All | Any pattern |

### Fixtures vs Patches (for data/config setup)
| What | Fixtures | Patches |
|------|---------|---------|
| Custom Fields | Yes | No |
| Property Setters | Yes | No |
| Roles/Workflows | Yes | No |
| Data transformation | No | Yes |
| Data cleanup/migration | No | Yes |

### Critical Rules (from erpnext-syntax-customapp)
1. ALWAYS define `__version__` in `__init__.py`
2. Register ALL modules in `modules.txt`
3. Include `__init__.py` in EVERY directory
4. NEVER put Frappe/ERPNext in pyproject.toml project dependencies (not on PyPI)

### Version Differences
| Feature | v14 | v15 | v16 |
|---------|-----|-----|-----|
| Build config | setup.py | pyproject.toml | pyproject.toml |
| UUID autoname | No | No | Yes |
| `extend_doctype_class` | No | No | Yes |
| Type annotations | No | Yes | Yes |
| Data Masking | No | No | Yes |

> **Deep reference**: See `erpnext-syntax-controllers`, `erpnext-syntax-customapp`, `erpnext-impl-customapp` for complete patterns

---

## What to do

### Fast Mode
1) Read project docs and config.md (Gate 1)
2) Perform 1-pass research (Gate 2)
3) Ask minimal questions (Gate 3)
4) Output basic implementation plan (Gate 4)
5) Create DocType files:
   - JSON schema with standard fields
   - Basic controller (minimal)
   - Test file (scaffold)
   - List JS (scaffold)

### Deep Mode
1) Read project docs and config.md (Gate 1)
2) Perform 2-pass research (Gate 2)
3) Ask clarifying questions (Gate 3)
4) Output detailed implementation plan (Gate 4)
5) Create DocType files:
   - JSON schema with all fields
   - Full controller with hooks
   - Client script with form logic
   - Comprehensive test file
   - List JS with customization
   - Register hooks if needed

---

## Output format

### A) Preflight Results
```
Module: [module]
Config.md: Yes/No (patterns applied: [list])
Similar DocTypes: [list]
Wiki alignment: Match/Mismatch
```

### B) Schema Design
```
DocType: [name]
Module: [module]
Is Single: [0/1]

Key Fields:
- [field1]: [type] - [label]
- [field2]: [type] - [label]

Links (from config.md or generic):
- [Link1]: [purpose]
- [Link2]: [purpose]

Workflow: [states/transitions or "None"]
```

### C) Implementation Plan
```
Files to create:
- [exact paths]

Controller hooks:
- [hooks to implement]

Integrations:
- [shared controllers]
- [permissions]

Wiki update: Yes/No
```

### D) Awaiting Approval
**Ready to create [DocType]. Proceed?**

---

## Examples

### Example 1: Fast Mode - Simple DocType
```bash
/create-doctype Invoice sales 0 mode=fast
```

**Output**:
- Basic Invoice DocType
- Standard fields only
- Simple controller
- Scaffold test

### Example 2: Deep Mode - Complex DocType
```bash
/create-doctype PatientVisit hospital 0 mode=deep
```

**Output**:
- Full PatientVisit DocType with custom fields
- Complete controller with validation
- Client script with form logic
- Comprehensive tests
- Hooks, permissions, integrations

### Example 3: Domain-Specific (Manufacturing)
```bash
/create-doctype WorkOrder manufacturing 0 mode=deep
```

**Output** (reads config.md for manufacturing patterns):
- WorkOrder DocType with BOM integration
- Production workflow
- Resource allocation
- Quality check integration

---

## Checklist

- [ ] Docs/config read
- [ ] Similar DocTypes analyzed
- [ ] Schema designed
- [ ] Files created
- [ ] Controller implemented (deep mode)
- [ ] Tests created
- [ ] Hooks registered (deep mode)
- [ ] Documentation updated

---

## Config.md Integration

Reads `config.md` for project-specific patterns:

```yaml
# Example config.md
Budget control: Yes
Hierarchy support: Yes
Fiscal year: Yes

Module boundaries:
  sales: Sales orders, invoices, customers
  manufacturing: BOM, work orders, production

Shared controllers:
  location: [app]_core/controllers/
  available: budget_validation, hierarchy_lookup
```

---

**Last Updated**: 2026-01-22
**Version**: 2.0 (Project-Agnostic)
**Dependencies**: config.md (for project patterns), module structure

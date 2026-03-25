# Project Conventions Template

**Purpose**: This file configures skills for your specific ERPNext/Frappe project.
**Usage**: Copy this to each skill folder as `config.md` and edit values for your project.

---

## Project Identification

- **Primary app name**: `your_app_name`
- **ERPNext version**: v15 (or specify)
- **Frappe version**: v15 (or specify)
- **Repo docs location**: `docs/` or `wiki/` or `README.md`

---

## Folder Structure Conventions

Edit these paths to match your project:

- **Module folders**: `<app>/<module>/`
- **DocType pattern**: `<app>/<module>/doctype/<doctype>/`
- **Controllers location**: `<app>/<module>/controllers/` or `<app>_core/controllers/`
- **Utilities location**: `<app>/<module>/utils/` or `<app>_core/utils/`
- **Hooks file**: `<app>/hooks.py`
- **Workflows location**: `<app>/<module>/workflow/` OR `fixtures/` OR `workflows/`
- **Patches location**: `<app>/patches/` OR `<app>/<module>/patches/`

---

## Naming Conventions

Edit if your project uses different standards:

- **Field names**: `lower_snake_case` (Frappe standard)
- **DocType names**: `Title Case` (Frappe standard)
- **Python functions**: `snake_case` (PEP 8)
- **Python classes**: `PascalCase` (PEP 8)
- **JavaScript**: `camelCase` for functions/variables, `PascalCase` for classes
- **Custom field prefix**: `custom_` (if applicable)

---

## Architecture Patterns

Edit to match your project's patterns:

- **Shared controllers**: Yes/No (Do you use cross-DocType shared controllers?)
- **Budget control**: Yes/No (Does your app have budget/WBS/cost control?)
- **Hierarchy support**: Yes/No (Parent-child relationships, WBS, etc.)
- **Fiscal year segmentation**: Yes/No (Financial operations by fiscal year)
- **Multi-module**: Yes/No (Is your app split into multiple modules?)
- **Frontend framework**: Vue/React/DevExtreme/jQuery (or specify)

---

## Module Boundaries

List your app's modules and their purposes:

```
module_1: Purpose description
module_2: Purpose description
module_3: Purpose description
```

---

## Development Standards

Edit if your project has custom standards:

- **Python line length**: 110 (Frappe standard) or specify
- **Python indentation**: Tabs (Frappe standard) or Spaces
- **Max function length**: 40 lines (recommended) or specify
- **Max file length**: 500 lines (recommended) or specify
- **Test framework**: unittest or pytest
- **Pre-commit hooks**: Yes/No

---

## Domain-Specific Patterns

**Only fill this if your app has domain logic similar to AccuBuild (construction, manufacturing, healthcare, etc.)**

- **Domain**: (e.g., Construction, Manufacturing, Healthcare, Education)
- **Domain-specific entities**: (e.g., Projects, Bids, WBS, Sites, Patients)
- **Domain-specific workflows**: (e.g., Bid → RFP → Contract → Payment)
- **Domain-specific controllers**: (if any)

---

## Integration Points

- **ERPNext integration**: Yes/No (Do you extend ERPNext DocTypes?)
- **Third-party APIs**: (List any external APIs your app uses)
- **Payment gateways**: (if applicable)
- **Storage backend**: (S3, MinIO, local, etc.)

---

## Custom Rules

Add any project-specific rules here:

```yaml
# Example: Never modify core ERPNext DocTypes
- rule: Never extend ERPNext DocTypes directly
  reason: Upgrade safety

# Example: Always use transactions for multi-document operations
- rule: Use frappe.db.commit() only after all validations
  reason: Data integrity
```

---

## Usage Instructions

1. **Copy this file** to each skill folder that needs project-specific configuration
2. **Edit the values** to match your project
3. **Skills will automatically read** `config.md` if present
4. **Update when project structure changes** to keep skills aligned

---

## Example: Frappe App "MyApp"

Here's an example config for a hypothetical app:

```yaml
# Project Identification
Primary app name: my_app
ERPNext version: v15
Frappe version: v15
Repo docs location: docs/

# Folder Structure
Module folders: my_app/{sales,inventory,reports}/
DocType pattern: my_app/{module}/doctype/{doctype}/
Controllers location: my_app/controllers/
Hooks file: my_app/hooks.py
Workflows location: workflows/
Patches location: patches/

# Naming Conventions
Field names: lower_snake_case
DocType names: Title Case
Custom field prefix: myapp_

# Architecture Patterns
Shared controllers: Yes
Budget control: No
Hierarchy support: Yes (Category → Subcategory → Item)
Fiscal year segmentation: No
Frontend framework: Vue

# Module Boundaries
sales: Sales orders, invoices, customer management
inventory: Items, stock, warehouses
reports: Custom reports and dashboards

# Development Standards
Python line length: 110
Python indentation: Tabs
Max function length: 40 lines
Max file length: 500 lines
Test framework: unittest
Pre-commit hooks: Yes
```

# Dependency Diagram Reference

## Purpose

The dependency diagram is the FIRST artifact produced in TIL. It maps the blast radius of a change
so you know exactly what files are affected, why, and in what order to modify them.

## Mermaid Template

```mermaid
graph TD
  subgraph CHANGE["Files Being Changed"]
    F1[file_being_modified.py]
  end

  subgraph DEPS_UP["Depends ON these (imports/uses)"]
    D1[database_model.py]
    D2[utils/helper.js]
  end

  subgraph DEPS_DOWN["Things that USE this file"]
    C1[frontend_component.js]
    C2[api_endpoint.py]
    C3[another_feature.js]
  end

  subgraph TESTS["Tests That Must Pass"]
    T1[unit: test_file.py]
    T2[integration: test_api.py]
    T3[system: playwright_spec.ts]
  end

  F1 -->|imports| D1
  F1 -->|calls| D2
  C1 -->|renders data from| F1
  C2 -->|calls| F1
  C3 -->|imports| F1
  T1 -.->|tests| F1
  T2 -.->|tests| C2
  T3 -.->|tests| C1
```

## Annotation Rules

- **Solid arrows** `-->` = runtime dependency (imports, calls, queries)
- **Dashed arrows** `-.->` = test coverage
- **Label each arrow** with WHY: `calls`, `imports`, `renders`, `queries`, `triggers hook`
- **Color-code blast radius**:
  - Red subgraph = high blast radius (many consumers, breaking change)
  - Yellow subgraph = medium (few consumers, non-breaking but needs update)
  - Green subgraph = isolated (no downstream consumers)

## Frappe/ERPNext Specific Patterns

### DocType Change
```mermaid
graph TD
  subgraph CHANGE["DocType Being Changed"]
    DT[item.json + item.py controller]
  end

  subgraph DEPS_UP["Framework Dependencies"]
    FR[frappe.model.document]
    DB[MariaDB table: tabItem]
  end

  subgraph DEPS_DOWN["Consumers"]
    CS[item.js client script]
    API[api.py whitelisted methods]
    HOOK[hooks.py doc_events]
    RPT[item_report.py]
    OTHER[other_doctype.py via get_doc/get_list]
  end

  DT -->|extends| FR
  DT -->|schema maps to| DB
  CS -->|frm events for| DT
  API -->|frappe.get_doc| DT
  HOOK -->|on_submit etc| DT
  RPT -->|frappe.db.sql| DB
  OTHER -->|Link field to| DT
```

### Whitelisted API Change
```mermaid
graph TD
  subgraph CHANGE["API Method"]
    API[api.py::get_items]
  end

  subgraph DEPS_UP["Backend Dependencies"]
    DT[Item DocType]
    UTIL[utils/filters.py]
  end

  subgraph DEPS_DOWN["Frontend Consumers"]
    CS[item.js::frappe.call]
    PAGE[item_page.js::fetch]
    GRID[item_grid.js::loadData]
  end

  API -->|queries| DT
  API -->|uses| UTIL
  CS -->|calls| API
  PAGE -->|calls| API
  GRID -->|calls| API
```

### Client Script Change
```mermaid
graph TD
  subgraph CHANGE["Client Script"]
    CS[item.js]
  end

  subgraph DEPS_UP["What it calls"]
    API[api.py endpoints]
    FRM[frappe.ui.form API]
  end

  subgraph DEPS_DOWN["Isolated - no consumers"]
    NONE[No downstream deps]
  end

  CS -->|frappe.call| API
  CS -->|frm.set_value etc| FRM
```

## Change Order Table Template

After the diagram, always produce this table:

| # | File | Why it changes | After which change | Blast |
|---|------|---------------|-------------------|-------|
| 1 | `models/item.py` | Data contract changes | — (start here) | High |
| 2 | `api/item_api.py` | Uses model, must update | After #1 | Medium |
| 3 | `frontend/item.js` | Calls API, UI update | After #2 | Low |

**Blast** column values:
- **High** — Breaking change, many consumers, requires careful coordination
- **Medium** — Non-breaking but needs update, few consumers
- **Low** — Isolated change, no downstream impact

## Rules

1. Always trace BOTH directions: what does this file depend on AND what depends on it
2. Include transitive dependencies (A → B → C means changing A may affect C)
3. For Frappe apps, always check: hooks.py, client scripts, whitelisted APIs, reports, and Link fields
4. The change order table dictates implementation sequence — never skip ahead

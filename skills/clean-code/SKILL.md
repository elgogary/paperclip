---
name: clean-code
description: Enforce clean code standards for any ERPNext/Frappe project: file structure, code length limits, JSON fieldname validation, dependency-aware file splits, and safe refactor execution. Supports project standards via config.md.
argument-hint: "paths module doctype feature mode fast deep execute style strict normal"
---

## Input
Target: $ARGUMENTS

**Required**:
- **Target**: Paths, module, DocType, or feature to analyze
  - File paths: `path/to/file.py`, `path/to/module/`
  - Module: `sales`, `inventory`, `manufacturing`
  - DocType: `Invoice`, `Work Order`, `Patient`
  - Feature: Feature name (will discover files)

**Optional**:
- **mode**: "fast" (default), "deep", or "execute"
  - **fast**: Basic validation, obvious issues, quick wins (1-pass)
  - **deep**: Thorough analysis, file split plans, refactor roadmap (2-pass)
  - **execute**: Deep analysis + dependency mapping + approved splits are executed automatically (plan → approve → do → verify → commit per phase)
- **style**: "strict" (all rules enforced) or "normal" (recommendations only)

**Fallback behavior**:
- If only a DocType/module is provided, discover primary files using minimal search loop
- Default mode: fast
- Default style: normal

---

## Preflight Rules (HARD GATES — MUST RUN BEFORE ANY ACTION)

### Gate 1 — Project Docs & Config Check (MANDATORY)
1) Read project documentation:
   - Check `docs/` or `wiki/` or `README.md`
   - Read `config.md` if present (for project standards)
2) Verify requested change follows documented structure:
   - Module/doctype folder structure
   - Naming conventions
   - File locations
3) If docs mismatch repo reality:
   - Report mismatch
   - Propose exact doc updates (or patch text)
   - Do not proceed to refactor until this is resolved

### Gate 2 — Minimal Context Discovery (MANDATORY)

**Fast Mode (1 pass)**:
- Find exact target file(s)/doctype implementation
- Find primary entrypoints

**Deep Mode (2 passes)**:
*Pass 1*: Find exact target file(s)/doctype implementation and primary entrypoints
*Pass 2*: Find related dependencies (hooks, whitelisted APIs, workflows, reports, patches)

Stop after configured passes unless critical dependency missing.

### Gate 3 — Clarifying Questions (MANDATORY)
Ask only what changes routing or architecture:
- Bugfix or refactor-only task?
- Allowed to change public APIs/DocType schema?
- Performance constraints (large datasets, heavy reports)?

### Gate 4 — Implementation Plan Before Edits (MANDATORY)
Before writing any code, output plan including:
- What will be refactored vs untouched
- Files to change/create (exact paths)
- How changes will be minimal and safe
- Rollback strategy
- Tests/validation
Then ask approval to proceed.

---

## Rules (Clean Code Standards)

### 1) File Structure & Ownership (HARD RULES)
- Keep `doctype/<doctype>/` focused on the DocType (controller, js, json, tests)
- Put reusable logic in `utils/` (NOT inside doctype controllers)
- Keep whitelisted endpoints thin:
  - Controller/wrapper calls a service/util function
- Avoid cross-module coupling:
  - Prefer shared utilities, not deep imports across unrelated modules

### 2) Code Length & Complexity Limits (HARD RULES)
- **Function length target**: ≤ 40 lines (excluding docstrings/comments)
- **Function length hard limit**: If > 60 lines, must decompose
- **File size guideline**:
  - Prefer ≤ 500 lines per file
  - Soft limit: 500–700 lines (flag for review, recommend split)
  - Hard limit: > 700 lines — **Must split** (mandatory in output)
- **Nesting**: Avoid > 3 nesting levels. Use guard clauses and early returns

### 3) File Length Split Rule (ADDED — MUST DO)
When any target file is large:
- Measure approximate size by:
  - Number of functions/classes
  - Rough line count (from file content)
If file > 500 lines (soft limit) or > 700 lines (hard limit):
1) **Recommend splitting it** (mandatory)
2) **Provide a suggested split map**:
   - New file names
   - Responsibilities per file
   - Public API boundaries
3) Ensure imports remain clean and cycles are avoided
4) Ensure the smallest possible diff for safe refactor

### 4) Naming & Readability
- Use intent-revealing names
- Prefer explicit over clever
- Keep naming consistent:
  - `snake_case` for Python + fieldnames
  - `Title Case` for DocType names
- Centralize constants to avoid magic strings

### 5) JavaScript Standards — ES6+ & OOP (HARD RULES)

**ES6+ Syntax (mandatory for all new JS code):**
- `const` / `let` — never `var`
- Arrow functions for callbacks: `arr.map(x => x.name)` not `arr.map(function(x) { return x.name; })`
- Template literals: `` `Hello ${name}` `` not `'Hello ' + name`
- Destructuring: `const { doc, fields } = frm` where appropriate
- `async/await` with `frappe.xcall()` for cleaner async flows (fallback: `frappe.call` with callback)
- Optional chaining: `frm.doc?.items?.length` for safe access
- Spread operator for object merging: `{...defaults, ...overrides}`
- `for...of` loops over arrays — avoid `for (var i=0;...)` unless index needed

**OOP & Class Patterns (for non-trivial UI components):**
- Encapsulate complex UI in ES6 classes:
  ```javascript
  class MyFeatureDialog {
      constructor(frm) { this.frm = frm; this.dialog = null; }
      show() { /* build + show dialog */ }
      destroy() { /* cleanup listeners, DOM, intervals */ }
  }
  ```
- Single Responsibility: one class = one UI component or one data concern
- Keep classes in separate files under `utils/` or `public/js/` — not inline in doctype JS
- Use composition over deep inheritance (Frappe classes rarely need extends beyond framework base)
- Public methods: `show()`, `hide()`, `destroy()`, `refresh()` — keep API small
- Private helpers: prefix with `_` (e.g., `_buildHTML()`, `_bindEvents()`)

**Resource Cleanup & Event Listeners (MANDATORY):**
Every component that binds events MUST clean up. Leaked listeners cause memory issues and ghost behavior on form navigation.

| What you bind | Where to unbind |
|---|---|
| `frappe.realtime.on('event', handler)` | `frappe.realtime.off('event', handler)` in `before_unload` or `destroy()` |
| `$(document).on('click', '.selector', fn)` | `$(document).off('click', '.selector', fn)` |
| `frm.page.wrapper.on('click', fn)` | `frm.page.wrapper.off('click', fn)` in `before_unload` |
| `setInterval(fn, ms)` | `clearInterval(id)` in `before_unload` or `destroy()` |
| `setTimeout(fn, ms)` | `clearTimeout(id)` if component can be destroyed before timeout |
| Custom DOM injection (`$wrapper.html(...)`) | Remove or replace in `refresh` — don't keep appending |
| DevExtreme widget instances | `.dispose()` before re-init or form navigation |

**Frappe form cleanup hook:**
```javascript
frappe.ui.form.on('MyDocType', {
    refresh(frm) {
        // bind events, init components
        frm._my_feature = new MyFeatureDialog(frm);
    },
    before_unload(frm) {
        // MUST cleanup here
        if (frm._my_feature) frm._my_feature.destroy();
        frappe.realtime.off('my_event', frm._my_handler);
    }
});
```

**Frappe Realtime Patterns:**
```javascript
// CLIENT — subscribe (always save handler reference for cleanup)
frm._on_progress = (data) => {
    frappe.show_progress(__('Processing'), data.percent, 100, data.message);
};
frappe.realtime.on('my_progress', frm._on_progress);

// CLIENT — unsubscribe (in before_unload or destroy)
frappe.realtime.off('my_progress', frm._on_progress);

// SERVER — publish
frappe.publish_realtime('my_progress', {
    'percent': 50,
    'message': 'Half done'
}, user=frappe.session.user)  # or doctype= + docname= for doc-scoped
```

Anti-patterns to flag:
| Anti-Pattern | Impact | Correct |
|---|---|---|
| `frappe.realtime.on()` without matching `.off()` | Leaked listener, fires on wrong form | Always `.off()` in `before_unload` |
| Anonymous function in `.on()` | Can't `.off()` it later | Use named function or store reference |
| `var` anywhere in new code | Hoisting bugs, block scope issues | `const` or `let` |
| `$.each()` for simple iteration | jQuery dependency, slower | `for...of` or `.forEach()` |
| Giant procedural `refresh(frm)` > 100 lines | Unmaintainable | Extract to class with `show()`/`refresh()` |
| No `before_unload` handler when events bound | Ghost listeners | Always add cleanup |

### 6) ERPNext/Frappe Best Practices (NON-NEGOTIABLE)
- **Permissions**: Validate server-side for write actions
- **Docstatus/workflow**: Do not bypass workflow rules unintentionally
- **DB/Performance**: Avoid N+1 queries; scope queries; add indexes where needed
- **Schema changes**: Never change schema without patch/migration plan + backfill

**Universal Anti-Patterns (from erpnext-errors-* skills — flag ALL of these):**
| Anti-Pattern | Impact | Correct |
|-------------|--------|---------|
| `frappe.db.commit()` in controller/doc_events | Breaks transaction | Let framework commit |
| `self.field = x` in `on_update` | Change not saved | `frappe.db.set_value()` |
| String formatting in SQL | SQL injection | Parameterized queries `%(param)s` |
| Missing permission checks in APIs | Security breach | `frappe.has_permission()` first |
| `frappe.get_all()` for user queries | Bypasses permissions | `frappe.get_list()` |
| `import` in Server Scripts | ImportError (sandbox) | Use `frappe.utils.*` directly |
| No `super()` in overridden methods | Breaks parent logic | Always call `super()` first |
| Queries without LIMIT | Memory issues | Always paginate |
| `self.save()` in lifecycle hook | Infinite loop | Use `frappe.db.set_value()` |
| `frappe.throw()` in permission hooks | Breaks list views | `return False` or `return None` |
| `alert()` / `confirm()` in JS | Non-Frappe UX | `frappe.msgprint()` / `frappe.throw()` |
| `frm.doc.field = value` in JS | Not tracked by form | `frm.set_value('field', value)` |

> **Deep reference**: See `erpnext-errors-*` and `erpnext-syntax-*` skills for complete anti-pattern lists

### 7) JSON Validation (ADDED — MUST DO)
When `.json` files are in scope (DocType JSON, Report JSON, or Fixture JSON):
Validate at minimum:

**0) Fixture JSON — `doctype` Key (CRITICAL — BLOCKS MIGRATION)**
Every dict in a Frappe fixture JSON array (`fixtures/*.json`) **MUST** have a `"doctype"` key matching the fixture's target DocType. Without it, `import_file_by_path` raises `KeyError: 'doctype'` during `bench migrate → sync_fixtures`. This is a silent error — JSON parses fine, but Frappe crashes at runtime.
- Check: Every object in the array has `"doctype": "<TargetDocType>"`
- Common offenders: `role.json`, `role_profile.json`, any hand-written fixture
- Auto-exported fixtures (via `bench export-fixtures`) always include the key — the risk is hand-crafted fixtures



**1) Fieldname Conventions**
- `fieldname` must be `lower_snake_case`
- No spaces, no hyphens
- Avoid reserved/confusing names (`type`, `class`, `data` unless intentional)
- Consistent prefixes for custom fields if project uses them

**2) Duplicates & Collisions**
- No duplicate `fieldname`
- No duplicate `label` that causes confusion (warn)
- No collision with standard ERPNext fields (warn)

**3) Schema / Code Consistency**
- Check that referenced fields used in Python/JS exist in JSON:
  - E.g., if code uses `doc.revision_of`, confirm JSON includes `revision_of`
- Check Link targets exist (DocType names correct)

**4) Required & Indexing sanity**
- If field is frequently filtered/reported on, recommend `search_index` / DB index
- If field is required for logic, ensure `reqd` is set (or explain why not)

If any mismatch found:
- Propose the exact JSON updates needed
- If docs mention fieldnames, propose doc updates too

### 8) Refactor Safety Rules
- Refactor must be behavior-preserving unless explicitly requested
- Keep diffs small; avoid broad file moves unless needed
- Never "rebuild ERPNext core"; extend/compose

### 9) Documentation Rules
- New doctype/workflow/util → update module README or docs if required
- If docs differ from repo reality → propose patch text

---

## What to do (Step-by-step)

### Fast Mode
1) Identify target scope (exact files, doctypes, entrypoints)
2) Run structural checks (folder placement vs docs)
3) Run code quality checks (basic):
   - Long functions (> 60 lines)
   - Risky patterns (permissions, workflow, N+1)
4) Run JS quality checks (if JS files in scope):
   - ES6+ compliance (`var` usage, missing arrow functions, string concatenation)
   - Event listener cleanup (missing `before_unload`, unmatched `.on()`/`.off()`)
   - Realtime listener leaks (`frappe.realtime.on()` without `.off()`)
5) Run file-length analysis (if large files, note them)
6) Run JSON validation (if JSON files in scope)
7) Produce action recommendations (quick wins only)
8) Provide implementation plan (before edits)

### Deep Mode
1) Identify target scope (exact files, doctypes, entrypoints)
2) Run structural checks (folder placement vs docs)
3) Run code quality checks (thorough):
   - Long functions, duplicated logic, deep nesting
   - Risky patterns (permissions, workflow, N+1, heavy loops)
4) Run JS quality checks (thorough, if JS files in scope):
   - Full ES6+ compliance audit
   - OOP assessment: should procedural code be refactored to classes?
   - Event listener audit: every `.on()` has matching `.off()`, every `setInterval` has `clearInterval`
   - Realtime audit: all `frappe.realtime.on()` calls cleaned up in `before_unload`
   - Resource cleanup: DevExtreme `.dispose()`, DOM injection cleanup
   - Large procedural `refresh()` functions → recommend class extraction
5) Run file-length analysis:
   - If 500-700 lines: flag for review, recommend split
   - If > 700 lines: output mandatory split recommendation + split map
6) Run JSON validation (if JSON files in scope):
   - Fieldname conventions, duplicates, collisions
   - Code references vs JSON existence
   - Link target validity
7) Produce action recommendations:
   - Quick wins
   - Safe refactor plan
   - Schema/index notes
8) Provide implementation plan (before edits)

### Execute Mode (deep + dependency mapping + auto-execution)
1) Run deep mode steps 1-8 (full analysis)
2) Run dependency mapping (Gate 5):
   - Scan JS→Python `frappe.call()` surface for every target file
   - Scan Python internal imports (module-level + deferred)
   - Detect circular dependencies
   - Classify files: API-surface vs internal-only
3) Build phased execution plan (Gate 6):
   - Group work into independent, committable phases
   - Order by safety: break cycles → move internals → split API files → JS splits
   - Show BEFORE/AFTER structure for each phase
4) Ask approval for execution plan
5) Execute phase loop (for each phase):
   a) BEFORE snapshot (files + sizes + API paths)
   b) EXECUTE (move/split/create/update imports)
   c) VERIFY (AST + py_compile + line counts + API paths)
   d) CODE REVIEW — run `/code-review` on changed files only
      - Check ERPNext/Frappe standards
      - Check tech stack conventions
      - Fix blocking issues before commit
   e) MATCH (compare BEFORE vs AFTER expectations)
   f) COMMIT (one commit per phase)
   g) REPORT to user (files, lines, review results)
6) Final summary (total splits, moves, before/after counts)

---

## Output format

### A) Preflight Results
```
Wiki/Docs alignment: Match/Mismatch (+ proposed doc updates)
Config.md: Yes/No (project standards applied: [list])
Context found: key files/modules/hooks/workflows
Key risks
```

### B) File Structure & Size Report

**Fast Mode**: Basic size info
**Deep Mode**: Detailed analysis with split recommendations

```
Files analyzed: [list]
Approximate line counts: [counts]
Oversized files detected: Yes/No

Split recommendations (if any):
File: [path] (X lines, Y functions)
Issue: [description]

Suggested split:
  - [new_file_1].py: [responsibilities]
  - [new_file_2].py: [responsibilities]

Public API boundaries:
  - Export: [functions to expose]
  - Internal: [functions to hide]
```

### C) JSON Validation Report (if JSON files in scope)

**Fast Mode**: Basic validation
**Deep Mode**: Comprehensive with fieldmap analysis

```
JSON files analyzed: [list]
Fieldname issues:
  - Duplicates: [list]
  - Typos: [list]
  - Convention violations: [list]

Code-vs-JSON mismatches:
  - Code uses 'X' but JSON missing: [list]
  - JSON has 'Y' but code never uses: [list]

Link targets:
  - Invalid DocType references: [list]

Proposed JSON edits:
  [exact changes needed]
```

### D) Code Quality Findings

**Fast Mode**: Critical issues only
**Deep Mode**: Comprehensive with severity ratings

```
Critical (must fix):
- [Issue 1]: [description]
- [Issue 2]: [description]

High (should fix):
- [Issue 3]: [description]
- [Issue 4]: [description]

Medium (consider fixing):
- [Issue 5]: [description]

Low (nice to have):
- [Issue 6]: [description]
```

### E) Clarifying Questions (minimal only)

### F) Implementation Plan (required before edits)

**Fast Mode**: Basic plan
**Deep Mode**: Detailed with split steps

```
Scope: [what will be refactored]
Files to change/create: [exact paths]

Refactor steps:
1. [Step 1]
2. [Step 2]

Split steps (if needed, deep mode only):
1. Extract [function_group] to [new_file]
2. Update imports
3. Test extraction

Rollback:
- Revert file changes
- Delete extracted files (if split)

Tests/validation:
- [Test 1]
- [Test 2]
```

### G) Awaiting Approval
**Ready to proceed with clean code refactoring?**

---

## Execute Mode — Dependency Mapping + Auto-Execution

When `mode=execute`, the skill goes beyond analysis. After the plan is approved, it **maps dependencies, then executes the splits phase by phase** with verification at each step.

### Gate 5 — Dependency Mapping (MANDATORY in execute mode)

Before any file move or split, map what depends on what. This prevents breaking things during large refactors.

**5A) Python dependency scan:**
For every file being split/moved, find:
- `frappe.call()` / `frappe.xcall()` references from JS → Python (the **API surface**)
- Internal Python imports (`from module.file import symbol`)
- Relative imports (`from .file import symbol`)
- Circular dependencies (A imports B, B imports A)
- Re-export chains (A re-exports from B which imports from A)

**5B) JS dependency scan:**
For every JS file being split, find:
- How it's loaded: `app_include_js`, `doctype_js`, page auto-load, tree auto-load, `frappe.require()`
- `frappe.ui.form.on()` registrations (which DocType, which events)
- `frappe.provide()` namespaces used
- `window.*` global exports and where they're consumed
- Cross-file reads of shared namespaces (e.g., `accubuild_core.bid_tree.someMethod`)

**5C) Classify each file:**

| Category | Rule | Example |
|---|---|---|
| **API-surface file** | Has `frappe.call()` from JS | Must keep `@whitelist` methods at same dotted path |
| **Internal-only file** | No JS references, only Python imports | Can move freely, just update Python imports |
| **Re-export hub** | Re-exports symbols from other files | Thin stub stays at original path after move |
| **Has circular deps** | Mutual imports with another file | Must break cycle FIRST (extract shared constants) |

**5D) Output dependency report:**
```
=== DEPENDENCY MAP ===

Files with JS API surface (CANNOT change dotted path):
  - utils/template_integration.py  →  13 frappe.call() sites
  - doctype/bid/bid.py             →  15 frappe.call() sites
  ...

Files internal-only (safe to move/rename):
  - utils/ai_client.py             →  0 JS calls, 8 Python importers
  - utils/template_integration_save.py  →  0 JS calls
  ...

Circular dependencies to break first:
  - ai_bid_parser ↔ ai_bid_importer  (shared: FLEXIBLE_COLUMNS, _update_task_progress)
  ...

JS loading mechanisms:
  - bid.js          → frappe auto-load (co-located doctype JS)
  - bid_tree/*.js   → app_include_js (hooks.py lines 60-141)
  ...
```

### Gate 6 — Execution Plan with Phases (MANDATORY in execute mode)

Group the work into independent phases. Each phase:
1. Can be committed separately
2. Can be reverted without affecting other phases
3. Has a verification step

**Phase ordering rules:**
1. Break circular dependencies FIRST (extract shared constants/helpers)
2. Move internal-only files NEXT (no API surface = safe)
3. Split API-surface files LAST (need thin stubs)
4. JS splits AFTER Python is stable
5. hooks.py updates in SAME commit as JS file moves

**Plan format:**
```
Phase 1: [description]
  Files: [list]
  Depends on: nothing
  Risk: low/medium/high
  Strategy: [move/split/stub]

Phase 2: [description]
  Files: [list]
  Depends on: Phase 1
  Risk: low/medium/high
  Strategy: [move/split/stub]
...
```

Then ask: **"Approve execution plan? Will commit after each phase."**

### Execution Loop (after approval)

For each phase, run this loop:

```
┌─────────────────────────────────────────────────┐
│  PHASE N: [description]                         │
│                                                 │
│  1. BEFORE snapshot                             │
│     - List files + line counts                  │
│     - List frappe.call() paths that must work   │
│                                                 │
│  2. EXECUTE                                     │
│     - Move/split/create files                   │
│     - Update imports                            │
│     - Add thin stubs (if API-surface file)      │
│     - Update hooks.py (if JS move)              │
│                                                 │
│  3. VERIFY (automated checks)                   │
│     - AST syntax check (all changed .py)        │
│     - py_compile check (all changed .py)        │
│     - Confirm no file > 700 lines (new files)   │
│     - Confirm API paths still resolve           │
│     - Confirm no orphan imports                 │
│                                                 │
│  4. CODE REVIEW (run /code-review skill)        │
│     - Review ONLY the split/moved files         │
│     - Check against ERPNext/Frappe standards    │
│     - Check tech stack conventions              │
│     - Flag conflicts or anti-patterns           │
│     - Fix any issues found before proceeding    │
│                                                 │
│  5. MATCH — compare BEFORE vs AFTER             │
│     - Same number of @whitelist methods?        │
│     - Same frappe.call() paths work?            │
│     - Line counts within target?                │
│     - No new circular deps introduced?          │
│                                                 │
│  6. COMMIT                                      │
│     - git add specific files                    │
│     - Commit: "refactor: [phase description]"   │
│                                                 │
│  7. REPORT to user                              │
│     - Files changed: [list]                     │
│     - Lines before/after: [counts]              │
│     - Verification: PASS/FAIL                   │
│     - Code review: PASS/issues found            │
│     - If FAIL → stop, report, ask user          │
│                                                 │
│  → Next phase                                   │
└─────────────────────────────────────────────────┘
```

**Code review integration:**
After each phase's split/move, spawn the `code-review` skill (or a `code-reviewer` subagent) targeting ONLY the changed files. This catches:
- Import errors or missing symbols after the split
- ERPNext anti-patterns introduced during refactoring (e.g., `frappe.db.commit()` in wrong place)
- Tech stack violations (ES6, naming, permissions)
- Conflicts between the split files (e.g., shared state assumptions broken)

If code review finds blocking issues → fix them BEFORE the commit.
If code review finds warnings → note them in the phase report, commit anyway.
```

### Python Split Strategies (execute mode)

**Strategy A — Subpackage with stubs (for flat directories >10 files with prefix clusters):**
```
BEFORE:                          AFTER:
utils/                           utils/
├── ai_client.py (850)           ├── ai/                    ← subpackage
├── ai_importer.py (630)         │   ├── __init__.py        ← internal imports
├── ai_parser.py (590)           │   ├── client.py
├── ai_enrichment.py (595)       │   ├── importer.py
...                              │   ├── parser.py
                                 │   └── enrichment.py
                                 ├── ai_client.py            ← THIN STUB (if JS calls it)
                                 ├── ai_importer.py          ← THIN STUB (if JS calls it)
                                 ...
```

Thin stub pattern:
```python
# utils/ai_importer.py (STUB — implementation in utils/ai/importer.py)
# Keep this file so frappe.call() paths don't break
from accubuild_core.module.utils.ai.importer import *  # noqa: F401,F403
```

**Strategy B — Extract helpers (for oversized controller files):**
```
BEFORE:                          AFTER:
doctype/bid/                     doctype/bid/
├── bid.py (1320)                ├── bid.py (~500)          ← keeps @whitelist + lifecycle
                                 ├── bid_helpers.py (~400)  ← extracted internal helpers
                                 ├── bid_conversion.py (~400) ← extracted make_* methods
```

Keep all `@frappe.whitelist()` in `bid.py`. They call helpers:
```python
# bid.py
from .bid_helpers import _build_item_tree, _compute_totals
from .bid_conversion import _create_contract_doc, _create_project_doc

@frappe.whitelist()
def make_contract_from_bid(bid_name):
    return _create_contract_doc(bid_name)
```

**Strategy C — Split in place (for files with no API surface):**
Just split into logical parts, update imports. No stubs needed.

### JS Split Strategies (execute mode)

**Strategy D — Split doctype JS (uses frappe.ui.form.on):**
Frappe accumulates `frappe.ui.form.on()` handlers — multiple files can register events for the same DocType. Split by concern:
```
BEFORE:                              AFTER:
doctype/bid/                         doctype/bid/
├── bid.js (2040)                    ├── bid.js (~600)           ← setup + refresh
                                     ├── bid_actions.js (~500)   ← buttons, conversions
                                     ├── bid_child_tables.js     ← child table handlers

hooks.py addition:
  doctype_js = {
      "Bid": ["path/to/bid_actions.js", "path/to/bid_child_tables.js"],
  }
```

**Strategy E — Split app_include_js files:**
Split large files, add new entries to `app_include_js` in hooks.py.

**Strategy F — Split page JS:**
Keep `on_page_load` in main file. Extract helpers to separate files loaded via `app_include_js` or `frappe.require()`.

### Execute Mode Output (additional sections)

### H) Dependency Map
```
[Full dependency report from Gate 5]
```

### I) Execution Phases
```
Phase 1: [name] — [file count] files — Risk: [level]
  BEFORE: [file list + sizes]
  ACTION: [what will happen]
  AFTER:  [expected file list + sizes]

Phase 2: ...
```

### J) Phase Completion Reports
```
Phase 1: COMPLETE ✓
  Files changed: [list]
  Lines: 1320 → 500 + 420 + 400
  API paths: all verified
  Commit: abc1234

Phase 2: COMPLETE ✓
  ...
```

### K) Final Summary
```
Total files split: N
Total files moved: N
Files >700 before: X → after: 0
Flat directories cleaned: N
API paths preserved: all
Commits: [list]
```

---

## Examples

### Example 1: Fast Mode - Doctype Check
```bash
/clean-code Invoice mode=fast
```

**Output**:
- Basic file structure validation
- Line count check
- JSON validation
- Critical issues only
- Quick wins

### Example 2: Deep Mode - Module Refactor
```bash
/clean-code sales mode=deep style=strict
```

**Output**:
- Comprehensive file analysis
- Split recommendations for oversized files
- Thorough JSON validation
- All issues with severity ratings
- Refactor roadmap with split plans

### Example 3: Deep Mode - File Path
```bash
/clean-code my_app/sales/invoice.py mode=deep
```

**Output**:
- Single file deep analysis
- Function length violations
- Complexity issues
- Split plan if > 500 lines
- Detailed refactor steps

### Example 4: Execute Mode - Full Module Restructure
```bash
/clean-code accubuild_bidding mode=execute
```

**Output + Execution**:
1. Deep analysis of all files in module
2. Dependency map (JS→Python, internal imports, circular deps)
3. Phased execution plan (approval required once)
4. Auto-executes each phase:
   - Split/move files
   - Verify (AST + py_compile)
   - Code review (ERPNext standards check)
   - Match before/after
   - Commit
5. Final summary with all commits

### Example 5: Execute Mode - Specific Directory
```bash
/clean-code accubuild_bidding/utils mode=execute
```

**Output + Execution**:
1. Scans utils/ flat directory (18 files → need subpackages)
2. Maps all `frappe.call()` API surface
3. Plans: create `ai/` and `template/` subpackages
4. Executes phase by phase with code review after each

---

## Checklist

- [ ] Docs/config read and verified
- [ ] File structure validated
- [ ] Code quality checks completed
- [ ] File-length analysis done (deep/execute mode)
- [ ] JSON validation done (if applicable)
- [ ] Recommendations prioritized
- [ ] Implementation plan provided
- [ ] Rollback strategy defined
- [ ] Tests/validation planned

### Execute Mode Additional Checklist
- [ ] Dependency map completed (JS→Python, Python imports, circular deps)
- [ ] Files classified (API-surface vs internal-only)
- [ ] Circular dependencies identified and break plan defined
- [ ] Phased execution plan approved
- [ ] Per-phase loop completed:
  - [ ] BEFORE snapshot taken
  - [ ] Files split/moved
  - [ ] AST + py_compile verification passed
  - [ ] `/code-review` run on changed files — issues fixed
  - [ ] BEFORE/AFTER match confirmed
  - [ ] Phase committed
- [ ] Final summary with all commits reported

### Post-Refactor Verification (Press projects only)
If the project is deployed on Press infrastructure, run the infrastructure health check
after all code changes to verify other features still work:
- [ ] Run `/press-provision health-check` — deploy test script to press-f1, verify all sites accessible
- [ ] Verify no 502/504 regressions on existing sites
- [ ] Verify agent processes still running after any restarts
- [ ] If tests fail, investigate and fix before declaring refactor complete

---

## Config.md Integration

Reads `config.md` for project-specific standards:

```yaml
# From config.md
Development Standards:
  Python line length: 110 (or custom)
  Max function length: 40 (or custom)
  File length soft limit: 500 (or custom)
  File length hard limit: 700 (or custom)
  Pre-commit hooks: Yes/No

JavaScript Standards:
  ES version: ES6+ (mandatory)
  OOP: Classes for non-trivial UI components
  Event cleanup: Mandatory (before_unload / destroy)
  Realtime cleanup: Mandatory (off() for every on())
  var usage: Forbidden (const/let only)

Naming Conventions:
  Field names: lower_snake_case
  DocType names: Title Case
  Custom field prefix: custom_ (if applicable)
```

Applies these standards instead of defaults when present.

---

**Last Updated**: 2026-03-01
**Version**: 4.0 (+ execute mode: dependency mapping, phased auto-execution, code review per phase)
**Dependencies**: config.md (for project standards), codebase access, `/code-review` skill (used in execute mode per phase)

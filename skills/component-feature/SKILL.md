---
name: component-feature
description: Add features to modular component implementations with namespace patterns, state management, and backend integration. Project-agnostic via config.md.
arguments: "request_text"
---

## Input
Target: $ARGUMENTS

**Required**:
- **Component name**: Name of modular component (e.g., "data_grid", "tree_view")
- **Feature description**: What the feature does
- **Affected modules**: Which component modules (view, api, helpers, styles, state, etc.)

**Optional**:
- **mode**: "fast" (default) or "deep"
  - **fast**: Basic feature implementation
  - **deep**: Full feature with optimization, error handling, tests
- **Framework**: DevExtreme, Vue, React (default from config.md)

**Fallback**:
- Modules unclear → Assume view + helpers
- Framework unclear → Read from config.md

---

## Preflight Rules (HARD GATES)

### Gate 1 — Project Docs & Config Check (MANDATORY)
1) Read project docs and config.md
2. Verify component architecture exists
3. Check if feature already exists
4. Flag documentation gaps

### Gate 2 — Minimal Research Loop (MANDATORY)

**Fast Mode (1 pass)**:
- Find similar features in component
- Identify patterns used

**Deep Mode (2 passes)**:
*Pass 1*: Find similar features, identify patterns
*Pass 2*: Find related logic (API, state management, helpers)

Stop after configured passes.

### Gate 3 — Clarifying Questions
Ask ONLY if critical:
- "Does this feature modify data?"
- "Does this need backend persistence?"
- "Does this feature affect state?"

**Defaults**: Read-only, no backend, no state changes

### Gate 4 — Implementation Plan
Before implementing, output:
```
Scope: Add [feature] to [component]
Modules to modify: [list]
Namespace: [namespace from config.md]
Backend: Yes/No
State: Read/Modify
```

---

## Rules

### Component Architecture (from config.md)
Read `config.md` for:
- **Namespace**: Component namespace pattern
- **Framework**: DevExtreme/Vue/React
- **Module structure**: Which modules exist
- **State management**: How state is managed
- **API patterns**: How to call backend

### Component Best Practices
- **Namespace**: All functions under component namespace
- **Modular structure**: Single responsibility per module
- **State management**: Centralized state object
- **Performance**: Virtual scrolling, lazy loading (for large datasets)
- **Minimal changes**: Add new modules, don't modify core

### Docstatus & Workflow (MANDATORY)
- Check document/state before modifications
- Disable edit if submitted/locked
- Validate state transitions

---

## What to do

### Fast Mode
1) Read docs/config (Gate 1)
2) 1-pass research (Gate 2)
3) Ask questions (Gate 3)
4) Output plan (Gate 4)
5) Implement feature:
   - Add/update affected modules
   - Namespace functions
   - Integrate with framework
   - Basic validation

### Deep Mode
1) Read docs/config (Gate 1)
2) 2-pass research (Gate 2)
3) Ask questions (Gate 3)
4) Output plan (Gate 4)
5) Implement feature:
   - Add/update all affected modules
   - Namespace functions
   - Full integration with framework
   - Backend API (if needed)
   - State management updates
   - Performance optimization
   - Error handling
   - Comprehensive tests

---

## Output format

### A) Preflight Results
```
Config.md: Yes/No (component: [name], framework: [framework])
Similar features: [list]
```

### B) Implementation Plan
```
Scope: Add [feature] to [component]

Modules to modify:
- [module1]: [changes]
- [module2]: [changes]

Namespace: [namespace]

Backend: Yes/No
State: Read/Modify

Performance: [optimizations]
```

### C) Awaiting Approval
**Ready to add [feature] to [component]. Proceed?**

---

## Examples

### Example 1: DevExtreme Tree Feature
```bash
/component-feature bid_tree "Add expand all" view,state mode=fast framework=devextreme
```

**Output** (reads config.md):
- Add expand_all function to bid_tree.view
- Update bid_tree.state
- DevExtreme TreeList integration

### Example 2: Vue Data Grid Feature
```bash
/component-feature data_grid "Add bulk edit" api,helpers mode=deep framework=vue
```

**Output** (reads config.md):
- Add bulk_edit to data_grid.api
- Add helper functions to data_grid.helpers
- Vue component integration
- State management updates

---

## Config.md Integration

```yaml
# Example config.md
Component architecture:
  framework: DevExtreme  # or Vue, React
  namespace_pattern: [app]_core.[component].*

Bid Tree:
  modules:
    - view
    - api
    - helpers
    - styles
    - state
    - sidebar
    - toolbar
    - dialogs
  namespace: accubuild_core.bid_tree.*

Data Grid:
  modules:
    - view
    - api
    - helpers
  namespace: accubuild_core.data_grid.*
```

---

## Checklist

- [ ] Docs/config read
- [ ] Similar features analyzed
- [ ] Modules updated
- [ ] Namespace functions added
- [ ] Framework integration complete
- [ ] Backend API added (if needed)
- [ ] State management updated
- [ ] Documentation updated
- [ ] Tested in browser
- [ ] Performance tested

---

**Last Updated**: 2026-01-22
**Version**: 2.0 (Project-Agnostic)
**Dependencies**: config.md (for component patterns), component architecture

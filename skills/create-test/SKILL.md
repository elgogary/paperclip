---
name: create-test
description: >
  TIL (Testing in the Loop) — spec-driven, test-first development with dependency analysis,
  3 mandatory levels (Unit → Integration → System), and blast radius mapping.
  Triggers on: implement feature, fix bug, refactor, TDD, test first, write tests, dependency map, impact analysis.
argument-hint: "task_description"
---

## Input
Target: $ARGUMENTS

**Required**:
- **Task**: What to implement, fix, or refactor
- **Module**: Target module/area

**Optional**:
- **mode**: "fast" (Level 1 only) or "full" (all 3 levels, default)
- **level**: Start at specific level (1/2/3) if lower levels already pass

**Fallback**:
- Task unclear → Ask "What feature/fix/refactor?"
- Module unclear → Search for main targets

---

## Core Philosophy

```
DIAGRAM → SPEC → TEST → IMPLEMENT → GREEN → NEXT LEVEL
```

- Tests define the contract. Code fulfills it.
- A failing test is a TODO. A passing test is a proof.
- 100% green at each level before advancing.
- The dependency diagram is built FIRST — it dictates change order.

---

## Preflight Rules (HARD GATES)

### Gate 1 — Project Docs & Config
1. Read project CLAUDE.md and config.md
2. Check existing test infrastructure (framework, fixtures, patterns)
3. Flag documentation gaps

### Gate 2 — Dependency Diagram (MANDATORY FIRST STEP)

Before writing a single test, generate a Mermaid diagram mapping:
- What file(s) will change (entry point)
- What depends on those files (direct + transitive consumers)
- What those files depend on (imports, DocTypes, APIs, DB tables)
- Direction of impact (who calls whom, who breaks)

See `references/dependency-diagram.md` for templates and annotation rules.

After the diagram, produce a **Change Order Table**:

| # | File | Why it changes | After which change |
|---|------|---------------|-------------------|
| 1 | models/item.py | Data contract changes | — (start here) |
| 2 | api/item_api.py | Uses model, must update | After #1 |
| 3 | frontend/item.js | Calls API, UI update | After #2 |

### Gate 3 — Write ALL Specs Upfront

Write specs for all 3 levels before any implementation:
- Level 1: Unit specs (one per function/class)
- Level 2: Integration specs (per boundary from diagram)
- Level 3: System specs (per user story)

See `references/level-specs.md` for spec templates.

### Gate 4 — Implementation Plan

Output plan before proceeding:
```
Task: [description]
Blast radius: [high/medium/low] — [N files affected]
Change order: [list from table]
Levels: 1 (unit) → 2 (integration) → 3 (system)
Framework: [pytest/unittest/jest/vitest/playwright]
```

**Awaiting approval before proceeding.**

---

## Level 1: Unit Tests

### Rules
- Test ONE unit in isolation (one function, one class, one method)
- Mock ALL external dependencies (DB, API, filesystem, other modules)
- Cover: happy path, edge cases, error cases, boundary values
- Tests written FIRST, then implementation
- 100% branch coverage on the unit under test

### Spec Format
```
UNIT SPEC: <function/class name>
───────────────────────────────
Input:  <what goes in>
Output: <what comes out>
Side effects: <none / list them>

Test cases:
  - happy path: <description>
  - edge case: <empty/null/zero/boundary>
  - error case: <invalid input, exception expected>
  - production edge case: <what could go wrong in prod>
```

### TDD Cycle (per test case)
1. **RED** — Write one failing test
2. **Verify RED** — Run it, confirm it fails for the right reason
3. **GREEN** — Write minimal code to pass
4. **Verify GREEN** — Run it, confirm all tests pass
5. **REFACTOR** — Clean up, keep green

### Framework Selection
| Context | Framework |
|---------|-----------|
| Python / Frappe / ERPNext | pytest + unittest.mock (or FrappeTestCase) |
| JavaScript / Node | jest or vitest |
| React components | @testing-library/react + jest |
| Vue components | @testing-library/vue + vitest |

### Level 1 Gate (must pass before Level 2)
- [ ] All test cases from spec implemented
- [ ] All edge cases AND production edge cases covered
- [ ] No test skipped or marked todo
- [ ] 0 failures, 0 errors
- [ ] 100% branch coverage on changed file(s)

---

## Level 2: Integration Tests

### Definition
Two or more REAL modules talking to each other. No mocks for integrated components.
Only mock what's out of scope (external APIs, email, 3rd-party services).

### Sub-Types

**2a. Frontend <-> Frontend**
- Component A renders Component B, state flows correctly, events propagate

**2b. Frontend <-> Backend**
- Frontend calls real API endpoint, gets real response shape, renders correctly
- Use test database or fixtures, not mocks

**2c. Backend <-> Backend**
- Service A calls Service B, DocType A triggers hooks in DocType B
- Queue jobs process end-to-end

**2d. Backend <-> Database**
- Real queries against test DB, migrations, constraints, rollbacks

### Spec Format
```
INTEGRATION SPEC: <Feature Name>
───────────────────────────────
Components involved: <list>
Real dependencies: <what is NOT mocked>
Mocked dependencies: <what IS mocked and why>

Test cases:
  - data flows from <A> to <B> when <condition>
  - error from <B> handled gracefully by <A>
  - DB state after <action> is <expected state>
```

### Level 2 Gate (must pass before Level 3)
- [ ] All integration boundaries from diagram tested
- [ ] Frontend <-> Backend contract verified (request + response shape)
- [ ] DB state verified after mutations
- [ ] All tests green with real DB (not mocked)
- [ ] No contract mismatch between frontend and backend

---

## Level 3: System Tests (Playwright)

### Definition
Full end-to-end from user's perspective. Real browser, real server, real database. No mocks.

See `references/playwright-setup.md` for config and monitoring setup.

### Monitoring Layer (capture in every test)
- Browser console logs — no unexpected errors
- API request/response — correct status codes, no 500s
- Network timing — no unexpectedly slow requests
- Server logs — no stack traces
- DB state after test — verify records created/updated/deleted

### Spec Format
```
SYSTEM SPEC: <User Story>
───────────────────────────────
As a: <user role>
I want to: <action>
So that: <outcome>

Scenario: <name>
  Given: <initial state>
  When:  <user action>
  Then:  <expected UI state>
  And:   <expected API calls>
  And:   <expected DB state>
  And:   <no errors in logs>
```

### Level 3 Gate (must pass to declare complete)
- [ ] All user scenarios pass in Playwright
- [ ] Zero unexpected 4xx/5xx API responses
- [ ] Zero browser console errors
- [ ] Zero server-side stack traces
- [ ] Screenshots/video attached for happy path
- [ ] DB state after test matches spec

---

## ERPNext/Frappe Specifics

See `references/frappe-patterns.md` for:
- `FrappeTestCase` usage and transaction safety
- Permission testing (`frappe.set_user` + restore)
- Workflow/submit testing (docstatus transitions)
- Validation testing (`assertRaises`)
- `bench run-tests` per level
- Frappe-specific mocking patterns (`frappe.get_doc`, `frappe.db`)
- DocType hook testing patterns

### Transaction Safety (MANDATORY)
- `FrappeTestCase` auto-rollbacks after each test (v15+)
- For v14: manually `frappe.db.rollback()` in tearDown
- Never test on production site

---

## Anti-Patterns (NEVER DO)

| Wrong | Correct |
|-------|---------|
| Test mock behavior | Test real behavior, mock only to isolate |
| Add test-only methods to production | Put cleanup in test utilities |
| Mock without understanding deps | Understand side effects first, mock minimally |
| Incomplete/partial mocks | Mirror real API structure completely |
| Tests as afterthought | Tests FIRST (TDD) |
| Skip Level 1, jump to integration | Each level gates the next |
| Only happy path | Error + edge + boundary + production edge cases |
| Test on production data | Create test data in setUp |
| Not restoring user after set_user | Always restore in tearDown |

---

## Workflow Summary

```
1. RECEIVE TASK
      |
2. GATE 1: Read project docs/config
      |
3. GATE 2: BUILD DEPENDENCY DIAGRAM (Mermaid)
   -> Identify blast radius
   -> Produce change order table
      |
4. GATE 3: WRITE ALL SPECS (L1 + L2 + L3) upfront
      |
5. GATE 4: Output plan, await approval
      |
6. LEVEL 1: Write unit tests -> Implement -> Green
      |
7. LEVEL 2: Write integration tests -> Implement -> Green
      |
8. LEVEL 3: Write Playwright system tests -> Implement -> Green
      |
9. DONE — feature is proven, not assumed
```

**Fast mode**: Stops after Level 1 (unit tests only). Use for isolated changes with no integration boundaries.

---

## Output Format

### A) Dependency Diagram
````markdown
```mermaid
graph TD
  ...
```
````
+ Change Order Table

### B) Specs (all 3 levels)
```
UNIT SPEC: ...
INTEGRATION SPEC: ...
SYSTEM SPEC: ...
```

### C) Level Results (per level)
```
Level [N]: [PASS/FAIL]
Tests: [count] passed, [count] failed
Coverage: [%] branch coverage
```

### D) Final Checklist
- [ ] Dependency diagram produced
- [ ] All specs written upfront
- [ ] Level 1 green (unit)
- [ ] Level 2 green (integration)
- [ ] Level 3 green (system)
- [ ] No anti-patterns
- [ ] Documentation updated

---

## Config.md Integration

```yaml
Test framework: pytest          # or unittest, jest, vitest
Test database: test_db
Fixtures location: tests/fixtures/
Playwright base URL: http://localhost:8000
Test runner: bench run-tests    # or npm test, pytest
```

---

**Last Updated**: 2026-03-10
**Version**: 3.0 (TIL — Testing in the Loop)

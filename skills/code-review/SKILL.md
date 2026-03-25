---
name: code-review
description: Targeted code review with decision tables. Reads wiki + config once, analyzes ONLY specified file/lines. Returns numbered issues with A/B/C options. Pauses after each section for user decisions via AskUserQuestion.
argument-hint: "[section] file:lines [mode=fast|deep]"
---

## Input
Target: $ARGUMENTS

**Required**:
- **file:lines**: Target file with optional line range
  - `my_app/api.py` (full file)
  - `my_app/api.py:50-100` (specific lines)
  - `my_app/module/` (directory — discover key files, ask which to review)

**Optional**:
- **section**: Which aspect to review (see Section Reference). If omitted → ask or auto-detect.
- **mode**: "fast" (default) or "deep"
  - **fast**: 1-pass, critical issues only
  - **deep**: 2-pass with related files, comprehensive

**Fallback behavior**:
- No file specified → Ask for specific file/lines (NEVER scan full project)
- Directory given → Discover primary files, show list, ask which to review
- No section → Auto-detect from code patterns, or ask

---

## STEP 0 — Size Choice (MANDATORY FIRST ACTION)

**Before reading any code**, use AskUserQuestion to ask:

> How thorough should this review be?

| Option | Label | Description |
|--------|-------|-------------|
| A | **BIG CHANGE** (Recommended) | 4 sections (Architecture → Code → Tests → Performance), max 4 issues each. Interactive — pause after each section for your decisions. |
| B | **SMALL CHANGE** | Same 4 sections, but only 1 top issue per section. Faster, focused on the single most impactful finding. |

**This choice controls everything downstream.** Do not skip it. Do not assume.

After user chooses, proceed to Gate 1.

---

## Section Reference

| Section | What to Analyze | Key Signals |
|---------|-----------------|-------------|
| Architecture | Design boundaries, dependencies, dataflow, scaling, SPOF, security boundaries, module coupling | Imports, class hierarchy, API boundaries |
| Code | Organization, DRY violations, error handling, tech debt, over/under-engineering, naming, complexity | Function length, nesting depth, duplication |
| Tests | Coverage gaps, assertion strength, edge cases, failure modes, mock quality, test isolation | Missing test files, weak assertions, no edge cases |
| Performance | N+1 queries, DB patterns, memory leaks, caching opportunities, slow paths, DOM manipulation | Loops with DB calls, missing filters, large datasets |
| Security | Permission bypass, SQL injection, XSS, CSRF, data exposure, input validation, auth gaps | Raw SQL, unvalidated input, missing permission checks |
| All | Run all sections sequentially (deep mode only) | Full review |

---

## Engineering Preferences (ALWAYS APPLY)

These preferences override defaults. Every issue and recommendation must align:

- **DRY > all**: Duplicated logic is always a finding. Extract, don't copy.
- **Extensive tests**: Missing tests for changed code is always a finding.
- **"Engineered enough"**: No fragile hacks, no premature abstraction. Right-sized solutions.
- **Handle all edge cases**: Null checks, empty arrays, boundary conditions, concurrent access.
- **Explicit > clever**: Readability wins. No magic numbers, no implicit behavior.
- **Minimal diff**: Prefer smallest change that solves the problem correctly.

---

## Preflight Rules (HARD GATES)

### Gate 1 — Context Loading (MANDATORY, ONE-TIME)
Read project context sources (read once per session, cache mentally):
1. `config.md` in skill folder or project root (project patterns)
2. `docs/wiki/` or `WIKI/` — architecture, flows (summaries only, never full docs)
3. Project structure — component map from folder layout
4. **Target file/lines ONLY** — never read beyond requested scope

**Token discipline**:
- NEVER read full project or scan all files
- Use wiki summaries, not full documents
- If context not found, note it and proceed with Frappe/ERPNext defaults

### Gate 2 — Scope Validation (MANDATORY)

**Fast Mode (1 pass)**:
- Read target file/lines
- Identify what changed (if reviewing a diff) or what exists (if reviewing existing code)
- Map to relevant section

**Deep Mode (2 passes)**:
*Pass 1*: Read target file/lines, identify code purpose and patterns
*Pass 2*: Check related files (imports, callers, tests) for context — max 3 additional files

Stop after configured passes. Never expand scope without asking.

### Gate 3 — Clarifying Questions (MANDATORY)
Ask ONLY if blocking:
- "This file has no tests. Should I review as-is or flag missing tests?"
- "Lines 50-100 reference a utility not in scope. Should I include it?"
- "Multiple sections apply. Start with Performance or Security?"

If assumptions are safe (follows existing patterns), proceed without asking.

### Gate 4 — Review Scope Confirmation (MANDATORY)
Before analysis, output scope summary:
```
Section: [section]
Target: [file:lines]
Mode: [fast/deep] | Size: [small/big]
Config.md: Applied/Not found
Wiki context: [relevant docs found]
Related files checked: [list or "none — fast mode"]
```
Then proceed to analysis.

---

## Rules (Review Standards)

### ERPNext/Frappe Conventions
- `frappe.throw()` for business logic errors, not raw exceptions
- `@frappe.whitelist()` with permission validation for client-callable methods
- Server-side permission checks before write operations
- `frappe.db.sql` with parameterized queries (never string concatenation)
- Transactions for multi-document operations
- No schema changes without migration/patch plan

**Critical ERPNext Rules (from erpnext-syntax-* skills — always flag violations):**
- `self.field = x` in `on_update` → won't persist (use `frappe.db.set_value()`)
- `frappe.db.commit()` in controller → breaks transaction
- `self.save()` in lifecycle hook → infinite loop
- Missing `super()` in overridden methods → breaks parent logic
- `import` in Server Script → sandbox blocks all imports
- `frappe.db.*` called from client JS → server-only API
- `frappe.get_all()` for user-facing data → bypasses permissions (use `get_list()`)
- `frappe.throw()` in permission hooks → breaks list views (return False/None)
- `set_query` in `refresh` event → should be in `setup`
- `frm.doc.field = value` → not tracked (use `frm.set_value()`)
- Fixture JSON dict missing `"doctype"` key → `KeyError` on `bench migrate` (every dict in `fixtures/*.json` MUST have `"doctype": "TargetDocType"`)

> **Deep reference**: See `erpnext-code-validator` for comprehensive validation checklists

### Project-Specific (from config.md)
Read `config.md` for:
- Budget control patterns (if applicable)
- Hierarchy patterns (parent-child, WBS)
- Shared controller locations
- Client script conventions
- Module boundaries and allowed cross-module imports
- Custom field prefix conventions
- File length limits

### Code Quality Thresholds
- **Function length**: Flag > 40 lines, must-fix > 60 lines
- **File length**: Flag > 400 lines, must-split > 500 lines
- **Nesting depth**: Flag > 3 levels, must-fix > 4 levels
- **Cyclomatic complexity**: Flag > 10, must-fix > 15

---

## What to Do (Step-by-Step Interaction Flow)

### Per-Section Flow (repeats for each section)

1. **Output scope header** (brief, from Gate 4)
2. **Output section explanation** — what this section checks and why it matters
3. **Output decision table** — numbered issues, lettered options, metrics
4. **Output your opinionated recommendation** — which option for each issue and why, mapped to engineering preferences
5. **Use AskUserQuestion** — options are labeled `[#][letter]` so user can pick clearly
6. **STOP. Wait for user response.** Do NOT proceed to next section until user decides.
7. After user decides → move to next section, repeat from step 1.

### Section Order (always this sequence)
1. Architecture → 2. Code Quality → 3. Tests → 4. Performance

If user selected a single section via arguments, run only that section.

### Fast Mode
- 1-pass: Read ONLY target file/lines
- No related files
- Apply section analysis + engineering preferences

### Deep Mode
- 2-pass: Read target + max 3 related files (imports, callers, tests)
- Cross-reference with wiki/docs for architectural alignment
- Deeper analysis per section

---

## Output Format (PER SECTION)

### 1) Scope Header (compact)
```
[Section Name] Review
Target: [file:lines] | Mode: [fast/deep] | Size: [BIG/SMALL]
Config: [Applied/Not found] | Wiki: [relevant doc or "none"]
```

### 2) Section Explanation
Brief paragraph: what this section evaluates, why it matters for this specific code, and what signals you looked for.

### 3) Decision Table (ALWAYS THIS FORMAT)

**BIG CHANGE** — up to 4 rows:

| # | Issue | File:Line | A) RECOMMENDED | B) Alternative | C) Do nothing |
|---|-------|-----------|----------------|----------------|---------------|
| 1 | [concrete problem] | [file:line] | [solution] effort:L risk:L impact:H maint:L | [alt solution] effort:M risk:M impact:M maint:M | [why ok to skip] |
| 2 | ... | ... | ... | ... | ... |

**SMALL CHANGE** — exactly 1 row (the single most impactful finding).

### 4) Opinionated Recommendation
For each issue, state:
- **Which option you recommend** and why
- **How it maps to engineering preferences** (DRY, edge cases, explicit > clever, etc.)
- **What happens if ignored** (concrete consequence, not vague)

### 5) AskUserQuestion (MANDATORY — DO NOT SKIP)

Use AskUserQuestion with options that clearly label issue NUMBER and option LETTER.

**BIG CHANGE example** (4 issues found):
- Option 1: `1A, 2A, 3B, 4A (Recommended)` — accept recommendations with alt for issue 3
- Option 2: `All A` — accept all recommendations
- Option 3: `Skip` — move to next section without changes

**SMALL CHANGE example** (1 issue):
- Option 1: `1A (Recommended)` — [brief description]
- Option 2: `1B` — [brief description]
- Option 3: `1C — Do nothing` — [brief description]

### 6) STOP AND WAIT
**Do NOT output the next section until the user responds.**

---

## After All Sections Complete

Output a consolidated summary:

```
Review Complete
===============
Sections reviewed: [list]
Total issues: [count]
Decisions made: [list of #letter choices]
Pending actions: [what to implement based on choices]
```

Then ask: "Ready to implement the chosen fixes, or review anything further?"

---

## Section-Specific Analysis

### Architecture Section
Focus on:
- Module boundary violations (cross-module imports that shouldn't exist)
- Dependency direction (should flow inward, not outward)
- Single points of failure
- Scalability bottlenecks
- Missing abstraction layers OR premature abstractions
- API surface area (too broad or too narrow)

### Code Section
Focus on:
- DRY violations (duplicated logic across functions/files)
- Function complexity (length, nesting, cyclomatic)
- Error handling gaps (missing try/catch, swallowed errors, generic catches)
- Naming clarity (intent-revealing names, consistent conventions)
- Tech debt markers (TODO, FIXME, HACK, temporary workarounds)
- Over-engineering (abstractions for one-time use)
- Under-engineering (fragile hacks that will break)

### Tests Section
Focus on:
- Missing test coverage for changed/new code
- Weak assertions (assertTrue vs assertEqual, missing edge cases)
- Test isolation (shared state, order-dependent tests)
- Mock quality (over-mocking hides bugs, under-mocking causes flaky tests)
- Edge case coverage (null, empty, boundary, concurrent)
- Error path testing (do tests verify failure modes?)

### Performance Section
Focus on:
- N+1 query patterns (DB calls inside loops)
- Missing database filters (fetching all then filtering in Python)
- Expensive operations in loops (string concatenation, DOM manipulation)
- Missing indexes on frequently filtered fields
- Memory patterns (large list accumulation, missing generators)
- Caching opportunities (repeated expensive computations)
- Client-side: unnecessary re-renders, heavy DOM operations

### Security Section
Focus on:
- Permission bypass (missing `frappe.has_permission()` checks)
- SQL injection (string concatenation in `frappe.db.sql`)
- XSS vulnerabilities (unescaped user input in HTML)
- Data exposure (sensitive fields in API responses)
- Input validation gaps (missing type/range/format checks)
- Authentication gaps (unauthenticated endpoints)

---

## Examples

### Example 1: Default (no section — full interactive review)
```bash
/code-review accubuild_core/api.py:50-100
```
**Flow**:
1. AskUserQuestion: BIG or SMALL?
2. User picks BIG
3. Architecture section → table → AskUserQuestion → user picks → STOP
4. Code Quality section → table → AskUserQuestion → user picks → STOP
5. Tests section → table → AskUserQuestion → user picks → STOP
6. Performance section → table → AskUserQuestion → user picks → STOP
7. Consolidated summary

### Example 2: Single section
```bash
/code-review Performance accubuild_core/api.py:50-100
```
**Flow**:
1. AskUserQuestion: BIG or SMALL?
2. User picks SMALL
3. Performance section → 1 issue table → AskUserQuestion → user picks
4. Done

### Example 3: Deep mode full review
```bash
/code-review accubuild_core/accubuild_bidding/api.py mode=deep
```
**Flow**:
1. AskUserQuestion: BIG or SMALL?
2. User picks BIG
3. Deep analysis (reads target + 3 related files)
4. Architecture → table (4 issues) → AskUserQuestion → STOP
5. Code Quality → table (4 issues) → AskUserQuestion → STOP
6. Tests → table (4 issues) → AskUserQuestion → STOP
7. Performance → table (4 issues) → AskUserQuestion → STOP
8. Consolidated summary with all decisions

---

## Config.md Integration

Reads `config.md` for project-specific review standards:

```yaml
# From config.md
Development Standards:
  Python line length: 110
  Max function length: 40
  Max file length: 500

Architecture Patterns:
  Shared controllers: Yes
  Budget control: Yes
  Module boundaries: [list]

Security Requirements:
  Permission model: Role-based
  API authentication: Token + session
```

Applies project standards instead of defaults when present.

---

## Token Discipline (NON-NEGOTIABLE)

- **NEVER read full project** — only target file/lines + max 3 related files (deep mode)
- **NEVER scan all files** in a directory — ask user to specify
- **Use wiki summaries** — never read full wiki documents
- **Max 4 issues per section** (BIG) or **1 issue** (SMALL) — do not exceed
- **One section at a time** — never output two sections without user response between them
- **AskUserQuestion is mandatory** — never skip the interactive decision step

---

## Checklist (Internal — verify before each section output)

- [ ] Step 0 done: User chose BIG or SMALL
- [ ] Context loaded (config.md + wiki summaries — one-time)
- [ ] Target file/lines read (ONLY target, nothing extra)
- [ ] Section explanation written
- [ ] Decision table generated with numbered issues + lettered options + metrics
- [ ] Opinionated recommendation stated with reasoning mapped to engineering prefs
- [ ] AskUserQuestion called with clearly labeled options
- [ ] STOPPED — waiting for user response before next section

---

**Last Updated**: 2026-02-19
**Version**: 1.2
**Dependencies**: config.md (optional, for project standards), target file access
**Designed for**: Frappe/ERPNext projects (project-agnostic via config.md)

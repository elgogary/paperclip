---
name: review-pr
description: Review PRs/diffs for any ERPNext/Frappe project: conventions, security, performance, test coverage. Project-agnostic with config.md support.
arguments: "PR number branch name file paths mode fast deep"
---

## Input
Target: $ARGUMENTS

**Required**:
- **PR number** (e.g., "123")
- **Branch name** (e.g., "feature/new-invoice-validation")
- **File paths** (e.g., "my_app/sales/invoice/*.py")

**Optional**:
- **mode**: "fast" (default) or "deep"
  - **fast**: Critical issues only, security focus, basic checks
  - **deep**: Comprehensive review, all issues with severity, alternatives

**Fallback behavior**:
- No arguments → Review current git branch (uncommitted changes)
- PR number invalid → Search recent PRs, ask clarification
- File paths invalid → Use current working directory files

---

## Preflight Rules (HARD GATES)

### Gate 1 — Project Docs & Config Check (MANDATORY)
1) Read project documentation:
   - Check `docs/` or `wiki/` or `README.md`
   - Read `config.md` if present (for project patterns)
2) Verify module paths match documented structure
3) If PR introduces new modules/DocTypes not in docs:
   - Flag as documentation gap
   - Require docs update before merge approval

### Gate 2 — Minimal Research Loop (MANDATORY)

**Fast Mode (1 pass)**:
- Get diff/PR files
- Identify changed DocTypes, controllers, client scripts, hooks
- Stop after 1 pass

**Deep Mode (2 passes)**:
*Pass 1*: Get diff/PR files, identify changes
*Pass 2*: Search for related integrations (budget, hierarchy, shared controllers, background jobs)

Stop after configured passes. Flag missing critical context.

### Gate 3 — Clarifying Questions (MANDATORY)
Ask ONLY if critical:
- "Schema changes detected but no migration file. Will you add one?"
- "New whitelisted API method. Should it require specific permissions?"
- "Changes validation logic. Is this intended for all DocTypes or specific?"

If assumptions safe (follows existing patterns), proceed without asking.

### Gate 4 — Review Plan (MANDATORY)
Before detailed review, output:
- Scope: X files changed across Y modules
- Risk Level: Low/Medium/High
- Focus Areas: Security, Performance, Architecture, Tests
- Approach: Will review [specific areas]

Then proceed.

---

## Rules (Engineering Standards)

### General Standards
- Follow project code standards (from config.md or docs)
- Python: PEP 8 with 110 char line length, tabs for indentation
- JavaScript: camelCase, Airbnb style guide
- Prefer minimal, backward-compatible changes

### ERPNext/Frappe Conventions
- Use `frappe.throw()` for business logic errors
- Use `@frappe.whitelist()` for client-callable methods
- Validate permissions before data access
- Use transactions for multi-document operations
- Never break schema without migration plan

### Project-Specific Patterns (from config.md)
Read `config.md` for:
- Budget control requirements (if applicable)
- Hierarchy patterns (if applicable)
- Shared controller locations
- Client script patterns
- Module boundaries

### Security & Performance
- SQL injection, XSS, permission bypass
- N+1 query problems
- Expensive operations in loops
- Input sanitization
- Sensitive data in logs

### Data Integrity
- Atomic operations for financial transactions
- Error handling with rollback
- State transitions (docstatus, workflow)
- Race conditions in concurrent operations

---

## What to do

### Fast Mode
1) Analyze diff structure (file types, intent)
2) Review for correctness (bugs, business logic, error handling)
3) Security review (permissions, SQL injection, XSS)
4) Performance review (N+1 queries, expensive loops)
5) Output critical issues only

### Deep Mode
1) Analyze diff structure (file types, intent)
2) Review for correctness (bugs, business logic, error handling, state management)
3) Security review (permissions, SQL injection, XSS, data exposure)
4) Performance review (N+1, missing filters, DOM manipulations, memory leaks)
5) Architecture review (Frappe patterns, project patterns, code quality)
6) Test coverage review
7) UX review (if applicable)
8) Output all issues with severity ratings and alternatives

---

## Output format

### A) Preflight Results
```
Scope: X files changed across Y modules
Risk Level: Low/Medium/High
Config.md: Yes/No (patterns applied: [list])
Focus areas: [list]
```

### B) File Changes Summary
```
DocType schemas: [list]
Controllers: [list]
Client scripts: [list]
Hooks: [list]
Tests: [list]
Main intent: [description]
```

### C) Review Findings

**Fast Mode**: Critical issues only
**Deep Mode**: All issues with severity

```
Critical (must fix before merge):
- [Issue 1]: [description] → [suggested fix]

High (should fix):
- [Issue 2]: [description] → [suggested fix]

Medium (consider fixing):
- [Issue 3]: [description] → [suggested fix]

Low (nice to have):
- [Issue 4]: [description] → [suggested fix]
```

### D) Security & Performance Issues (Deep Mode)
```
Security:
- [Issue 1]: [description] → Severity: Critical/High

Performance:
- [Issue 1]: [description] → Severity: High/Medium
```

### E) Architecture & Test Coverage (Deep Mode)
```
Architecture:
- Pattern violations: [list]
- Suggestions: [list]

Test Coverage:
- Coverage: X%
- Missing tests: [list]
```

### F) Recommendations
```
Approved: Yes/No/With changes

Required changes:
- [Change 1]
- [Change 2]

Optional improvements:
- [Improvement 1]
- [Improvement 2]

Documentation updates needed:
- [Update 1]
```

---

## Examples

### Example 1: Fast Mode - PR Review
```bash
/review-pr 123 mode=fast
```

**Output**: Critical security issues only, basic correctness, must-fix before merge

### Example 2: Deep Mode - Comprehensive Review
```bash
/review-pr feature/invoice-workflow mode=deep
```

**Output**: Full review with all issues, severity ratings, alternatives, test coverage

---

## Checklist

- [ ] Docs/config read
- [ ] Diff structure analyzed
- [ ] Correctness reviewed
- [ ] Security reviewed
- [ ] Performance reviewed
- [ ] Architecture reviewed (deep mode)
- [ ] Tests reviewed (deep mode)
- [ ] Recommendations provided

---

**Last Updated**: 2026-01-22
**Version**: 2.0 (Project-Agnostic)
**Dependencies**: config.md (for project patterns), git access

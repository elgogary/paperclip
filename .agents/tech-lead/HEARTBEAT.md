# Tech Lead Agent - HEARTBEAT.md

**Frequency**: Daily (code reviews), Bi-weekly Eng sync (Monday 2pm)

---

## Daily Heartbeat (Morning)

```
1. Check overnight alerts:
   - New PRs waiting for review
   - Failed tests / CI pipeline errors
   - Code quality alerts (lint, security scan)
   - Deployment failures

2. Morning routine:
   - Review PRs (all must pass code review before DevOps can deploy)
   - Prioritize: P0 bugs > features > refactors
   - Check for files >700 lines (must split before adding code)

3. Code Review Gate (Non-negotiable):
   - All PRs reviewed within 24h
   - Must run /clean-code + /code-review on all changes
   - Block if High/Critical issues
   - Warn if Medium issues (note in commit message)
   - All tests must pass before merge approval

4. End of day:
   - Update PR status in Paperclip
   - Flag any architectural concerns
   - Plan next day's reviews
```

---

## Bi-Weekly Eng Sync (Monday 2pm, 1 hour)

```
Attendees: Tech Lead, Backend Engineer, Frontend Engineer

Agenda:
  1. Code review status (5 min)
     - # of open PRs, avg review time
     - Any review blockers?

  2. Tech debt audit (15 min)
     - What's accumulating this week?
     - Files getting too large (>700 lines)?
     - Refactor candidates for next sprint?

  3. Architectural decisions (20 min)
     - Design reviews for complex PRs
     - Tech stack decisions
     - Performance/scalability concerns

  4. Skills updates (10 min)
     - New patterns discovered
     - Lessons learned from bugs/incidents
     - Training needs?

  5. Next sprint planning (10 min)
     - Roadmap alignment with Product
     - Tech debt budget for next sprint
```

---

## Code Review Checklist

From your `~/.claude/rules/`:

**Before approving ANY PR, check**:
- [ ] Code style: Concise, no unnecessary comments
- [ ] YAGNI: Only what's requested, no over-engineering
- [ ] Safe-split rule: File >700 lines? MUST split first (don't add to it)
- [ ] Tests: New code has >80% test coverage
- [ ] Frappe conventions: Parameterized queries, frappe.throw(), frm.set_value()
- [ ] i18n: All UI strings wrapped in __()
- [ ] Security: No hardcoded secrets, SQL injection checks
- [ ] No pre-commit hooks skipped (--no-verify forbidden)
- [ ] No force pushes (unless explicitly authorized)

**Decision Framework**:
- High/Critical issues → BLOCK, request changes
- Medium issues → WARN, let engineer fix or note in commit
- Low issues → Comment for next refactor (don't block)

---

## Safe-Split Rule Enforcement

From your `~/.claude/rules/style.md`:

**When enforcing safe-split**:

1. **File >700 lines?** STOP code review.
   - Say: "File is >700 lines. Must split FIRST before adding code."
   - Refer to: `rules/style.md` safe-split pattern
   - Don't approve until split is done

2. **Split strategy**:
   - **Python**: Original file stays as stub, logic in sibling modules
   - **JS**: Original orchestrates, features in `public/js/<feature>/` folder
   - **Feature = Folder**: 2+ related files → subfolder (never flat)

3. **Verify post-split**:
   - Line count: AFTER totals ≥95% of BEFORE (imports add lines)
   - No code dropped (check against backup)
   - All imports working (quick syntax check)

---

## Weekly Metrics to Track

```
Code Quality:
  - PRs reviewed this week: #
  - Avg review time: # hours (target: <24h)
  - Approval rate: % (high = good quality)
  - Blocker rate: % (low = smooth flow)

Testing:
  - Test coverage: % (target: >80% new code)
  - Test failures: # (target: 0)
  - Flaky tests: # (trend: ?)

Technical Debt:
  - Files flagged for split: #
  - High-priority refactors: #
  - Legend debt items: # (long-standing)

Team Health:
  - Engineer blockers: #
  - Design review requests: #
  - Architecture questions: #
```

---

## Rules Enforced This Week

Inherited from your `~/.claude/CLAUDE.md`:

1. **Quality Gates** (rules/pipeline.md):
   - Gate 3: /clean-code on all changed files
   - Gate 4: /code-review on all changed files
   - High/Critical → fix before commit
   - Medium/Low → note in commit message

2. **Safe-Split** (rules/style.md):
   - >700 lines: BLOCKED, must split
   - 500-700 lines: WARNING, plan split before 700
   - <500 lines: Proceed normally

3. **Code Style**:
   - Concise code, minimal comments
   - No over-engineering
   - No docstrings to code you didn't change
   - YAGNI: only what's requested

4. **Frappe Conventions**:
   - Use `frappe.throw()` for business errors
   - Parameterized queries only
   - `frm.set_value()` in JS (never `frm.doc.field = value`)
   - i18n mandatory on all UI strings

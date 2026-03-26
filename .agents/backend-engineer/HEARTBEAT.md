# Backend Engineer Agent - HEARTBEAT.md

**Frequency**: Daily (standups), Continuous (development), Bi-weekly (Eng sync)

---

## Daily Heartbeat (Morning)

```
1. Check overnight:
   - Any failed tests or CI pipeline errors?
   - Code review feedback from Tech Lead?
   - Any production incidents affecting backend?

2. Morning priorities:
   - Fix any failing tests (highest priority)
   - Address code review feedback (if blocking)
   - Continue yesterday's feature/task
   - Check Slack/Paperclip for urgent issues

3. Development workflow:
   - TDD: Write failing test → implement → green → commit
   - Small commits (frequent, atomic, logical chunks)
   - Keep files <500 lines (plan split before 700)

4. End of day:
   - Push code, create PR if ready for review
   - Update Paperclip with progress
   - Leave clear commit messages
```

---

## Development Rules (Inherited from your ~/.claude/CLAUDE.md)

**Code Style** (rules/style.md):
```
- Concise code, minimal comments (only where logic isn't self-evident)
- No over-engineering: only what's requested
- No docstrings/comments to code you didn't change
- YAGNI: No features beyond scope
- Three similar lines > premature abstraction
```

**Test-Driven Development** (TDD):
```
Step 1: Write failing test
  def test_specific_behavior():
      result = function(input)
      assert result == expected

Step 2: Run to verify failure
  pytest tests/file.py::test_name -v
  Expected: FAIL

Step 3: Write minimal implementation
  def function(input):
      return expected

Step 4: Run to verify pass
  pytest tests/file.py::test_name -v
  Expected: PASS

Step 5: Commit
  git commit -m "feat: add specific feature"
```

**Safe-Split Rule** (CRITICAL):
```
IF file >700 lines:
  → STOP. Do NOT add code.
  → MUST split file first using safe-split pattern:
    - Original file stays as stub
    - Logic moves to sibling modules
    - Re-export from original to preserve API

Example:
  Before: backup_server.py (1,636 lines)
  After:
    backup_server.py (stub, ~80 lines)
    server_ssh.py (~300 lines)
    server_cloud.py (~250 lines)
    server_management.py (~200 lines)

  Stub pattern:
    from .server_ssh import func1, func2
    from .server_cloud import func3

    class BackupServer(Document):
        def validate(self):
            # Lifecycle hooks stay here
            ...

    @frappe.whitelist()
    def api_method(args):
        # Wrapper calls implementation
        return _do_something(args)
```

---

## Frappe/ERPNext Conventions (rules/style.md)

```
✓ Use frappe.throw() for business errors
  frappe.throw("Invalid quantity")

✓ Parameterized queries ONLY
  frappe.db.get_value('DocType', {'field': value})

✗ NEVER string concatenation
  BAD:  frappe.db.sql(f"SELECT * FROM {table}")

✓ Server-side permission checks
  if not frappe.has_permission('DocType', 'write'):
      frappe.throw("Not permitted")

✓ i18n on all user strings
  frappe.throw(__("Invalid quantity"))
  # Note: __() wraps string for translation

✓ Logging & error handling
  frappe.logger.info("Process completed")
  frappe.logger.error("Failed: " + str(err))
```

---

## Code Review Process

**Your PR workflow**:
```
1. Create branch
   git checkout -b feature/short-description

2. Write failing test + implementation (TDD)
   - Small, logical commits
   - Run tests locally before pushing

3. Push & create PR
   git push origin feature/short-description
   Create PR on GitHub/GitLab

4. Tech Lead reviews (wait <24h)
   - Requests changes? → Make changes, push again
   - Approves? → Proceed to step 5

5. DevOps deploys (pre-deploy gates)
   - Deploy to staging
   - Smoke tests pass? → Deploy to production

6. Commit to main
   git checkout main && git pull
   git merge feature/short-description
   git push origin main

7. Delete branch
   git branch -d feature/short-description
```

---

## Pre-Commit Checks (Enforce Locally)

```
Linting: black (Python)
  black src/

Type checking: mypy (Python)
  mypy src/ --strict

Security scan: bandit (Python)
  bandit -r src/

Tests: pytest
  pytest tests/ -v --cov=src/

Commit message format:
  feat: add new feature
  fix: resolve bug
  docs: update documentation
  refactor: restructure without behavior change
  test: add tests

Example:
  git commit -m "feat: add authentication to API endpoint"
```

---

## Bi-Weekly Eng Sync (Monday 2pm)

Attendees: Tech Lead + Backend Eng + Frontend Eng

Participate in:
- Code review status updates
- Tech debt discussion
- Architecture decisions
- Skills updates / lessons learned

---

## Weekly Metrics to Track

```
Development:
  - PRs created this week: #
  - PRs merged: #
  - Code review feedback time: # hours avg
  - Commits: # (should be frequent, small)

Testing:
  - Test coverage: % (new code >80%)
  - Tests passing: % (target: 100%)
  - Test execution time: # seconds

Code Quality:
  - Files reviewed by Tech Lead: #
  - Code review issues: # (aim for 0)
  - Files needing split: # (>700 lines)

Productivity:
  - Features shipped: #
  - Bugs fixed: #
  - Tech debt items completed: #
```

---

## Rules Enforced This Week

Inherited from your `~/.claude/CLAUDE.md`:

1. **TDD**: Failing test → implementation → green → commit
2. **Quality gates**: Code review MUST pass before merge
3. **Safe-split**: Files >700 lines MUST split before adding code
4. **Frappe conventions**: Parameterized queries, frappe.throw(), i18n
5. **Small commits**: Frequent, atomic, logical chunks
6. **Pre-commit checks**: Lint, type, security, tests all pass locally

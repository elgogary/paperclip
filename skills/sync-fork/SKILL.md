---
name: sync-fork
description: Use when syncing a forked repo with upstream, reviewing upstream commits before merging, or deciding which upstream changes to adopt. Triggers on fork sync, upstream update, rebase from upstream, cherry-pick upstream.
argument-hint: "upstream=origin/main mode=analyze|review|apply branch=my-branch"
---

## Input
Target: $ARGUMENTS

**Required**:
- **upstream**: The upstream remote/branch to sync from (e.g., `upstream/main`, `origin/develop`)

**Optional**:
- **mode**: `analyze` (default), `review`, or `apply`
  - **analyze**: List upstream commits, map conflict risk, recommend per-commit
  - **review**: Analyze + run `/clean-code` fast + `/code-review` fast on risky commits
  - **apply**: Review + cherry-pick approved commits with verification
- **branch**: Your local branch (default: current branch)
- **since**: Only analyze commits after this date or commit hash
- **limit**: Max commits to analyze (default: all)

**Fallback behavior**:
- No upstream specified: detect from `git remote -v` (look for `upstream` or `origin`)
- No branch: use current HEAD
- If upstream remote not configured: ask user to add it first

---

## Preflight Rules (HARD GATES)

### Gate 0 — Project Context (MANDATORY — read before ANY analysis)

Read project documentation to understand WHY the fork exists and WHAT was customized:

1. **CLAUDE.md** — project conventions, architecture, key decisions
2. **config.md** — project standards (if exists)
3. **DEVLOG.md** — recent work, active tasks, decisions
4. **Wiki/docs** — `docs/wiki/` or `docs/` for architecture, doctype-tree, module guides
5. **Lessons files** — `*-lessons.md` in memory or project root (critical: upstream may fix something you already worked around)
6. **MEMORY.md** — cross-project context from previous sessions

**Why this matters**: If upstream changes something you have a lesson learned about (e.g., you found a bug and built a workaround, upstream now fixes it differently), the skill must flag that match. Without project context, you'll miss these connections.

**Output**:
```
Project context loaded:
- Fork purpose: [why this fork exists]
- Custom surface summary: [what you changed and why]
- Known lessons: [relevant lessons that may intersect with upstream]
- Key conventions: [naming, structure, patterns to check upstream against]
```

### Gate 1 — Fork State Detection (MANDATORY)

```bash
# Find fork point (common ancestor)
git merge-base HEAD <upstream-branch>

# Count upstream commits since fork
git rev-list --count <fork-point>..<upstream-branch>

# Count your commits since fork
git rev-list --count <fork-point>..HEAD

# List files YOU modified (your "custom surface")
git diff --name-only <fork-point>..HEAD
```

**Output**:
```
Fork point: <commit-hash> (<date>)
Upstream commits since fork: N
Your commits since fork: M
Your custom surface: X files across Y modules
```

If upstream has 0 new commits: report "Already up to date" and stop.

### Gate 2 — Custom Surface Map (MANDATORY)

Build a map of every file you touched since the fork point. This is your "protection zone":

```
Custom Surface:
  doctype/bid/bid.py           — 45 lines changed (controller logic)
  doctype/bid/bid.json         — schema: added 3 fields
  utils/template_integration.py — 120 lines changed (new feature)
  hooks.py                     — 8 lines changed (scheduler, doc_events)
  public/js/bid_tree/          — new feature (850 lines)
```

Classify each file:
- **Schema files** (`.json` in `doctype/`): HIGH sensitivity — migrations break easily
- **Controller files** (`.py` in `doctype/`): MEDIUM sensitivity — logic conflicts
- **Hook files** (`hooks.py`): HIGH sensitivity — affects entire app behavior
- **Utility files** (`utils/`): MEDIUM sensitivity — may have API surface
- **Frontend files** (`public/js/`, `.css`): LOW-MEDIUM sensitivity
- **Config/setup files** (`setup.py`, `pyproject.toml`): LOW sensitivity

---

## Per-Commit Analysis (the core loop)

For EACH upstream commit (chronological order):

### Step 1 — Commit Classification

```bash
git show --stat <commit-hash>
git show --format="%s%n%b" --no-patch <commit-hash>
```

Classify the commit:

| Type | Signals | Default risk |
|------|---------|-------------|
| **bugfix** | "fix", "bug", "patch", "hotfix" in message | Low (usually safe to adopt) |
| **feature** | "feat", "add", "new", "implement" | Medium (may conflict with your additions) |
| **refactor** | "refactor", "cleanup", "rename", "move" | Medium-High (may move things you depend on) |
| **schema** | Changes `doctype/**/*.json` | HIGH (always flag) |
| **dependency** | Changes `requirements.txt`, `pyproject.toml`, `package.json` | Low-Medium |
| **docs** | Changes `*.md`, `docs/` | None (safe to adopt) |
| **config** | Changes `hooks.py`, `patches.txt`, fixtures | HIGH (affects app behavior) |
| **test** | Changes `test_*.py`, `tests/` | Low (safe to adopt) |

### Step 2 — Conflict Risk Assessment

Compare commit's changed files against your custom surface:

| Overlap | Risk | Action |
|---------|------|--------|
| **No overlap** — commit touches files you never changed | **None** | Auto-recommend: adopt |
| **Low overlap** — same file but different functions/sections | **Low** | Recommend: adopt (likely clean merge) |
| **Medium overlap** — same file, nearby code sections | **Medium** | Recommend: review diff, then adopt or adapt |
| **High overlap** — same functions/lines modified | **High** | Recommend: manual review required |
| **Schema overlap** — both changed same DocType JSON | **Critical** | MANDATORY manual review — show field-by-field diff |

### Step 3 — Lesson Match Check

Cross-reference the commit against project lessons:
- Does this commit touch code related to a known lesson/workaround?
- Does this commit fix a bug you already fixed differently?
- Does this commit change behavior you explicitly customized?

If match found:
```
LESSON MATCH: Upstream commit abc123 touches [area]
Your lesson: "[lesson description]" (from lessons file)
Impact: Upstream [fixes/changes/removes] what you [worked around/customized]
Action needed: Compare approaches, decide which to keep
```

### Step 4 — DocType JSON Special Gate (schema changes only)

When a commit modifies any `doctype/**/*.json` file:

1. **Extract field-level diff** — not just "file changed" but WHICH fields added/removed/modified
2. **Check against your schema changes** — did you also modify this DocType?
3. **Migration impact** — will this require a bench migrate? Will it conflict with your fields?
4. **Fieldname validation** — does upstream follow `lower_snake_case`? Any collisions with your custom fields?

```
Schema Change Detail:
  DocType: Invoice
  Upstream adds: payment_reference (Data), payment_date (Date)
  You added: custom_payment_ref (Data), custom_pay_date (Date)
  CONFLICT: Upstream adds similar fields to yours
  Risk: HIGH — potential duplicate fields after merge
  Recommendation: ADAPT — adopt upstream naming, migrate your data
```

---

## Quality Review (review mode only)

For commits with **medium+ risk**, spawn review subagents:

### Clean Code Check
Run `/clean-code` fast mode on the upstream commit's diff:
- Does the upstream code meet your project's standards?
- Any anti-patterns? (permissions, N+1 queries, missing cleanup)
- Does it follow the conventions documented in your `config.md`?

### Code Review Check
Run `/code-review` fast mode on the upstream commit's diff:
- Correctness: any bugs in the upstream change?
- Security: SQL injection, XSS, permission bypass?
- Performance: expensive operations?
- ERPNext patterns: proper use of frappe APIs?

**Parallel execution**: For 200+ commits, spawn subagents in batches (5-10 parallel) to review risky commits. Low-risk commits skip review.

### Review Output Per Commit
```
Commit: abc1234 — "fix: invoice total calculation"
Type: bugfix | Risk: medium | Files: 2 overlap with your surface

Clean Code: PASS (no issues)
Code Review: PASS WITH NOTES
  - [low] Missing LIMIT on query at line 45

Lesson Match: YES — you fixed similar bug in commit xyz789
  Your fix: different approach (used set_value)
  Upstream fix: direct SQL update
  Recommendation: COMPARE — your approach may be safer

Overall: ADOPT with minor adaptation
```

---

## Recommendation Report (all modes)

### Summary Table

```
=== SYNC-FORK ANALYSIS ===
Upstream: origin/main (N commits ahead)
Your branch: feature/my-customizations (M commits)
Custom surface: X files

| # | Commit | Type | Risk | Overlap | Lesson | Quality | Recommendation |
|---|--------|------|------|---------|--------|---------|----------------|
| 1 | abc123 | bugfix | none | 0 files | - | - | ADOPT |
| 2 | def456 | feature | low | 1 file | - | PASS | ADOPT |
| 3 | ghi789 | refactor | high | 5 files | YES | NOTES | MANUAL REVIEW |
| 4 | jkl012 | schema | critical | 3 files | YES | - | ADAPT |
| 5 | mno345 | docs | none | 0 files | - | - | ADOPT |
...

Summary:
  ADOPT (safe): 42 commits
  ADOPT (minor touch): 8 commits
  MANUAL REVIEW: 5 commits
  ADAPT: 3 commits
  SKIP: 2 commits
```

### Git Method Recommendation

Based on the analysis, recommend the safest git method:

| Situation | Method | Why |
|---|---|---|
| All commits low risk, < 20 | **rebase** | Clean linear history |
| Mixed risk, some skip/adapt | **cherry-pick** | Selective — only take approved |
| High overlap, many conflicts | **merge with squash** | One commit, easy to revert |
| Schema changes present | **always cherry-pick** | Must verify migration after EACH |

**Default**: Cherry-pick. Slower but safest — you control exactly what enters your branch.

---

## Apply Mode (interactive execution)

After the report is approved, apply commits in order:

### Per-Commit Apply Loop

```
For each APPROVED commit:
  1. BEFORE — snapshot current state (git stash or working tree check)
  2. CHERRY-PICK — git cherry-pick <hash>
  3. CONFLICT CHECK:
     - Clean: proceed to verify
     - Conflict: STOP, show conflict files, ask user to resolve
  4. VERIFY:
     - Syntax check (py_compile for .py, node --check for .js)
     - Schema check (if DocType JSON changed: validate fieldnames)
     - Import check (no broken imports)
  5. TEST (if available):
     - Run related tests if test files exist
  6. REPORT:
     - Files changed
     - Verification: PASS/FAIL
     - If FAIL: stop, show error, ask user
  7. NEXT commit
```

### After All Commits Applied

```
=== SYNC COMPLETE ===
Commits applied: N of M approved
Commits skipped: K (by user choice)
Conflicts resolved: J
Schema changes applied: S (run bench migrate)

Post-sync checklist:
- [ ] Run bench migrate (if schema changes applied)
- [ ] Run bench build (if frontend changes applied)
- [ ] Run tests: bench run-tests --app <app>
- [ ] Clear cache: bench --site <site> clear-cache
- [ ] Review DEVLOG.md — update with sync session
```

---

## Sync Journal (MANDATORY — persistent record)

Every sync session MUST produce a report entry in `SYNC_JOURNAL.md` at the project root. This file is **append-only** — never delete previous entries. It serves as the permanent record of what was synced, skipped, and why.

### File Location
```
project-root/
  SYNC_JOURNAL.md    # Append-only sync history
```

### Entry Format (one per sync session)

```markdown
---

## Sync #N — YYYY-MM-DD

**Upstream**: origin/develop (branch)
**Your branch**: cloudflare-dns
**Fork point**: abc1234 (YYYY-MM-DD)
**Upstream commits analyzed**: 51
**Your commits since fork**: 48
**Method used**: rebase | cherry-pick | merge

### Commit Decisions

| Commit | Message (short) | Type | Risk | Decision | Conflict? | Notes |
|--------|----------------|------|------|----------|-----------|-------|
| abc1234 | fix: login bug | bugfix | none | ADOPTED | No | Clean merge |
| def5678 | feat: new queue | feature | critical | ADOPTED | Yes | Resolved: kept both branding + logic |
| ghi9012 | refactor: move X | refactor | high | SKIPPED | - | Breaks our custom utils/dns.py |
| jkl3456 | chore: update deps | chore | low | ADOPTED | No | - |

### Schema Changes Applied
- `new_bench_queue.json` — NEW DocType (no collision)
- `press_settings.json` — upstream added field, our branding strings preserved

### Schema Changes Skipped
- (none this session)

### Conflicts Resolved
1. `press/press/doctype/site/site.py` — upstream logic change + our branding string. Kept both.
2. `dashboard/src/pages/ReleaseGroupBenchSites.vue` — upstream banner fix + our URL. Kept both.

### Lesson Matches Found
- Commit `1b21069` (new bench queue) relates to **Lesson 22** (developer_mode queue routing). Verified builds still work.

### Post-Sync Verification
- [ ] bench migrate: PASS/FAIL
- [ ] bench build: PASS/FAIL
- [ ] branding intact: PASS/FAIL
- [ ] builds work (developer_mode=1): PASS/FAIL
- [ ] tests: PASS/FAIL

### Summary
Adopted: 48 | Skipped: 2 | Adapted: 1 | Conflicts resolved: 5
Next upstream check recommended: YYYY-MM-DD (2 weeks)
```

### Journal Rules

1. **Append-only** — never edit or delete previous entries
2. **Every commit gets a row** — even "ADOPT with no conflict" gets logged
3. **Decisions column** must be one of: `ADOPTED`, `SKIPPED`, `ADAPTED`, `DEFERRED`
   - `ADOPTED` — taken as-is (clean or with conflict resolution)
   - `SKIPPED` — intentionally not taken (document WHY in Notes)
   - `ADAPTED` — taken but modified to fit your fork (document what changed)
   - `DEFERRED` — will review next sync session (document why deferred)
4. **Skipped commits carry forward** — next sync, the skill reads the journal and flags previously-skipped commits that are still pending
5. **Schema section is mandatory** — even if "none" — so you can quickly scan for migration history
6. **Lesson matches section** — connects sync decisions to project knowledge
7. **Post-sync verification** — filled in AFTER the sync is applied and tested
8. **Number entries sequentially** — Sync #1, #2, #3...

### How the Skill Uses the Journal

On every `/sync-fork` run:
1. **Read `SYNC_JOURNAL.md`** if it exists
2. **Find previously skipped/deferred commits** — flag them in the new analysis
3. **Detect re-occurring patterns** (e.g., "upstream keeps changing site.py, we keep having conflicts")
4. **Set the `since` baseline** — if last sync covered up to commit X, start from X+1
5. **After sync completes** — append the new entry

---

## Examples

### Example 1: Quick Analysis
```
/sync-fork upstream=upstream/main
```
Lists all upstream commits with risk assessment. No code review, no apply. Fast scan.

### Example 2: Full Review Before Major Sync
```
/sync-fork upstream=upstream/version-15 mode=review
```
Analyzes + reviews each risky commit against your project standards. Produces detailed report with quality checks.

### Example 3: Selective Apply
```
/sync-fork upstream=upstream/main mode=apply since=2026-01-01
```
Full pipeline: analyze, review, report, then interactively cherry-pick approved commits since January.

### Example 4: Schema-Focused Check
```
/sync-fork upstream=upstream/main mode=review limit=50
```
Reviews last 50 upstream commits with extra attention to DocType JSON changes.

---

## Common Mistakes

| Mistake | Impact | Prevention |
|---|---|---|
| Merge upstream without checking schema | Duplicate fields, broken migrations | Always run analyze first |
| Skip lesson match check | Adopt upstream fix that conflicts with your workaround | Gate 0 reads lessons files |
| Rebase with schema changes | Migration order breaks | Cherry-pick schema commits individually |
| Ignore "low risk" commits in bulk | One bad commit hides among 50 good ones | Per-commit analysis catches it |
| Sync without reading project docs | Miss context on WHY you customized something | Gate 0 is mandatory |
| Force-push after failed rebase | Lose your custom commits | Apply mode snapshots before each step |

---

## Checklist

- [ ] Project context loaded (CLAUDE.md, wiki, lessons, DEVLOG)
- [ ] Fork state detected (fork point, commit counts, custom surface)
- [ ] Custom surface mapped with sensitivity levels
- [ ] Per-commit analysis complete (type, risk, overlap)
- [ ] Lesson matches flagged
- [ ] DocType JSON changes given special review
- [ ] Quality review done (review/apply modes)
- [ ] Recommendation table produced
- [ ] Git method recommended
- [ ] User approved plan before any apply

### Apply Mode Additional Checklist
- [ ] Each commit cherry-picked individually
- [ ] Conflicts stopped and shown to user
- [ ] Verification after each commit (syntax, imports, schema)
- [ ] Post-sync checklist provided (migrate, build, test, cache)
- [ ] DEVLOG updated with sync session

---

**Last Updated**: 2026-03-09
**Version**: 1.0
**Dependencies**: `/clean-code` (review mode), `/code-review` (review mode), project docs (Gate 0), git access

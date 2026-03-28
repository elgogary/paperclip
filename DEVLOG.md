# Paperclip Dev Log

## Working State
**Session:** Project Cleanup + Split Backlog | **Date:** 2026-03-28
**Branch:** `main-sanad-eoi-app` (merged from refactor/clean-code-split)

### Completed
- [x] Wave 1: Shared YAML parser + skill keys to @paperclipai/shared
- [x] Task 2: heartbeat.ts (3899 → 8 modules, $ bag pattern)
- [x] Task 3: company-portability.ts (4088 → 7 modules)
- [x] Task 4: company-skills.ts (2203 → 4 files)
- [x] Tasks 5-6: issues.ts (1727 → 4) + workspace-runtime.ts (1564 → 3)
- [x] Tasks 7-9: Route splits — access (2908 → 6), agents (2324 → 5), issues (1636 → 5)
- [x] Tasks 10+12: AgentDetail.tsx (4053 → 9) + NewIssueDialog.tsx (1472 → 6)
- [x] Task 13: CLI worktree.ts (2585 → 4)
- [x] Code review: 4 architecture + 4 DRY fixes
- [x] Test fixes: 10 broken imports + 5 missing constants + parseGitHubSourceUrl
- [x] Strict TS fixes for Docker build
- [x] Pre-deploy smoke test suite (33 tests)
- [x] Deploy to Hetzner (65.109.65.159:3100) — healthy
- [x] DB restore from backup (all data intact)
- [x] Full backup: DB dump + app tar + Docker volumes

### Key Files
**`scripts/pre-deploy.sh`** — Run before every deploy. TS check + 33 smoke tests.
**`server/src/__tests__/pre-deploy-smoke.test.ts`** — Verifies all split module wiring.
**`server/src/__tests__/heartbeat-wiring.test.ts`** — Verifies heartbeat $ bag (19 tests).

### Backup Location (Hetzner)
```
/home/eslam/docker-backups/
  paperclip-postgres-20260327-002630.sql   (7.0 MB — DB dump)
  full/
    paperclip-app-20260327-002630.tar.gz   (4.2 MB — app code)
    pgdata-20260327-002630.tar.gz          (14 MB — PG volume)
    minio-data-20260327-002630.tar.gz      (4.7 KB — MinIO volume)
```
- [ ] Tasks 7-13: Route files + UI + CLI (see plan)

### Key Files (current shape)
**`server/src/services/heartbeat.ts`** (MODIFIED, 305 lines)
Thin factory stub. Creates service instances, initializes modules via `createXxxOps(db, $)`,
populates shared `$` context bag, returns public API. All closures moved to sibling modules.

**`server/src/services/heartbeat-helpers.ts`** (NEW, 745 lines)
Pure helpers, types, constants, exported test-facing utility functions.

**`docs/plans/2026-03-26-large-file-splitting.md`** (reference plan)

### Decisions
- **$ bag pattern**: Modules share a mutable context object instead of sub-factories with explicit deps.
  Avoids circular dependency issues. Populated incrementally; functions resolved at runtime.
- **heartbeat-execution.ts at 975 lines**: Single `executeRun` function cannot be further split
  without decomposing the function itself. Accepted as-is.

### Next Steps
1. Pop portability stash: `git stash pop`
2. Rewrite company-portability.ts as stub importing from portability-*.ts
3. Type check + fix
4. Continue with company-skills.ts (Task 4)

### Watch Out
- Portability modules have some over-700 files (import=1049, manifest=911, export=901, skills=830)
- Need to re-check if subagents duplicated types that should be imported
- Test file `company-portability.test.ts` imports `parseGitHubSourceUrl` directly — must re-export

### Branch Strategy
```
master               → clean upstream mirror (reset to upstream/master db3883d2)
feature/multimodal-attachments → our working dev branch (all work + 35 bug fixes)
main-sanad-eoi-app   → our production fork branch (mirrors feature/multimodal-attachments)
```
**Rule:** Always cherry-pick onto `feature/multimodal-attachments` first, then fast-forward `main-sanad-eoi-app`.

### Key Files (Sanad Brain Integration — DO NOT BREAK)
- `server/src/routes/sanad-brain.ts` — Brain proxy, SANAD_BRAIN_URL + SANAD_BRAIN_API_KEY
- `server/src/services/scheduler-loop.ts` — 60s loop, calls executeKnowledgeSync/executeDream/executeMemoryIngest
- `server/src/services/scheduled-job-executors.ts` — Brain API calls: /knowledge/sync, /dream/trigger, /memory/queue/status
- `server/src/routes/scheduled-jobs.ts` — Brain job triggers via REST
- `server/src/app.ts` — mounts sanadBrainRoutes at line 149

### Cherry-Pick Conflict Patterns (lessons from 35 bug fixes)
1. **pnpm-lock.yaml** → ALWAYS keep ours: `git checkout --ours pnpm-lock.yaml`
2. **modify/delete test files** → upstream adds tests to files we deleted: `git checkout --theirs <file>`
3. **issues.ts** → accept `--theirs` for mention/entity fixes; verify no Brain code lost after
4. **codex test.ts** → 4 sequential patches on same file, accept `--theirs` each time
5. **MarkdownEditor.tsx / MarkdownBody.tsx** → accept `--theirs` (upstream UI improvements)
6. **Empty commit** → `git cherry-pick --skip` (already applied via earlier commit)
7. **Dockerfile conflict** → keep BOTH lines: our custom line + upstream's new line

### What Cherry-Picks Are Safe (won't touch Brain)
- issues.ts mention/entity decoding — no Brain code in issues.ts ✅
- agents.ts instructions/adapter fix — no Brain code in agents.ts ✅
- UI files (MarkdownEditor, mention-chips) — frontend only ✅
- Codex adapter — isolated adapter, no Brain dependency ✅

### Remaining Feature Commits to Review (Phase 7)
```
36. 44fbf831  Preserve task assignment grants for joined agents
37. eb73fc74  Seed onboarding project and issue goal context
38. c4838cca  Render join requests inline in inbox
39. 5561a9c1  Improve CLI API connection errors
40. 2daae758  Include all agents on heartbeats page regardless of interval
41. 0bb1ee3c  Recover agent instructions from disk
42. 3b2cb3a6  Show all companies' agents on instance heartbeats page
43. eac3f3fa  Honor explicit failed-run session resume
44. 02c779b4  Use issue participation for agent history
45. e61f00d4  Add missing data-slot="toggle" to Routines toggle buttons
46. 61f53b64  feat: add ReportsToPicker for agent management
47. 5a735568  Use positional source arg for company import
48. 5dfdbe91  Add merge-history project import option
49. e6df9fa0  Support GitHub shorthand refs for company import
50. 37c2c4ac  Add browser-based board CLI auth flow
```

### Watch Out
- NEVER let cherry-picks touch: sanad-brain.ts, scheduler-loop.ts, scheduled-job-executors.ts
- After each cherry-pick session → fast-forward main-sanad-eoi-app to match
- Before deploying → rebuild on Hetzner: `docker build -t paperclip-server . && docker compose up -d server`
- Deployment branch: `main-sanad-eoi-app`

---

## Session Archive

### Session: Multimodal Attachments — 2026-03-25
**What we did:** Full multimodal attachment pipeline — DB schema, chunked upload API, media-worker (ffmpeg+LibreOffice), AttachmentCard UI, agent vision blocks, docs. Merged feature/chat-ui + feature/scheduled-jobs into feature/multimodal-attachments.
**Files:** server/src/routes/attachments.ts, server/src/services/attachment-context.ts, ui/src/components/attachments/*, docker/media-worker/*, packages/db/migrations/0044
**Decisions:** MinIO storage, media-worker as separate Docker service with health check

### Session: Branch Cleanup + Upstream Bug Fixes — 2026-03-25
**What we did:** Cleaned merge artifacts, deleted old branches, created main-sanad-eoi-app, reset master to upstream mirror, cherry-picked all 35 upstream bug fixes without breaking Brain integration.
**Files:** Dockerfile, server/src/services/issues.ts, server/src/routes/agents.ts, ui/src/components/MarkdownEditor.tsx, ui/src/lib/mention-chips.ts, patches/embedded-postgres patch
**Decisions:** pnpm-lock.yaml always ours; accept upstream UI/test files; Brain files never touched

---

## Milestones
- [x] Multimodal attachments (upload, process, agent vision)
- [x] Scheduled jobs + Toolkit + Skills evolution
- [x] Sanad Brain integration (memory, knowledge sync, dream engine)
- [x] Branch strategy established (master=upstream, main-sanad-eoi-app=production)
- [ ] Upstream feature cherry-picks (in progress)
- [ ] Docker rebuild + Hetzner deploy with all fixes

## Mistakes & Lessons

### 2026-03-25 — pnpm-lock.yaml always conflicts
**Root cause:** Our lockfile diverged from upstream (merged 3 branches + added packages).
**Fix:** Always `git checkout --ours pnpm-lock.yaml` in every cherry-pick.

### 2026-03-25 — Two docs systems exist
**Root cause:** /docs/*.md = Mintlify external. ui/src/pages/docs-content.ts = in-app compiled bundle.
**Fix:** In-app /docs updates must go into docs-content.ts, not .md files.

### 2026-03-25 — Plugin error banner on every page
**Root cause:** Upstream plugin runtime deleted but UI still calls GET /plugins/ui-contributions.
**Fix:** Stub route in server/src/routes/plugins.ts returning [].

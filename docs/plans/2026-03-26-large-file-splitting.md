# Large File Splitting Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Split all 12 files exceeding 2000 lines (and 5 files in the 1400-1700 range) down to <700 lines each, using the safe-split strategy — original files become thin stubs, zero downstream breakage.

**Architecture:** Each file keeps its original path as a stub that re-exports from new sibling/child modules. All imports, route mounts, and service factory calls remain unchanged. New modules are organized by concern, not by arbitrary line-count splits.

**Tech Stack:** TypeScript, Express.js, React 19, Drizzle ORM, TanStack Query

**Priority Order:** Files are ordered by risk × size. Server services first (most callers), then routes, then UI, then CLI.

---

## Wave 1: Shared Infrastructure (unblocks Waves 2-3)

### Task 1: Extract shared YAML parser (`packages/shared`)

Both `company-portability.ts` and `company-skills.ts` contain **identical copies** of: `parseYamlScalar`, `parseYamlBlock`, `prepareYamlLines`, `parseYamlFrontmatter`, `parseFrontmatterMarkdown`, `asString`, `isPlainRecord`, `normalizePortablePath`. Also duplicated: `normalizeSkillSlug`, `normalizeSkillKey`, `hashSkillValue`, `fetchText`, `fetchJson`, `resolveRawGitHubUrl`, `parseGitHubSourceUrl`.

**Files:**
- Create: `packages/shared/src/yaml-parser.ts` (~200 lines)
- Create: `packages/shared/src/skill-keys.ts` (~80 lines)
- Create: `packages/shared/src/github-source.ts` (~120 lines)
- Modify: `packages/shared/src/index.ts` (add re-exports)
- Modify: `server/src/services/company-portability.ts` (replace inline copies with imports)
- Modify: `server/src/services/company-skills.ts` (replace inline copies with imports)

**Step 1: Create `packages/shared/src/yaml-parser.ts`**

Extract these functions (copy from `company-skills.ts` lines 325-441 as the canonical source):
```typescript
// yaml-parser.ts — Lightweight YAML front-matter parser for SKILL.md / COMPANY.md files
export function asString(v: unknown): string | null { ... }
export function isPlainRecord(v: unknown): v is Record<string, unknown> { ... }
export function normalizePortablePath(p: string): string { ... }
export function parseYamlScalar(raw: string): string | number | boolean | null { ... }
export function prepareYamlLines(block: string): string[] { ... }
export function parseYamlBlock(lines: string[], startIndent?: number): Record<string, unknown> { ... }
export function parseYamlFrontmatter(raw: string): Record<string, unknown> { ... }
export function parseFrontmatterMarkdown(raw: string): { frontmatter: Record<string, unknown>; body: string } { ... }
```

**Step 2: Create `packages/shared/src/skill-keys.ts`**

Extract from `company-skills.ts` lines 178-206:
```typescript
export function normalizeSkillSlug(s: string): string { ... }
export function normalizeSkillKey(key: string): string { ... }
export function hashSkillValue(value: string, length?: number): string { ... }
```

**Step 3: Create `packages/shared/src/github-source.ts`**

Extract from `company-skills.ts` lines 458-539 + `company-portability.ts` lines 1901-1958:
```typescript
export function fetchText(url: string): Promise<string> { ... }
export function fetchJson(url: string): Promise<unknown> { ... }
export function parseGitHubSourceUrl(url: string): { owner: string; repo: string; ref?: string; path?: string } { ... }
export function resolveRawGitHubUrl(owner: string, repo: string, ref: string, path: string): string { ... }
```

**Step 4: Update `packages/shared/src/index.ts`**

```typescript
export * from "./yaml-parser.js";
export * from "./skill-keys.js";
export * from "./github-source.js";
```

**Step 5: Replace inline copies in both service files**

In `company-skills.ts`, replace lines 145-541 with:
```typescript
import { asString, isPlainRecord, normalizePortablePath, parseFrontmatterMarkdown, parseYamlFrontmatter, parseYamlBlock } from "@paperclipai/shared";
import { normalizeSkillSlug, normalizeSkillKey, hashSkillValue } from "@paperclipai/shared";
import { fetchText, fetchJson, parseGitHubSourceUrl, resolveRawGitHubUrl } from "@paperclipai/shared";
```

In `company-portability.ts`, replace the identical functions with the same imports. Keep any portability-specific YAML **render** functions (they only exist in portability).

**Step 6: Run tests**

```bash
cd /home/eslam/data/projects/paperclip
pnpm -C packages/shared build
pnpm -C server build
pnpm vitest run server/src/__tests__/company-skills.test.ts server/src/__tests__/company-portability.test.ts
```

**Step 7: Commit**

```bash
git add packages/shared/src/yaml-parser.ts packages/shared/src/skill-keys.ts packages/shared/src/github-source.ts packages/shared/src/index.ts server/src/services/company-portability.ts server/src/services/company-skills.ts
git commit -m "refactor: extract shared YAML parser, skill keys, and GitHub source utils to @paperclipai/shared"
```

---

## Wave 2: Server Services (highest risk, most callers)

### Task 2: Split `heartbeat.ts` (3880 → 7 files, ~400-600 each)

The heartbeat service is a single factory function containing ~3100 lines of closures. Split by concern into sibling modules. The factory stays in `heartbeat.ts` and delegates to imported functions.

**Files:**
- Create: `server/src/services/heartbeat-helpers.ts` (~300 lines)
- Create: `server/src/services/heartbeat-session.ts` (~400 lines)
- Create: `server/src/services/heartbeat-workspace.ts` (~350 lines)
- Create: `server/src/services/heartbeat-execution.ts` (~600 lines)
- Create: `server/src/services/heartbeat-wakeup.ts` (~600 lines)
- Create: `server/src/services/heartbeat-cancellation.ts` (~250 lines)
- Modify: `server/src/services/heartbeat.ts` (stub, ~500 lines)

**Split map:**

| New file | Functions moved | Source lines |
|---|---|---|
| `heartbeat-helpers.ts` | `deriveRepoNameFromRepoUrl`, `appendExcerpt`, `normalizeMaxConcurrentRuns`, `withAgentStartLock`, `normalizeLedgerBillingType`, `resolveLedgerBiller`, `normalizeBilledCostCents`, `resolveLedgerScopeForRun`, `normalizeUsageTotals`, `readRawUsageTotals`, `deriveNormalizedUsageDelta`, `isProcessAlive`, `isTrackedLocalChildProcessAdapter`, `heartbeatRunListColumns`, types/interfaces | 80-767 (pure helpers) |
| `heartbeat-session.ts` | `buildExplicitResumeSessionOverride`, `parseSessionCompactionPolicy`, `resolveRuntimeSessionParamsForWorkspace`, `shouldResetTaskSessionForWake`, `formatRuntimeWorkspaceWarningLog`, `defaultSessionCodec`, `getAdapterSessionCodec`, `normalizeSessionParams`, `resolveNextSessionState`, `evaluateSessionCompaction` (closure), `resolveSessionBeforeForWakeup` (closure), `resolveExplicitResumeSessionOverride` (closure), `resolveNormalizedUsageForSession` (closure) | 336-508, 543-558, 685-999 |
| `heartbeat-workspace.ts` | `ensureManagedProjectWorkspace`, `prioritizeProjectWorkspaceCandidatesForRun`, `resolveWorkspaceForRun` (closure), `upsertTaskSession` (closure), `clearTaskSessions` (closure) | 93-143, 255-263, 1078-1354 |
| `heartbeat-execution.ts` | `executeRun` (the ~900 line function), `setRunStatus`, `appendRunEvent`, `nextRunEventSeq`, `persistRunProcessMetadata`, `enqueueProcessLossRetry`, `parseHeartbeatPolicy`, `countRunningRunsForAgent`, `claimQueuedRun`, `startNextQueuedRunForAgent`, `finalizeAgentStatus` | 1372-1939, 1941-2835 |
| `heartbeat-wakeup.ts` | `enqueueWakeup`, `enrichWakeContextSnapshot`, `mergeCoalescedContextSnapshot`, `deriveTaskKey`, `deriveCommentId`, `releaseIssueExecutionAndPromote` | 528-648, 2837-3484 |
| `heartbeat-cancellation.ts` | `cancelRunInternal`, `cancelActiveForAgentInternal`, `cancelBudgetScopeWork`, `cancelPendingWakeupsForBudgetScope`, `listProjectScopedRunIds`, `listProjectScopedWakeupIds` | 3486-3683 |
| `heartbeat.ts` (stub) | `heartbeatService` factory (imports from above, wires closures, returns public API), `reapOrphanedRuns`, `resumeQueuedRuns`, `tickTimers`, `getRun`, `getRuntimeState`, `list`, `listEvents`, `readLog`, `getActiveRunForAgent` | Remaining + return object |

**Pattern for closures:** Since many internal functions need the `db` handle, each extracted module exports a factory or accepts `db` as a parameter:

```typescript
// heartbeat-session.ts
import type { DbHandle } from "./heartbeat-helpers.js";

export function createSessionOps(db: DbHandle) {
  return {
    evaluateSessionCompaction(...) { ... },
    resolveSessionBeforeForWakeup(...) { ... },
    resolveExplicitResumeSessionOverride(...) { ... },
  };
}
```

The stub factory wires them together:
```typescript
// heartbeat.ts (stub)
import { createSessionOps } from "./heartbeat-session.js";
import { createWorkspaceOps } from "./heartbeat-workspace.js";
import { createExecutionOps } from "./heartbeat-execution.js";
import { createWakeupOps } from "./heartbeat-wakeup.js";
import { createCancellationOps } from "./heartbeat-cancellation.js";

export function heartbeatService(db: DbHandle) {
  const session = createSessionOps(db);
  const workspace = createWorkspaceOps(db);
  const execution = createExecutionOps(db, session, workspace);
  const wakeup = createWakeupOps(db, execution);
  const cancellation = createCancellationOps(db);
  // ... return public API using these
}
```

**Standalone exports stay in `heartbeat-helpers.ts`** — they're already imported by tests directly.

**Step 1: Create `heartbeat-helpers.ts`** — move all pure helpers + types

**Step 2: Run test to verify**
```bash
pnpm vitest run server/src/__tests__/heartbeat-workspace-session.test.ts -v
```

**Step 3: Commit**
```bash
git commit -m "refactor(heartbeat): extract pure helpers and types to heartbeat-helpers.ts"
```

**Step 4-15: Repeat for each module** (session → workspace → execution → wakeup → cancellation), test after each.

**Step 16: Verify line counts**
```bash
wc -l server/src/services/heartbeat*.ts
```
Expected: no file >700 lines. Total ≥95% of original 3880.

**Step 17: Final commit**
```bash
git commit -m "refactor(heartbeat): complete split into 7 concern-based modules"
```

---

### Task 3: Split `company-portability.ts` (3299 → 5 files)

After Task 1 removes ~400 lines of duplicated parsers, ~2900 lines remain.

**Files:**
- Create: `server/src/services/portability-yaml-render.ts` (~350 lines)
- Create: `server/src/services/portability-export.ts` (~600 lines)
- Create: `server/src/services/portability-import.ts` (~600 lines)
- Create: `server/src/services/portability-helpers.ts` (~400 lines)
- Modify: `server/src/services/company-portability.ts` (stub, ~300 lines)

**Split map:**

| New file | Functions | Concern |
|---|---|---|
| `portability-yaml-render.ts` | `renderYamlScalar`, `renderYamlBlock`, `renderFrontmatter`, `buildMarkdown`, `buildYamlFile`, `orderedYamlEntries`, `compareYamlKeys`, `stripEmptyValues`, `isEmptyObject`, `isEmptyArray` | YAML serialization (render direction — parse lives in shared) |
| `portability-helpers.ts` | `classifyPortableFileKind`, `isSensitiveEnvKey`, `normalizePortableConfig`, `extractPortableEnvInputs`, `pruneDefaultLikeValue`, `jsonEqual`, `isPathDefault`, `resolveImportMode`, `resolveSkillConflictStrategy`, binary/buffer helpers, include/env reader helpers, `buildOrgTreeFromManifest` | Classification, validation, binary I/O, org tree |
| `portability-export.ts` | `exportBundle`, `previewExport`, skill export dir mapping (`buildSkillExportDirMap`, `derivePrimarySkillExportDir`, etc.), skill content builders (`buildSkillSourceEntry`, `buildReferencedSkillMarkdown`, `withSkillSourceMetadata`), `filterExportFiles`, `applySelectedFilesToSource`, `collectSelectedExportSlugs` | Everything export-related |
| `portability-import.ts` | `buildManifestFromPackageFiles`, `buildPreview`, `importBundle`, collision/rename helpers (`toSafeSlug`, `uniqueSlug`, `uniqueNameBySlug`, `uniqueProjectName`), `normalizeFileMap`, `pickTextFiles` | Everything import-related |
| `company-portability.ts` (stub) | `companyPortabilityService` factory wiring, `parseGitHubSourceUrl` re-export, GitHub source resolution (`resolveSource`) | Entry point + factory |

**Same commit-per-file pattern as Task 2.**

---

### Task 4: Split `company-skills.ts` (2321 → 4 files)

After Task 1 removes ~400 lines of duplicated code, ~1900 lines remain.

**Files:**
- Create: `server/src/services/skill-import-sources.ts` (~500 lines)
- Create: `server/src/services/skill-inventory.ts` (~400 lines)
- Create: `server/src/services/skill-resolution.ts` (~300 lines)
- Modify: `server/src/services/company-skills.ts` (stub, ~500 lines)

**Split map:**

| New file | Functions | Concern |
|---|---|---|
| `skill-import-sources.ts` | `extractCommandTokens`, `parseSkillImportSourceInput`, `resolveBundledSkillsRoot`, `deriveImportedSkillSlug`, `deriveImportedSkillSource`, `readInlineSkillImports`, `walkLocalFiles`, `statPath`, `collectLocalSkillInventory`, `readLocalSkillImportFromDirectory`, `readLocalSkillImports`, `readUrlSkillImports`, `resolveGitHubDefaultBranch`, `resolveGitHubCommitSha`, `resolveGitHubPinnedRef`, `matchesRequestedSkill`, `discoverProjectWorkspaceSkillDirectories` | Reading skills from local paths, URLs, GitHub |
| `skill-inventory.ts` | `classifyInventoryKind`, `deriveTrustLevel`, `inferLanguageFromPath`, `isMarkdownPath`, `readCanonicalSkillKey`, `deriveCanonicalSkillKey`, `buildSkillRuntimeName`, `uniqueSkillSlug`, `uniqueImportedSkillKey`, `toCompanySkill`, `serializeFileInventory`, `findMissingLocalSkillIds` | Classification, naming, DB mapping |
| `skill-resolution.ts` | `resolveSkillReference`, `resolveRequestedSkillKeysOrThrow`, `resolveDesiredSkillKeys`, `getSkillMeta`, `deriveSkillSourceInfo`, `enrichSkill`, `toCompanySkillListItem`, path helpers (`normalizeSkillDirectory`, `normalizeSourceLocatorDirectory`, `resolveManagedSkillsRoot`, `resolveLocalSkillFilePath`) | Lookup, resolution, enrichment |
| `company-skills.ts` (stub) | `companySkillService` factory, `ensureBundledSkills`, `pruneMissingLocalPathSkills`, `ensureSkillInventoryCurrent`, service methods that stay thin | Factory + DB-heavy CRUD |

---

### Task 5: Split `issues.ts` service (1691 → 3 files)

**Files:**
- Create: `server/src/services/issue-comments.ts` (~200 lines)
- Create: `server/src/services/issue-attachments.ts` (~250 lines)
- Create: `server/src/services/issue-checkout.ts` (~250 lines)
- Modify: `server/src/services/issues.ts` (stub, ~700 lines)

**Split map:**

| New file | Functions |
|---|---|
| `issue-comments.ts` | `listComments`, `getCommentCursor`, `getComment`, `addComment` |
| `issue-attachments.ts` | `createAttachment`, `listAttachments`, `getAttachmentById`, `removeAttachment` |
| `issue-checkout.ts` | `checkout`, `assertCheckoutOwner`, `release` |
| `issues.ts` (stub) | `list`, `countUnreadTouchedByUser`, `markRead`, `getById`, `getByIdentifier`, `getAncestors`, `create`, `update`, `remove`, labels, mentions + factory wiring |

---

### Task 6: Split `workspace-runtime.ts` (1564 → 3 files)

**Files:**
- Create: `server/src/services/workspace-provision.ts` (~350 lines)
- Create: `server/src/services/runtime-services.ts` (~500 lines)
- Modify: `server/src/services/workspace-runtime.ts` (stub, ~400 lines)

**Split map:**

| New file | Functions |
|---|---|
| `workspace-provision.ts` | `realizeExecutionWorkspace`, `cleanupExecutionWorkspaceArtifacts` — git worktree creation/teardown |
| `runtime-services.ts` | `startLocalRuntimeService`, `stopRuntimeService`, `registerRuntimeService`, `ensureRuntimeServicesForRun`, `releaseRuntimeServicesForRun`, `stopRuntimeServicesForExecutionWorkspace`, module-level maps, `reconcilePersistedRuntimeServicesOnStartup`, `persistAdapterManagedRuntimeServices` — in-process service lifecycle |
| `workspace-runtime.ts` (stub) | Types/interfaces, `sanitizeRuntimeServiceBaseEnv`, `normalizeAdapterManagedRuntimeServices`, `listWorkspaceRuntimeServicesForProjectWorkspaces`, `buildWorkspaceReadyComment`, re-exports |

---

## Wave 3: Server Routes

### Task 7: Split `access.ts` route (2901 → 4 files)

**Files:**
- Create: `server/src/routes/access-auth.ts` (~300 lines)
- Create: `server/src/routes/access-invites.ts` (~500 lines)
- Create: `server/src/routes/access-members.ts` (~250 lines)
- Create: `server/src/routes/access-skills.ts` (~150 lines)
- Modify: `server/src/routes/access.ts` (stub, ~200 lines)

**Split map:**

| New file | Routes | Lines |
|---|---|---|
| `access-auth.ts` | Board claim (2), CLI auth challenges (6), admin user promotion (4) | 1576-1775, 2858-2898 |
| `access-invites.ts` | Create invite, OpenClaw invite, lookup, onboarding, accept, revoke (8) | 1905-2517 |
| `access-members.ts` | Join requests list/approve/reject, claim-api-key, members list/update (6) | 2519-2856 |
| `access-skills.ts` | Skills available/index/detail (3) | 1878-1903 |
| `access.ts` (stub) | `accessRoutes` factory mounts sub-routers, passes `db` + `opts` | Wiring only |

**Stub pattern:**
```typescript
// access.ts — route orchestrator
import { accessAuthRoutes } from "./access-auth.js";
import { accessInviteRoutes } from "./access-invites.js";
import { accessMemberRoutes } from "./access-members.js";
import { accessSkillRoutes } from "./access-skills.js";

export function accessRoutes(db: DbHandle, opts: AccessOpts) {
  const router = Router();
  router.use(accessAuthRoutes(db, opts));
  router.use(accessInviteRoutes(db, opts));
  router.use(accessMemberRoutes(db, opts));
  router.use(accessSkillRoutes(db));
  return router;
}
```

**Only `app.ts` imports `accessRoutes`** — zero downstream changes needed.

---

### Task 8: Split `agents.ts` route (2313 → 4 files)

**Files:**
- Create: `server/src/routes/agent-config.ts` (~350 lines)
- Create: `server/src/routes/agent-heartbeats.ts` (~400 lines)
- Create: `server/src/routes/agent-lifecycle.ts` (~400 lines)
- Modify: `server/src/routes/agents.ts` (stub, ~350 lines)

**Split map:**

| New file | Routes |
|---|---|
| `agent-config.ts` | Configuration CRUD, config revisions, rollback, instructions bundle, file read/write/delete, permissions, adapter models, test-environment |
| `agent-heartbeats.ts` | Wakeup, invoke, heartbeat-runs list/detail/cancel/events/log, live-runs, workspace operations, issue live-runs/active-run |
| `agent-lifecycle.ts` | Create (hire + direct), pause, resume, terminate, delete, API keys CRUD, skills sync, claude-login |
| `agents.ts` (stub) | Agent list, detail, org chart, `agents/me`, `agents/me/inbox-lite`, runtime-state, task-sessions, param middleware, sub-router mounting |

---

### Task 9: Split `issues.ts` route (1636 → 3 files)

**Files:**
- Create: `server/src/routes/issue-comments.ts` (~300 lines)
- Create: `server/src/routes/issue-documents.ts` (~250 lines)
- Create: `server/src/routes/issue-attachments.ts` (~250 lines)
- Modify: `server/src/routes/issues.ts` (stub, ~500 lines)

**Split map:**

| New file | Routes |
|---|---|
| `issue-comments.ts` | List, get, add comment (+ reopen/interrupt/mention/wakeup logic) |
| `issue-documents.ts` | List, get, upsert, revisions, delete document + work products CRUD |
| `issue-attachments.ts` | List, upload (multer), stream content, delete attachment |
| `issues.ts` (stub) | Issue CRUD, checkout/release, labels, read, approvals, heartbeat-context, param middleware |

---

## Wave 4: UI Components

### Task 10: Split `AgentDetail.tsx` (4016 → 8 files)

Each tab is already a self-contained component with its own state/queries. Extract to `ui/src/pages/agent-detail/`.

**Files:**
- Create: `ui/src/pages/agent-detail/AgentOverview.tsx` (~200 lines)
- Create: `ui/src/pages/agent-detail/ConfigurationTab.tsx` (~300 lines)
- Create: `ui/src/pages/agent-detail/PromptsTab.tsx` (~700 lines)
- Create: `ui/src/pages/agent-detail/AgentSkillsTab.tsx` (~400 lines)
- Create: `ui/src/pages/agent-detail/RunsTab.tsx` (~500 lines)
- Create: `ui/src/pages/agent-detail/LogViewer.tsx` (~600 lines)
- Create: `ui/src/pages/agent-detail/KeysTab.tsx` (~170 lines)
- Modify: `ui/src/pages/AgentDetail.tsx` (stub, ~600 lines)

**Split map:**

| New file | Components inside | Source lines |
|---|---|---|
| `AgentOverview.tsx` | `AgentOverview`, `SummaryRow`, `LatestRunCard`, `CostsSection` | 1065-1299 |
| `ConfigurationTab.tsx` | `AgentConfigurePage`, `ConfigurationTab` | 1303-1574 |
| `PromptsTab.tsx` | `PromptsTab`, `PromptsTabSkeleton`, `PromptEditorSkeleton` | 1578-2293 |
| `AgentSkillsTab.tsx` | `AgentSkillsTab` | 2295-2694 |
| `RunsTab.tsx` | `RunListItem`, `RunsTab`, `RunDetail` | 2698-3237 |
| `LogViewer.tsx` | `LogViewer`, `WorkspaceOperationStatusBadge`, `WorkspaceOperationLogViewer`, `WorkspaceOperationsSection` | 341-519, 3241-3844 |
| `KeysTab.tsx` | `KeysTab` | 3848-4016 |
| `AgentDetail.tsx` (stub) | `AgentDetail` (main orchestrator — tabs, header, actions) | 521-1061 + imports |

**Note:** `PromptsTab.tsx` at ~700 lines is right at the limit. If it needs further splitting later, the file tree panel and the editor panel are natural sub-boundaries.

---

### Task 11: Convert `docs-content.ts` to markdown files (4343 → folder of .md files)

This file is pure static content — 12 sections × ~45 pages of inline markdown. It should be a folder of markdown files loaded at build time or runtime.

**Files:**
- Create: `ui/src/pages/docs-content/` folder
- Create: `ui/src/pages/docs-content/index.ts` (~80 lines — section manifest with lazy imports)
- Create: `ui/src/pages/docs-content/getting-started/` (4 .md files)
- Create: `ui/src/pages/docs-content/board-operator/` (12 .md files)
- Create: `ui/src/pages/docs-content/sanad-brain/` (11 .md files)
- Create: `ui/src/pages/docs-content/agent-developer/` (7 .md files)
- Create: `ui/src/pages/docs-content/chat/` (2 .md files)
- Create: `ui/src/pages/docs-content/access-control/` (1 .md file)
- Create: `ui/src/pages/docs-content/instructions/` (1 .md file)
- Create: `ui/src/pages/docs-content/debug-panel/` (1 .md file)
- Create: `ui/src/pages/docs-content/deployment/` (9 .md files)
- Create: `ui/src/pages/docs-content/adapters/` (7 .md files)
- Create: `ui/src/pages/docs-content/api-reference/` (15 .md files)
- Create: `ui/src/pages/docs-content/crew-structure/` (1 .md file)
- Modify: `ui/src/pages/Docs.tsx` (update import to use new index)
- Delete: `ui/src/pages/docs-content.ts` (after migration)

**Index pattern:**
```typescript
// docs-content/index.ts
import type { DocSection } from "./types";

// Vite's import.meta.glob for lazy markdown loading
const mdModules = import.meta.glob("./**/*.md", { as: "raw", eager: true });

function loadSection(id: string, title: string, icon: string, pageIds: string[]): DocSection {
  return {
    id, title, icon,
    pages: pageIds.map(pageId => ({
      id: pageId,
      title: titleFromFilename(pageId),
      content: mdModules[`./${id}/${pageId}.md`] as string,
    })),
  };
}

export const DOC_SECTIONS: DocSection[] = [
  loadSection("getting-started", "Getting Started", "BookOpen", ["overview", "quickstart", "core-concepts", "architecture"]),
  // ... 11 more sections
];
```

**This is a content migration, not a code split.** Each .md file is extracted from the template literal in the original file. No logic changes.

---

### Task 12: Split `NewIssueDialog.tsx` (1471 → 4 files)

**Files:**
- Create: `ui/src/components/new-issue/constants.ts` (~120 lines)
- Create: `ui/src/components/new-issue/draft-persistence.ts` (~80 lines)
- Create: `ui/src/components/new-issue/file-staging.ts` (~100 lines)
- Create: `ui/src/components/new-issue/ExecutionWorkspaceSection.tsx` (~150 lines)
- Modify: `ui/src/components/NewIssueDialog.tsx` (stub, ~700 lines)

**Split map:**

| New file | Contents |
|---|---|
| `constants.ts` | `DRAFT_KEY`, `DEBOUNCE_MS`, `ISSUE_OVERRIDE_ADAPTER_TYPES`, `STAGED_FILE_ACCEPT`, `ISSUE_THINKING_EFFORT_OPTIONS`, `statuses`, `priorities`, `EXECUTION_WORKSPACE_MODES`, types (`IssueDraft`, `StagedIssueFile`) |
| `draft-persistence.ts` | `loadDraft`, `saveDraft`, `clearDraft`, `buildAssigneeAdapterOverrides` |
| `file-staging.ts` | `isTextDocumentFile`, `fileBaseName`, `slugifyDocumentKey`, `titleizeFilename`, `createUniqueDocumentKey`, `formatFileSize` |
| `ExecutionWorkspaceSection.tsx` | Execution workspace mode selector + workspace picker (extracted from JSX lines ~900-960) |
| `NewIssueDialog.tsx` (stub) | Main component, hooks, mutations, effects, handlers, JSX — imports from above |

---

## Wave 5: CLI

### Task 13: Split `worktree.ts` (2585 → 4 files)

**Files:**
- Create: `cli/src/commands/worktree-init.ts` (~350 lines)
- Create: `cli/src/commands/worktree-cleanup.ts` (~200 lines)
- Create: `cli/src/commands/worktree-helpers.ts` (~400 lines)
- Modify: `cli/src/commands/worktree.ts` (stub, ~300 lines)

**Split map:**

| New file | Functions |
|---|---|
| `worktree-helpers.ts` | `isMissingStorageObjectError`, `readSourceAttachmentBody`, `resolveWorktreeMakeTargetPath`, `resolveGitWorktreeAddArgs`, `copyGitHooksToWorktreeGitDir`, `rebindWorkspaceCwd`, `resolveSourceConfigPath`, `copySeededSecretsKey`, `seedWorktreeDatabase`, `openConfiguredDb` |
| `worktree-init.ts` | `runWorktreeInit`, `worktreeInitCommand`, `worktreeMakeCommand` |
| `worktree-cleanup.ts` | `worktreeCleanupCommand`, `worktreeEnvCommand`, `worktreeListCommand` |
| `worktree.ts` (stub) | `worktreeMergeHistoryCommand` (stays — it uses `worktree-merge-history-lib.ts`), `registerWorktreeCommands` (mounts all commands), re-exports |

**Note:** `worktree-merge-history-lib.ts` (764 lines) already exists as a separate file. The merge-history command in `worktree.ts` delegates to it, so it stays in the stub.

---

## Verification Checklist (run after ALL waves complete)

```bash
# 1. No file over 700 lines
find server/src ui/src cli/src packages/*/src packages/adapters/*/src \
  -name '*.ts' -o -name '*.tsx' | \
  while read f; do
    lines=$(wc -l < "$f")
    [ "$lines" -gt 700 ] && echo "OVER: $lines $f"
  done

# 2. Build passes
pnpm build

# 3. All tests pass
pnpm test

# 4. No orphaned imports
pnpm tsc --noEmit

# 5. Line count conservation (total lines before vs after)
# Before: ~30,000 lines across 12 files
# After: ~31,500 lines across ~50 files (stub overhead ≈5%)
```

---

## Summary

| Wave | Files split | New files created | Risk |
|---|---|---|---|
| 1: Shared infra | 2 modified | 3 new packages | Low (dedup only) |
| 2: Server services | 5 files → stubs | 16 new modules | **High** (core logic) |
| 3: Server routes | 3 files → stubs | 11 new route files | Medium (Express wiring) |
| 4: UI components | 3 files → stubs | 16 new components | Medium (React extraction) |
| 5: CLI | 1 file → stub | 3 new modules | Low (isolated CLI) |

**Total: 12 fat files → 12 stubs + ~49 new focused modules**

Each wave is independent — you can merge Wave 1, then Wave 2, etc. Within each wave, commit per-file for crash safety.

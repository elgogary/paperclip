## Summary

The split is architecturally sound with one confirmed blocking bug and several real concerns worth tracking.

---

## Issues

### 1. BLOCKING — `issues.ts`: sub-modules receive an empty `$` object, not the shared bag

- **[severity: high]** **Correctness**: `issueService` wires the three sub-modules like this:

  ```ts
  const commentOps = createCommentOps(db, {});
  const attachmentOps = createAttachmentOps(db, {});
  const checkoutOps = createCheckoutOps(db, {
    assertAssignableAgent,
    withIssueLabels,
  });
  ```

  `commentOps` and `attachmentOps` receive a plain empty object literal `{}`, not the shared `$` bag. This works today only because those two modules happen not to use anything from `$`. But the typed signature of `createCommentOps` and `createAttachmentOps` is `$: { }` — an empty structural type — so if anyone adds a cross-module reference to either module and passes it through `$`, the compiler will silently accept `{}` and the reference will be `undefined` at runtime. The pattern diverges from every other module in the codebase (`heartbeat.ts`, `company-portability.ts`) and is a maintenance trap. `createCheckoutOps` correctly receives a typed struct with the two functions it needs — that pattern should be used uniformly.

  **Fix**: define a `type IssueServices = { ... }` for each sub-module (even if empty for now) and pass the real `$` bag or a correctly typed subset, consistent with the pattern used everywhere else.

---

### 2. MEDIUM — `company-portability.ts`: duplicate import of `parseGitHubSourceUrl`

- **[severity: medium]** **Correctness**: `parseGitHubSourceUrl` is imported twice from `./portability-skills.js`:

  - Line 34: `export { parseGitHubSourceUrl } from "./portability-skills.js";`
  - Line 70: `import { parseGitHubSourceUrl as _parseGitHubSourceUrl } from "./portability-skills.js";`

  The aliased `_parseGitHubSourceUrl` is used inside `resolveSource`. This is redundant — the same module binding is imported under two names. It works correctly at runtime because ES module imports are live bindings to the same export slot, but it is confusing to read and could cause an accidental divergence if one import path is later changed.

  **Fix**: remove the re-export alias import. Use the already-imported name directly: `export { parseGitHubSourceUrl } from "./portability-skills.js"` and then `import { parseGitHubSourceUrl } from "./portability-skills.js"` (single declaration), or import once and re-export using `export { parseGitHubSourceUrl }` after the import.

---

### 3. MEDIUM — `heartbeat.ts`: initialization order dependency between `$.budgets` and modules that execute first

- **[severity: medium]** **Correctness** / **Initialization order**: `$.budgets` and `$.budgetHooks` are set **after** all six sub-module factories have run:

  ```ts
  const cancellationOps = createCancellationOps(db, $);
  Object.assign($, cancellationOps);         // line 101-102

  $.budgetHooks = { ... };                   // line 107
  $.budgets = budgetService(db, $.budgetHooks); // line 108
  ```

  Any sub-module factory that reads `$.budgets` **during construction** (not deferred inside a returned function) would receive `undefined`. Inspecting the factories shows they do not call `$.budgets` at construction time — only inside returned async functions — so this is safe today. However there is no structural enforcement of this. A future developer adding `const x = $.budgets.doSomething()` at the top level of a factory body would silently get `undefined`. The comment on line 104-106 documents the intent but does not prevent the class of error.

  **Fix**: either (a) set `$.budgets` before initializing the sub-modules, which requires restructuring the `cancelBudgetScopeWork` hook dependency, or (b) add a runtime assertion inside each sub-module that `$.budgets` is defined before any function that needs it executes. Option (a) is cleaner.

---

### 4. LOW — `workspace-runtime.ts`: re-export completeness

- **[severity: low]** **Re-export completeness**: The stub re-exports both functions from `workspace-provision.ts` and all seven functions from `runtime-services.ts`. The types (`ExecutionWorkspaceInput`, `ExecutionWorkspaceIssueRef`, `ExecutionWorkspaceAgentRef`, `RealizedExecutionWorkspace`, `RuntimeServiceRef`) are defined directly in `workspace-runtime.ts` rather than in either sibling module, which is correct. `sanitizeRuntimeServiceBaseEnv` and `buildWorkspaceReadyComment` also remain in the stub. No symbols are missing.

  One observation: `sanitizeRuntimeServiceBaseEnv` is defined in `workspace-runtime.ts` (the stub) but is consumed by both `workspace-provision.ts` (line 339) and `runtime-services.ts` (line 334). Those siblings import it back from the stub via `import { sanitizeRuntimeServiceBaseEnv } from "./workspace-runtime.js"`. This creates a **reverse import** — siblings import from their orchestrator — which is an atypical dependency direction in a split like this. It works correctly because the function is defined in the file itself (no initialization-order hazard), but it means removing or renaming the stub would break both siblings.

  **Fix** (optional): move `sanitizeRuntimeServiceBaseEnv` to a small `workspace-env-utils.ts` shared helper that neither the stub nor the siblings own. Not blocking.

---

### 5. LOW — `access.ts` route stub: re-export surface

- **[severity: low]** **Re-export completeness**: The access route stub re-exports 7 symbols from `access-helpers.ts`. Without the original file to compare against, this cannot be verified as complete. The symbols exported cover the public API that was likely called from route handlers and tests. No evidence of missing symbols was found in the code examined. Flag for a grep-based verification against call sites if test failures appear.

---

## Verdict

**NEEDS CHANGES** — Issue #1 (empty `$` passed to comment/attachment sub-modules in `issues.ts`) is a latent correctness hazard that should be fixed before the pattern is copied further. Issue #2 (double import) is a real code smell in a file that will be read often. Issues #3–5 are informational and do not require immediate action.

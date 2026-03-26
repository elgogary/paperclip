## Summary

The large-file split is structurally sound but introduced three concrete DRY violations, one type-safety hole in the `$` bag pattern, and a silent type mismatch in `company-portability.ts` that will cause a runtime error if the `buildManifestFromPackageFiles` return shape ever diverges from what `portability-import.ts` expects.

---

## Issues

- **[severity: high]** Correctness — `ResolvedSource` type is computed incorrectly in `company-portability.ts`.

  `company-portability.ts:79` defines:
  ```ts
  type ResolvedSource = ReturnType<typeof buildManifestFromPackageFiles> extends Promise<infer T> ? T : never;
  ```
  `buildManifestFromPackageFiles` is a synchronous function (not `async`), so `ReturnType<...>` is not a `Promise`. The conditional unwraps to `never`, meaning `ResolvedSource` resolves to `never`. The concrete `type ResolvedSource` in `portability-import.ts:70-74` (the correct structural definition with `manifest`, `files`, `warnings` fields) is what is actually expected by `createImportOps`. The stub's computed type will silently disagree with the import module's type, suppressing all type errors on the `resolveSource` callback. Fix: either import `ResolvedSource` from `portability-import.ts` (requires exporting it), or define it structurally in a shared location and import from there.

- **[severity: high]** Security / Correctness — `$` bag is typed as `Record<string, any>` in `company-portability.ts:83`.

  ```ts
  const $: Record<string, any> = {};
  ```
  `createImportOps` and `createExportOps` each declare a precise service-deps type (`ImportServices`, `ExportServices`). The stub passes the same `$` object to both but types it as `any`-wide. TypeScript will not catch missing or mistyped service methods on `$`, and any property accessed on `$` before assignment (e.g., if `$.resolveSource` is attached at line 191 but `createImportOps` is called at line 195) would silently be `undefined` at call time. The `$.resolveSource` attachment at line 191 happens just before the `createImportOps` call at line 195, so the order is correct — but the lack of typing means this is invisible to the compiler. Fix: declare `$` with the intersection of `ImportServices & ExportServices` (or a shared `PortabilityServices` type), making any future ordering error a compile-time failure.

- **[severity: medium]** DRY — `ImportedSkill` type is declared three times independently.

  - `company-skills.ts:95-109`
  - `skill-inventory.ts:21-35`
  - `skill-import-sources.ts:44-58`

  All three declarations are structurally identical. The type should be declared once (most naturally in `skill-inventory.ts`, which originated it) and imported in the other two files. As it stands, any future change to the shape (e.g., adding a required field) must be applied in three places; missing one causes a silent structural incompatibility.

- **[severity: medium]** DRY — `ParsedSkillImportSource` type is declared twice independently.

  - `company-skills.ts:122-127`
  - `skill-import-sources.ts:60-65`

  Both are structurally identical. `ParsedSkillImportSource` is used only in `skill-import-sources.ts` (the return type of `parseSkillImportSourceInput`) and consumed by `company-skills.ts`. It should live in `skill-import-sources.ts` and be exported/imported from there.

- **[severity: medium]** DRY — `fetchText` / `fetchJson` / `resolveRawGitHubUrl` are implemented twice with different error-handling styles.

  `company-portability.ts:37-67` defines local `fetchText`, `fetchOptionalText`, `fetchBinary`, `fetchJson`, and `resolveRawGitHubUrl`.
  `skill-import-sources.ts:67-85` and `148-150` define `fetchText`, `fetchJson`, and `resolveRawGitHubUrl` — exported and used by `company-skills.ts`.

  The implementations differ subtly: `skill-import-sources.ts` throws via `unprocessable()` (a structured HTTP error); `company-portability.ts` throws with `new Error(...)` (a plain error). This divergence is intentional for the 404-graceful `fetchOptionalText` case, but `fetchText` and `fetchJson` in the stub duplicate logic that already exists in `skill-import-sources.ts`. The portability stub could import these from `skill-import-sources.ts` and add its own `fetchOptionalText`/`fetchBinary` on top.

- **[severity: low]** Readability — `company-portability.ts:70` imports `parseGitHubSourceUrl` under two different names.

  ```ts
  export { parseGitHubSourceUrl } from "./portability-skills.js";  // line 34
  // ...
  import { parseGitHubSourceUrl as _parseGitHubSourceUrl } from "./portability-skills.js";  // line 70
  ```
  The same symbol is imported twice in the same file: once for re-export and once for internal use under an alias. This is redundant. A single `import` at the top can serve both purposes (re-export it explicitly and use it directly without the alias).

- **[severity: low]** Readability — `company-portability.ts:31` double-imports from the same module.

  ```ts
  import { readIncludeEntries } from "./portability-manifest.js";
  import { buildManifestFromPackageFiles } from "./portability-manifest.js";
  ```
  These two statements should be merged into one `import { ..., ... } from "./portability-manifest.js"`.

---

## Verdict

NEEDS CHANGES — two blocking issues (the `ResolvedSource` computed type resolving to `never` and the untyped `$` bag) should be fixed. The DRY violations are real debt but not runtime bugs. The readability issues are cosmetic.

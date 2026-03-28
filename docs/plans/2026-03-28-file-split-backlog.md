# File Split Backlog — Phase 2

Files over 700 lines still needing safe-split. Deferred from 2026-03-27 refactor session.

## Server

| File | Lines | Priority |
|---|---|---|
| `server/src/routes/access-helpers.ts` | 1,556 | High |
| `server/src/services/routines.ts` | 1,268 | High |
| `server/src/services/issues.ts` | 1,173 | High |
| `server/src/services/company-skills.ts` | 1,103 | Medium |
| `server/src/services/portability-import.ts` | 1,042 | Medium |

## CLI

| File | Lines | Priority |
|---|---|---|
| `cli/src/commands/client/company.ts` | 1,456 | High |
| `cli/src/commands/worktree.ts` | 1,293 | Medium |

## UI

| File | Lines | Priority |
|---|---|---|
| `ui/src/pages/docs-content.ts` | 4,343 | High — pure data, easy split |
| `ui/src/components/AgentConfigForm.tsx` | 1,447 | High |
| `ui/src/components/OnboardingWizard.tsx` | 1,412 | High |
| `ui/src/pages/CompanyImport.tsx` | 1,350 | Medium |
| `ui/src/pages/IssueDetail.tsx` | 1,349 | Medium |
| `ui/src/components/NewIssueDialog.tsx` | 1,238 | Medium |
| `ui/src/pages/CompanySkills.tsx` | 1,170 | Medium |
| `ui/src/components/ProjectProperties.tsx` | 1,126 | Medium |
| `ui/src/pages/Costs.tsx` | 1,102 | Low |
| `ui/src/components/JsonSchemaForm.tsx` | 1,048 | Low |

## Test Files

| File | Lines | Note |
|---|---|---|
| `server/src/__tests__/company-portability.test.ts` | 2,185 | Split by concern: export/import/manifest |

## Rules (reminder)
- Use $ bag pattern for server services
- Use sub-router pattern for routes
- Use tab-component folder pattern for UI pages
- Original file becomes thin stub — never move or delete it
- One commit per new file extracted (crash-safe)
- Run pre-deploy-smoke.test.ts after each split

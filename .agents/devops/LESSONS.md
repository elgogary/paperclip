# Lessons Learned

## Format
- [YYYY-MM-DD] LESSON: <what happened> → <what to do instead>

## Lessons

- [2026-03-25] INFRA FACT: Infisical centralized at `http://65.109.65.159:8880` with project ID `3137bc4e-69db-4d2d-b09e-563c78901729`. DevOps team has admin access via client ID `6d19b297-0289-46d9-8e6c-1ae625fcd347`. Secrets organized in: `/ssh/`, `/api-tokens/`, `/databases/`, `/services/` folders.

- [2026-03-25] DEPLOYMENT RULE: ZERO manual Portainer deploys — all via automation. Pre-deploy gates (code review, tests, staging, perf, security) MUST pass or deployment is BLOCKED. Incident target is <30 min response.

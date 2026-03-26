# Lessons Learned

## Format
- [YYYY-MM-DD] LESSON: <what happened> → <what to do instead>

## Lessons

- [2026-03-25] LESSON: `ssh` is not available in this container environment → for server-side fixes on Hetzner, provide code patches in the report and delegate to DevOps or a user with SSH access.
- [2026-03-25] LESSON: sanad-brain MCP script at `/workspace/bin/sanad-brain-mcp` sends `{"text": ...}` to `/memory/raw` but the API requires `{"content": ...}` — verified via openapi.json schema. Fixed line 59.
- [2026-03-25] LESSON: When probing API security with no source code, use openapi.json to get full endpoint inventory, then probe each group for auth coverage, then cross-reference with the audit log to detect if requests are being logged under caller-supplied params vs key-bound params.
- [2026-03-25] LESSON: Tenant isolation test requires a second real tenant with data. With only one tenant, cross-tenant path param tests return 200 but empty results — inconclusive. Flag as MEDIUM and document the risk vector clearly.

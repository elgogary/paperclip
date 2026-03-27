## Summary
Solid structure overall, but contains one real security bug (route shadowing causes 404), one medium injection-adjacent risk (unvalidated enum values passed to SQL filters), and two missing error-handling gaps at route boundaries.

## Issues

- **[severity: high]** Correctness: Route shadowing — `/swarm/capabilities/counts` (line 87 in routes) is registered AFTER `/swarm/capabilities/:capabilityId` (line 75). Express matches the dynamic segment first, so `getCapability("counts")` is called instead of `getCapabilityCounts`. The DB lookup returns null → 404. Same bug on `/swarm/installs/counts` (line 172) registered after `/swarm/installs/:installId/disable` (line 144) — the `counts` segment is matched by `:installId`. Fix: register all static routes (`/counts`) before dynamic ones (`/:id`) within each group.

- **[severity: medium]** Security: Unvalidated enum values from query strings flow directly into Drizzle `eq()` filters. `filters.type`, `filters.status`, `filters.trustLevel`, and `filters.pricingTier` are all sourced from `req.query` and compared with `eq()` against DB columns. Drizzle parameterizes these values, so there is no SQL injection risk — but there is a functional risk: any string value is silently accepted and will just return zero rows rather than a 400 error. An attacker can enumerate valid enum values through timing/response differences. Fix: validate against an explicit allowlist (e.g. `["mcp_server", "skill", "agent"]`) and return 400 on unknown values.

- **[severity: medium]** Security: The `limit` query parameter on the audit log endpoint (route line 186) is parsed with `parseInt` but not bounded. A caller can pass `limit=1000000` and force a massive result set. The service default is 100 (acceptable), but the route permits any positive integer. Fix: cap at a reasonable maximum (e.g. `Math.min(parsed, 500)`).

- **[severity: medium]** Correctness: `deleteSource` (service line 127-129) deletes capabilities then the source in two separate statements with no transaction. If the process crashes between the two deletes, orphaned capabilities remain with a dangling `sourceId` FK. Fix: wrap both deletes in `db.transaction(async (tx) => { ... })`.

- **[severity: low]** Error handling: The `PATCH /sources/:sourceId` and `DELETE /sources/:sourceId` route handlers (lines 37-63) have no try/catch around the service calls (`updateSource`, `deleteSource`). A DB failure will cause an unhandled promise rejection and likely a 500 with no response sent. All other mutating routes in this file do have try/catch. Fix: add try/catch consistent with the `POST` handlers.

- **[severity: low]** Correctness: `ilike` search in `listCapabilities` (service line 148) interpolates `filters.search` directly into a LIKE pattern: `` `%${filters.search}%` ``. If the search string contains `%` or `_` characters, these are treated as SQL wildcards rather than literals. Drizzle parameterizes the value (no injection risk), but the behavior is surprising. Fix: escape `%` and `_` in the search string before interpolation: `filters.search.replace(/%/g, "\\%").replace(/_/g, "\\_")`.

## Verdict
NEEDS CHANGES — the route shadowing bug (high) means `/counts` endpoints silently return 404 in production, and the missing transaction on `deleteSource` is a data integrity risk.

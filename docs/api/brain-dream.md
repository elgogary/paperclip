# Brain Dream API Reference

Base URL: `http://<brain-host>:8100`
Auth: `X-Api-Key` header

## POST /dream/trigger

Manually trigger a dream cycle for a company.

```json
{ "company_id": "optiflow", "dry_run": true }
```

Response:
```json
{
  "ok": true,
  "report": {
    "cycle_id": "uuid",
    "company_id": "optiflow",
    "status": "completed",
    "dry_run": true,
    "total_memories": 333,
    "duplicates_removed": 5,
    "dates_normalized": 3,
    "pruned": 0,
    "phases": {
      "orient": { "total": 333, "by_type": {"fact": 120, "lesson": 80}, "stale_candidates": 12 },
      "gather": { "since": 1774300000, "new_writes": 45 },
      "consolidate": { "duplicates_found": 5, "duplicates_removed": 5, "dates_normalized": 3 },
      "prune": { "pruned": 0, "over_limit": false }
    }
  }
}
```

## GET /dream/status/{company_id}

Check if a dream should run + last cycle info.

```json
{
  "company_id": "optiflow",
  "should_dream": true,
  "last_cycle": {
    "cycle_id": "uuid",
    "status": "completed",
    "completed_at": 1774394505.2,
    "total_memories": 333,
    "duplicates_removed": 5,
    "summary": "Dream cycle for optiflow; 333 total memories; removed 5 duplicates"
  }
}
```

## GET /dream/history/{company_id}

Query params: `limit` (default 10)

Returns list of past dream cycles ordered by most recent.

## Dream Cycle Phases

| Phase | What | LLM? |
|-------|------|------|
| 1. Orient | Count memories by type/scope, find stale candidates | No |
| 2. Gather | Query audit log for changes since last dream | No |
| 3. Consolidate | Exact dedup + relative date normalization | No |
| 4. Prune | Delete oldest if over MAX_MEMORY_ENTRIES limit | No |

## Trigger Conditions (automatic)

All must be true:
- >= 24h since last dream (`DREAM_MIN_INTERVAL_HOURS`)
- >= 5 new writes since last dream (`DREAM_MIN_WRITES`)
- No active dream lock for this company

## Configuration

| Env Var | Default | Description |
|---------|---------|-------------|
| `DREAM_MIN_INTERVAL_HOURS` | 24 | Min hours between cycles |
| `DREAM_MIN_WRITES` | 5 | Min writes to trigger |
| `MAX_MEMORY_ENTRIES` | 200 | Memory cap per company |
| `DREAM_CHECK_INTERVAL_MINUTES` | 60 | Scheduler check frequency |

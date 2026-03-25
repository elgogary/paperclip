# Brain Memory API Reference

Base URL: `http://<brain-host>:8100`
Auth: `X-Api-Key` header

## Endpoints

### POST /memory/remember
Store a memory with LLM extraction (entities → Qdrant + Neo4j graph).

**Latency:** 2-5s (LLM extraction dominates)

```json
{
  "company_id": "optiflow",
  "user_id": "eslam",
  "content": "Lesson: always check Qdrant dimensions before migration",
  "scope": "company",
  "sensitivity": "internal",
  "source": "api"
}
```

### POST /memory/raw
Store a memory with embed-only (no LLM, no graph). ~200ms.

### POST /memory/raw/batch
Store multiple memories in one Qdrant upsert. ~200ms for 50 items.

```json
{ "company_id": "optiflow", "user_id": "eslam", "contents": ["fact 1", "fact 2"] }
```

### POST /memory/search
Cosine similarity search + Neo4j graph relations.

```json
{ "company_id": "optiflow", "user_id": "eslam", "query": "deployment lessons", "limit": 10 }
```

### POST /memory/queue
Queue a turn for batch processing (returns immediately).

### POST /memory/queue/batch
Queue multiple turns. Deduplicates by content hash.

### GET /memory/queue/status
Returns `{ "pending": N }`.

### POST /memory/context
Build formatted markdown context for LLM system prompt injection.

### POST /memory/fact
Store structured entity-attribute-value fact.

### POST /memory/feedback
Thumbs up/down or correction on a memory.

### POST /memory/delete
Delete a memory by ID (with ownership verification).

### GET /memory/stats/{company_id}/{user_id}
Memory statistics per tenant.

### GET /memory/all/{company_id}/{user_id}
List all memories for a user.

### GET /memory/company/{company_id}
List all memories for a company across all users.

### POST /memory/consolidate
Run dedup consolidation (supports `dry_run`).

## Scopes and Sensitivity

| Scope | Meaning |
|-------|---------|
| private | Only the storing user can retrieve |
| team | Team members can retrieve |
| company | All users in the company can retrieve |

| Sensitivity | Who can read |
|-------------|-------------|
| public | All roles |
| internal | member, manager, admin |
| confidential | manager, admin |
| restricted | admin only |

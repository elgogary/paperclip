# Brain Tools API Reference

Base URL: `http://<brain-host>:8100`
Auth: `X-Api-Key` header

## POST /tools/register

Register or update a single tool description.

```json
{
  "tool_id": "mcp__sanad-brain__recall",
  "name": "Recall Memory",
  "description": "Search memories for relevant context.",
  "category": "memory",
  "provider": "mcp",
  "schema_json": "{\"properties\": {\"query\": {\"type\": \"string\"}}}"
}
```

Response: `{ "ok": true, "result": { "action": "registered", "tool_id": "...", "point_id": "..." } }`

## POST /tools/register/batch

Register multiple tools in one Qdrant upsert.

```json
{
  "tools": [
    { "tool_id": "t1", "name": "T1", "description": "...", "category": "dev", "provider": "mcp" },
    { "tool_id": "t2", "name": "T2", "description": "...", "category": "tasks", "provider": "mcp" }
  ]
}
```

Response: `{ "ok": true, "result": { "registered": 2 } }`

## POST /tools/search

Query-time retrieval. Embed query → cosine search → top K tools.

```json
{ "query": "find old conversations", "limit": 10, "category": "memory" }
```

Response: `{ "tools": [{ "tool_id": "...", "name": "...", "score": 0.82, "schema_json": "..." }] }`

Filters: `category` (optional), `company_id` (optional), `enabled=true` (always applied).

## GET /tools/list

List all registered tools with metadata (no schema_json, no vectors).

Query params: `category` (optional)

## DELETE /tools/{tool_id}

Remove a tool from the registry.

## Categories

memory, knowledge, tasks, agents, infra, sales, dev, ops

## Dedup

Tools are identified by `tool_id`. UUID5 deterministic point ID ensures re-registration updates in place.

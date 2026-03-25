# Sanad Brain Architecture Guide

## System Overview

Sanad Brain is the persistent memory, knowledge, and tool management layer for the Sanad AI agent platform. It runs as a standalone Docker stack (6 containers) on a 64GB Hetzner VPS.

## Architecture Diagram

```mermaid
graph TB
    subgraph Consumers["Consumers"]
        CC[Claude Code<br/>MCP Plugin]
        PP[Sanad AI EOI<br/>UI + Scheduled Jobs]
        ERP[ERPNext<br/>Sanad AI App]
    end

    subgraph Brain["Sanad Brain (FastAPI :8100)"]
        MEM[Memory API<br/>/memory/*]
        TOOLS[Tool Loader<br/>/tools/*]
        DREAM[Dream Engine<br/>/dream/*]
        KNOW[Knowledge API<br/>/knowledge/*]
        SCHED[Background Scheduler<br/>30m ingestion + 60m dream]
        GUARD[PII Guard<br/>Credential redaction]
    end

    subgraph Models["Ollama (4GB)"]
        NOM[nomic-embed-text<br/>274MB · 768-dim · instant]
        LLG[llama-guard3:1b<br/>1.6GB · safety · <100ms]
        QW[qwen2.5:0.5b<br/>397MB · routing · 120tok/s]
    end

    subgraph Storage["Storage Layer"]
        QD[(Qdrant<br/>3 collections<br/>768-dim cosine)]
        NEO[(Neo4j<br/>Knowledge Graph<br/>Entity relations)]
        SQL[(SQLite<br/>audit.db<br/>Audit + Queue + Dream)]
        PROM[(Prometheus<br/>Metrics<br/>30d retention)]
    end

    subgraph External["External LLM"]
        GLM[glm-4.5-air<br/>Z.AI API<br/>Entity extraction]
    end

    CC --> MEM
    PP --> MEM
    PP --> KNOW
    PP --> DREAM
    ERP -.-> MEM

    MEM --> GUARD
    GUARD --> NOM
    MEM --> GLM
    TOOLS --> NOM
    KNOW --> NOM
    DREAM --> MEM

    SCHED --> MEM
    SCHED --> DREAM

    NOM --> QD
    GLM --> QD
    GLM --> NEO
    MEM --> SQL
    DREAM --> SQL

    style Brain fill:#1a1a2e,stroke:#16213e,color:#fff
    style Models fill:#0f3460,stroke:#16213e,color:#fff
    style Storage fill:#1a1a2e,stroke:#533483,color:#fff
    style Consumers fill:#16213e,stroke:#0f3460,color:#fff
```

## Qdrant Collections

```mermaid
graph LR
    subgraph Qdrant["Qdrant Vector Store (768-dim, Cosine)"]
        SB[sanad_brain<br/>Owner: Mem0<br/>Agent memories]
        SK[sanad_knowledge<br/>Owner: Knowledge API<br/>Document chunks]
        ST[sanad_tool_descriptions<br/>Owner: Tool Loader<br/>Tool schemas]
    end

    MEM0[Mem0 Library] --> SB
    KNOW[Knowledge API] --> SK
    TL[Tool Registry] --> ST

    style Qdrant fill:#1a1a2e,stroke:#e94560,color:#fff
```

**Rules:**
- `sanad_brain` is managed by Mem0 — never write directly
- `sanad_knowledge` is managed by the Knowledge API
- `sanad_tool_descriptions` is managed by the Tool Registry
- All use the same nomic-embed-text embedder (768-dim)

## Data Flow Paths

### Path 1: Real-Time Memory (2-5s)
```
Agent → POST /memory/remember
  → PII Guard (redact credentials)
  → Mem0 (glm-4.5-air extracts entities)
    → Qdrant upsert (sanad_brain)
    → Neo4j graph (entity relations)
  → Audit log
```

### Path 2: Batch Memory (~200ms per batch)
```
Agent → POST /memory/queue
  → SQLite turn_queue (dedup by hash)
  → [Every 30 min] Scheduler
    → nomic-embed-text (batch embed)
    → Qdrant upsert (sanad_brain, raw)
    → Mark processed
```

### Path 3: Tool Search (~25ms)
```
Agent → POST /tools/search
  → nomic-embed-text (embed query)
  → Qdrant cosine search (sanad_tool_descriptions)
  → Top 5-10 tools returned with schemas
```

### Path 4: Knowledge RAG (~100ms)
```
Agent → POST /knowledge/search
  → nomic-embed-text (embed query)
  → Qdrant cosine search (sanad_knowledge)
  → Top chunks returned with scores
```

### Path 5: Dream Consolidation (daily)
```
Scheduler (hourly check) → should_dream()?
  → Phase 1: Orient (count memories)
  → Phase 2: Gather (audit log delta)
  → Phase 3: Consolidate (dedup + date normalization)
  → Phase 4: Prune (enforce 200 memory limit)
  → Dream log written
```

## Ollama Model Architecture

```mermaid
graph TB
    subgraph Ollama["Ollama Container (4GB RAM)"]
        direction TB
        NOM["nomic-embed-text (274MB)<br/>768-dim embeddings<br/>All 3 Qdrant collections"]
        LG["llama-guard3:1b (1.6GB)<br/>Safety classification<br/>SAFE / UNSAFE"]
        QW["qwen2.5:0.5b (397MB)<br/>Intent routing<br/>Category classification"]
    end

    Q1[Memory writes] --> NOM
    Q2[Tool search] --> NOM
    Q3[Knowledge search] --> NOM
    Q4[User input] --> LG
    Q5[Query routing] --> QW

    NOM --> |"768-dim vector"| QD[(Qdrant)]

    style Ollama fill:#0f3460,stroke:#16213e,color:#fff
```

**Key facts:**
- Models lazy-load on first call, unload after idle
- Total RAM: ~2.3GB active, 4GB limit
- All embedding goes through nomic-embed-text (single model, consistent vectors)
- llama-guard3 and qwen2.5 are for future guardrail/routing integration

## Background Scheduler

```mermaid
sequenceDiagram
    participant S as Scheduler Thread
    participant I as Ingestion Worker
    participant D as Dream Engine
    participant Q as Qdrant
    participant A as SQLite (audit.db)

    loop Every 30 minutes
        S->>I: process_queue()
        I->>A: get_unprocessed_turns(50)
        A-->>I: [turns]
        I->>Q: add_raw_batch (per tenant)
        I->>A: mark_turns_processed([ids])
    end

    loop Every 60 minutes
        S->>A: get_active_companies()
        A-->>S: [company_ids]
        loop Each company
            S->>D: should_dream(company_id)?
            alt Conditions met
                S->>D: run_dream(company_id)
                D->>Q: get_all memories
                D->>A: count_writes_since
                D->>Q: delete duplicates
                D->>A: write_dream_log
            end
        end
    end
```

## Resource Budget

| Container | RAM Limit | Actual | Purpose |
|-----------|-----------|--------|---------|
| sanad-brain | 4GB | ~1GB | FastAPI + Mem0 + Scheduler |
| sanad-ollama | 4GB | ~2.3GB | 3 models (lazy-loaded) |
| sanad-qdrant | 4GB | ~500MB | 3 collections, ~360 vectors |
| sanad-neo4j | 10GB | ~2GB | Knowledge graph |
| sanad-litellm | 1GB | ~200MB | Model proxy |
| sanad-prometheus | 1GB | ~100MB | Metrics (30d retention) |
| **Total** | **24GB** | **~6GB** | **18GB headroom on 64GB server** |

## Security

- All endpoints require `X-Api-Key` header
- PII Guard auto-redacts: emails, phone numbers, IPs, API keys, passwords, bearer tokens, Figma/Outline tokens
- Memories isolated by `company_id::user_id` in Qdrant payloads
- Sensitivity ceiling: role-based read access (viewer → admin)
- Prompt injection detection blocks malicious memory storage
- Neo4j graph errors don't block vector writes (monkey-patched)

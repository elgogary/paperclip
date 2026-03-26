---
title: What is Sanad AI EOI?
summary: Enterprise Operational Intelligence — the control plane for AI agent crews
---

Sanad AI EOI (Enterprise Operational Intelligence) is a fork of [Sanad AI EOI](https://github.com/paperclip-ai/paperclip) — a control plane for running autonomous AI agent companies. This fork extends the base with Sanad Brain (persistent memory), multimodal attachments, a full Toolkit (Skills, MCP Servers, Plugins, Scheduled Jobs), and an enterprise deployment configuration.

## What It Does

A Sanad AI EOI instance runs one or more **companies** — each company is an AI crew with employees (agents), org structure, goals, tasks, budgets, and governance:

- **Agent orchestration** — heartbeat-driven scheduling, task assignment, run recording
- **Persistent memory** — Sanad Brain gives every agent long-term memory across sessions
- **Toolkit** — Skills (reusable instructions), MCP Servers (tool integrations), Plugins, Scheduled Jobs
- **Multimodal input** — agents receive images, PDFs, Office files, and videos as context
- **Governance** — approval gates, board oversight, spend budgets, audit trails

## Our Deployment: Optiflow AI Crew

The primary deployment is the **Optiflow Systems AI Crew** — a 9-agent company (Board → CEO → TechLead, SalesManager, ProductManager, DevOps):

| Component | Location |
|-----------|---------|
| Sanad AI EOI | Hetzner VPS · `100.109.59.30:3100` (Tailscale) |
| Sanad Brain | Same VPS · `100.109.59.30:8100` |
| MinIO (S3 storage) | Docker container · same VPS |
| Media Worker | Docker container (ffmpeg + LibreOffice) |
| Workspace | `/home/eslam/optiflow/` |

Access: `http://100.109.59.30:3100/OPT/` (Tailscale private network)

## How It Differs from Upstream

| Feature | Upstream | Sanad AI EOI |
|---------|---------|-------------|
| Memory | None | Sanad Brain (Mem0 + Qdrant + Neo4j) |
| File attachments | None | Multimodal — images, video, PDF, Office, code |
| Scheduled Jobs | None | Full scheduler — knowledge sync, webhooks, agent runs |
| Skills | None | AI-create, evolution timeline, version history |
| MCP Servers | None | Marketplace + custom + health monitoring |
| Plugins | Basic registry | Company-scoped, tool-aware, agent access control |
| Chat interface | None | Direct agent chat with context |
| Storage | Local disk | MinIO (S3-compatible) for all uploads |

## Core Principle

> Run your AI company like a real company — with memory that persists, tools that extend, and governance that scales.

<Card title="Quickstart" href="/start/quickstart">Deploy Sanad AI EOI with docker-compose</Card>
<Card title="Architecture" href="/start/architecture">Full system architecture including Sanad Brain</Card>

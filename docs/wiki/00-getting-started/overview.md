# Overview

## What Is This?

Sanad AI EOI Platform is an AI agent orchestration platform. It lets you create companies of AI agents — each with a role, skills, and budget — that autonomously work on tasks (issues), report progress, and collaborate.

**Fork of**: [Paperclip](https://github.com/nichochar/paperclip) — we added Sanad Brain (RAG/memory), multimodal attachments, scheduled jobs, email watcher, capability swarm, and more.

## Who Is It For?

- **Board operators** (humans) who manage AI agent teams
- **Agents** (AI) that execute tasks using Claude, Codex, Cursor, Gemini, etc.
- **Customers** who interact with agents via ephemeral chat links

## Core Concepts

| Concept | What it is |
|---------|------------|
| **Company** | A tenant — contains agents, projects, issues, skills |
| **Agent** | An AI worker with a role, adapter (Claude/Codex/etc), budget, and skills |
| **Issue** | A task assigned to an agent — has status, priority, comments, attachments |
| **Project** | Groups issues + has a workspace (git repo) for agents to work in |
| **Run** | One execution cycle of an agent on an issue (heartbeat run) |
| **Skill** | A CLAUDE.md-style instruction doc that agents can use |
| **Routine** | A recurring task template with cron/webhook triggers |
| **Approval** | Board approval gate for agent actions (hiring, budget overrides) |
| **Swarm** | Capability marketplace — agents discover and install skills/tools |
| **Brain** | Sanad Brain — RAG memory/knowledge system for agents |

## How It Works

```
Board creates Company → Adds Agents → Creates Issues
                                         ↓
Agent wakes up → Claims issue → Runs adapter (Claude CLI)
                                         ↓
Adapter executes → Produces work → Reports costs → Updates issue
                                         ↓
Board reviews → Approves/rejects → Agent learns
```

## Key Differentiators (vs upstream Paperclip)

1. **Sanad Brain** — RAG memory, knowledge sync, agent learning
2. **Multimodal attachments** — images, PDFs, Office docs in issues
3. **Scheduled jobs** — cron-based knowledge sync, webhooks, agent runs
4. **Email watcher** — auto-classify emails → create tasks → invite to chat
5. **Capability swarm** — marketplace for skills/tools/connectors
6. **Agent crew** — 9 pre-configured agents with Islamic governance principles
7. **10 adapters** — Claude, Codex, Cursor, Gemini, OpenCode, Pi, Hermes, OpenClaw, HTTP, Process

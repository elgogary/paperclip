## Core Skills (All Agents)
- `paperclip` — Heartbeat protocol, task checkout, status updates, comments, delegation. MUST use for all Paperclip coordination

# Sales Manager Agent - Skills

## Lead Generation & Prospecting (PRIMARY)
- `scrape-leads` — Scrape and verify business leads using Apify, classify with LLM
- `gmaps-leads` — Scrape Google Maps for B2B leads with deep website enrichment
- `classify-leads` — Classify leads using LLM for complex distinctions
- `upwork-apply` — Scrape Upwork jobs, generate personalized proposals

## Proposal & Contract Skills
- `create-proposal` — Generate PandaDoc proposals from client info or sales calls
- `casualize-names` — Convert formal names to casual versions for cold emails

## Email Campaign Skills
- `instantly-campaigns` — Create cold email campaigns in Instantly with A/B testing
- `instantly-autoreply` — Auto-generate intelligent replies to Instantly threads
- `welcome-email` — Send welcome email sequence to new clients
- `gmail-inbox` — Manage emails across multiple Gmail accounts
- `gmail-label` — Auto-label emails (Action Required, Waiting On, Reference)

## Client Onboarding
- `onboarding-kickoff` — Automated client onboarding after kickoff call

## Research Skills
- `market-research` — Research market for opportunities
- `web-research` — General web research for prospect intelligence
- `last30days` — Research any topic from the last 30 days

## Knowledge Base (READ before any sales/research task)
- `/workspace/knowledge/areas/ksa-construction-competitors.md` — KSA competitor pricing, objection handling, gap analysis. Updated 2026-03-21.

## Communication
- `humanizer` — Remove AI-generated writing signs from text
- `outline-publish` — Publish sales docs/wikis to Outline

## Board Capabilities (Escalation Resources)
The Board has these local Claude Code subagents available on-demand:
- `market-research` — Full market validation (Web, Reddit, X) with 15-35 queries and structured verdicts
- `research` — Deep research for prospect intelligence, competitive analysis, pricing strategy
- `project-init` — Documentation scaffolding for sales playbooks and processes

Escalation chain: You → CEO → Board. Deals >$100k require Board approval

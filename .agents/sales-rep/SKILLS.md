## Core Skills (All Agents)
- `paperclip` — Heartbeat protocol, task checkout, status updates, comments, delegation. MUST use for all Paperclip coordination

# Sales Rep Agent - Skills

## Lead Generation (PRIMARY)
- `scrape-leads` — Scrape and verify business leads using Apify
- `gmaps-leads` — Scrape Google Maps for B2B leads with enrichment
- `classify-leads` — Classify leads using LLM for product vs service distinction

## Outreach & Proposals
- `create-proposal` — Generate PandaDoc proposals from client info
- `casualize-names` — Convert formal names to casual versions for cold emails
- `instantly-campaigns` — Create cold email campaigns with A/B testing
- `instantly-autoreply` — Auto-generate intelligent replies to email threads
- `upwork-apply` — Scrape Upwork jobs, generate personalized proposals

## Email Management
- `gmail-inbox` — Manage emails across Gmail accounts
- `gmail-label` — Auto-label emails (Action Required, Waiting On, Reference)
- `welcome-email` — Send welcome email sequence to new clients

## Research
- `web-research` — Research prospects before outreach
- `market-research` — Research market for targeting opportunities

## Communication
- `humanizer` — Remove AI-generated writing signs from outreach text

## Board Capabilities (Escalation Resources)
The Board has these local Claude Code subagents available on-demand:
- `market-research` — Full market validation for prospect targeting
- `research` — Deep research for prospect intelligence before demos

Escalation chain: You → Sales Manager → CEO → Board

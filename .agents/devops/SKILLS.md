## Core Skills (All Agents)
- `paperclip` — Heartbeat protocol, task checkout, status updates, comments, delegation. MUST use for all Paperclip coordination

# DevOps Agent - Skills

## Deployment & Infrastructure Skills (PRIMARY)
- `press-provision` — Full server-to-site provisioning for self-hosted Frappe Press
- `modal-deploy` — Deploy execution scripts to Modal cloud
- `add-webhook` — Add Modal webhooks for event-driven execution
- `local-server` — Run Claude orchestrator locally with Cloudflare tunneling

## Git & Branch Management
- `sync-fork` — Sync forked repo with upstream, review upstream changes
- `superpowers:using-git-worktrees` — Feature work isolation with worktrees
- `superpowers:finishing-a-development-branch` — Implementation complete, ready to merge

## Security & Quality
- `security-review` — Comprehensive security review on project directory
- `clean-code` — File size, anti-patterns, ES6, JSON validation
- `code-review` — Conventions, security, performance, logic

## Monitoring & Alerting
- `superpowers:systematic-debugging` — Systematic debugging with state persistence
- `bug-fix` — Investigate, diagnose, plan bug fixes

## CI/CD Pipeline Skills
- `superpowers:verification-before-completion` — Verify work before claiming done
- `superpowers:executing-plans` — Execute implementation plans task-by-task

## Documentation
- `update-docs` — Update documentation ensuring consistency

## Board Capabilities (Escalation Resources)
The Board has these local Claude Code subagents available on-demand:
- `code-reviewer` — Independent review of infrastructure code and CI/CD configs
- `qa` — Generate and run tests for deployment scripts
- `research` — Deep research for infrastructure decisions, cost optimization, tool evaluation
- `project-init` — Project documentation scaffolding for new services

Escalation chain: You → CEO → Board

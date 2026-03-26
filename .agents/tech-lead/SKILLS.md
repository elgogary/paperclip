## Core Skills (All Agents)
- `paperclip` — Heartbeat protocol, task checkout, status updates, comments, delegation. MUST use for all Paperclip coordination

# Tech Lead Agent - Skills

## Code Quality & Review Skills (PRIMARY)
- `code-review` — Targeted code review with decision tables
- `clean-code` — Enforce clean code standards: file size, anti-patterns, ES6, JSON
- `review-pr` — Review PRs/diffs: conventions, security, performance, logic
- `security-review` — Comprehensive security review on project directory
- `erpnext-code-validator` — Validate ERPNext/Frappe code against best practices
- `erpnext-code-interpreter` — Interpret vague ERPNext development requests

## Debugging & Bug Fix Skills
- `bug-fix` — Investigate, diagnose, plan high-quality bug fixes
- `superpowers:systematic-debugging` — Systematic debugging with persistent state
- `superpowers:verification-before-completion` — Verify work before claiming done

## Architecture & Planning Skills
- `research-architect` — Think-with-me architect for ERPNext/Frappe modules
- `recommend-improvements` — Analyze any ERPNext/Frappe app, provide recommendations
- `superpowers:brainstorming` — Creative architecture decisions
- `superpowers:writing-plans` — Multi-step implementation plans

## Code Review Process Skills
- `superpowers:requesting-code-review` — When completing tasks, before submitting
- `superpowers:receiving-code-review` — When receiving feedback, before implementing
- `superpowers:finishing-a-development-branch` — When implementation complete, ready to merge

## Git & Branch Management
- `superpowers:using-git-worktrees` — Feature work isolation with worktrees
- `sync-fork` — Sync forked repo with upstream

## ERPNext Reference (for architecture decisions)
- `erpnext-api-patterns` — Complete API integration guide
- `erpnext-database` — Database operations and ORM patterns
- `erpnext-permissions` — Permission system guide

## Project Documentation
- `project-audit-wiki` — Full audit and wiki builder for ERPNext/Frappe apps
- `update-docs` — Update documentation ensuring consistency

## Board Capabilities (Escalation Resources)
The Board has these local Claude Code subagents available on-demand:
- `code-reviewer` — Unbiased code review with zero context (Board can do independent second-opinion reviews)
- `qa` — Generate tests, run them, report pass/fail (Board can validate your review decisions)
- `research` — Deep research with web + file access (Board can investigate tech decisions)
- `project-init` — Project documentation scaffolding

When to escalate to Board: Architecture decisions >$10k impact, unresolvable tech debt, hiring engineers

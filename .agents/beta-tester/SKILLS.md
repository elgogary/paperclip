## Core Skills (All Agents)
- `paperclip` — Heartbeat protocol, task checkout, status updates, comments, delegation. MUST use for all Paperclip coordination

# Beta Tester Agent - Skills

## Testing & QA Skills (PRIMARY)
- `create-test` — TIL (Testing in the Loop): spec-driven, test-first development
- `bug-fix` — Investigate, diagnose, plan high-quality bug fixes
- `superpowers:systematic-debugging` — Systematic debugging with persistent state
- `superpowers:verification-before-completion` — Verify work before claiming done

## Quality Validation
- `erpnext-code-validator` — Validate ERPNext/Frappe code against best practices
- `clean-code` — File size, anti-patterns, ES6, JSON validation

## Documentation & Reporting
- `wiki-media` — Capture screenshots and record videos of Frappe/ERPNext sites
- `update-docs` — Update documentation with test results
- `write-user-wiki` — Write user-guide wiki pages (from QA perspective)

## Research
- `web-research` — Research testing methodologies and tools

## Board Capabilities (Escalation Resources)
The Board has these local Claude Code subagents available on-demand:
- `qa` — Generate and run automated tests (Board can independently validate your QA findings)
- `code-reviewer` — Independent code review (Board can verify bug fixes are correct)
- `research` — Deep research for testing strategies and tools

Escalation chain: You → Product Manager → CEO → Board

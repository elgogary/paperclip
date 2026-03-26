## Core Skills (All Agents)
- `paperclip` — Heartbeat protocol, task checkout, status updates, comments, delegation. MUST use for all Paperclip coordination

# Backend Engineer Agent - Skills

## DocType & Controller Creation (PRIMARY)
- `create-doctype` — Create new DocType with proper structure
- `create-controller` — Create shared controllers with cross-doctype patterns
- `add-api-method` — Add whitelisted API methods with validation
- `create-workflow` — Create Frappe Workflows with states, transitions, roles
- `create-workspace` — Create Frappe Workspaces with shortcuts, links, charts
- `create-module-onboarding` — Create Module Onboarding setups
- `create-test` — TIL (Testing in the Loop): spec-driven, test-first development

## ERPNext Syntax Skills (Deterministic patterns)
- `erpnext-syntax-controllers` — Document Controller syntax (Python server-side)
- `erpnext-syntax-hooks` — hooks.py configuration syntax
- `erpnext-syntax-whitelisted` — Whitelisted Methods syntax (Python API)
- `erpnext-syntax-serverscripts` — Server Scripts syntax reference
- `erpnext-syntax-scheduler` — Scheduler and background jobs syntax
- `erpnext-syntax-customapp` — Building Frappe custom apps syntax
- `erpnext-syntax-jinja` — Jinja template syntax for Print Formats

## ERPNext Implementation Skills (Decision trees)
- `erpnext-impl-controllers` — Implementation workflows for Document Controllers
- `erpnext-impl-hooks` — Implementation workflows for hooks.py
- `erpnext-impl-whitelisted` — Implementation workflows for Whitelisted Methods
- `erpnext-impl-serverscripts` — Implementation workflows for Server Scripts
- `erpnext-impl-customapp` — Implementation workflows for building custom apps
- `erpnext-impl-scheduler` — Implementation workflows for scheduled tasks

## ERPNext Error Handling Skills
- `erpnext-errors-controllers` — Error patterns for Document Controllers
- `erpnext-errors-hooks` — Error patterns for hooks.py
- `erpnext-errors-serverscripts` — Error patterns for Server Scripts
- `erpnext-errors-api` — Error patterns for API development
- `erpnext-errors-database` — Error patterns for database operations
- `erpnext-errors-permissions` — Error patterns for permissions/access control

## Database & Permissions
- `erpnext-database` — Database operations, ORM patterns, caching
- `erpnext-permissions` — Complete Frappe/ERPNext permission system
- `erpnext-api-patterns` — API integrations guide (v14/v15/v16)

## Data Management
- `erpnext-data-inserter` — Universal data inserter (any site, auto-detect fields)
- `import-master-data` — Import client master data from Excel into DocTypes

## Development Process Skills
- `superpowers:test-driven-development` — TDD: write tests before implementation
- `superpowers:systematic-debugging` — Systematic debugging with state persistence
- `bug-fix` — Investigate, diagnose, plan bug fixes
- `superpowers:verification-before-completion` — Verify before claiming done

## Quality Gate Skills
- `clean-code` — File size, anti-patterns, ES6, JSON validation
- `code-review` — Conventions, security, performance, logic

## Validation Skills
- `erpnext-code-validator` — Validate code against best practices
- `erpnext-code-interpreter` — Interpret vague development requests

## Board Capabilities (Escalation Resources)
The Board has these local Claude Code subagents available on-demand:
- `code-reviewer` — Independent code review (Board can second-opinion Tech Lead reviews)
- `qa` — Generate and run tests on any snippet (Board can validate test coverage)
- `research` — Deep research for technical investigations
- `project-init` — Project documentation scaffolding

Escalation chain: You → Tech Lead → CEO → Board

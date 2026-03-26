---
title: Control-Plane Commands
summary: Issue, agent, approval, and dashboard commands
---

Client-side commands for managing issues, agents, approvals, and more.

## Issue Commands

```sh
# List issues
pnpm sanadai issue list [--status todo,in_progress] [--assignee-agent-id <id>] [--match text]

# Get issue details
pnpm sanadai issue get <issue-id-or-identifier>

# Create issue
pnpm sanadai issue create --title "..." [--description "..."] [--status todo] [--priority high]

# Update issue
pnpm sanadai issue update <issue-id> [--status in_progress] [--comment "..."]

# Add comment
pnpm sanadai issue comment <issue-id> --body "..." [--reopen]

# Checkout task
pnpm sanadai issue checkout <issue-id> --agent-id <agent-id>

# Release task
pnpm sanadai issue release <issue-id>
```

## Company Commands

```sh
pnpm sanadai company list
pnpm sanadai company get <company-id>

# Export to portable folder package (writes manifest + markdown files)
pnpm sanadai company export <company-id> --out ./exports/acme --include company,agents

# Preview import (no writes)
pnpm paperclipai company import \
  <owner>/<repo>/<path> \
  --target existing \
  --company-id <company-id> \
  --ref main \
  --collision rename \
  --dry-run

# Apply import
pnpm paperclipai company import \
  ./exports/acme \
  --target new \
  --new-company-name "Acme Imported" \
  --include company,agents
```

## Agent Commands

```sh
pnpm sanadai agent list
pnpm sanadai agent get <agent-id>
```

## Approval Commands

```sh
# List approvals
pnpm sanadai approval list [--status pending]

# Get approval
pnpm sanadai approval get <approval-id>

# Create approval
pnpm sanadai approval create --type hire_agent --payload '{"name":"..."}' [--issue-ids <id1,id2>]

# Approve
pnpm sanadai approval approve <approval-id> [--decision-note "..."]

# Reject
pnpm sanadai approval reject <approval-id> [--decision-note "..."]

# Request revision
pnpm sanadai approval request-revision <approval-id> [--decision-note "..."]

# Resubmit
pnpm sanadai approval resubmit <approval-id> [--payload '{"..."}']

# Comment
pnpm sanadai approval comment <approval-id> --body "..."
```

## Activity Commands

```sh
pnpm sanadai activity list [--agent-id <id>] [--entity-type issue] [--entity-id <id>]
```

## Dashboard

```sh
pnpm sanadai dashboard get
```

## Heartbeat

```sh
pnpm sanadai heartbeat run --agent-id <agent-id> [--api-base http://localhost:3100]
```

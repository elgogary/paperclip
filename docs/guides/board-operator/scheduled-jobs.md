---
title: Scheduled Jobs
summary: Automate recurring tasks with cron-based jobs
---

Scheduled Jobs let you automate recurring actions on a cron schedule without writing code. Use them to keep Brain knowledge sources fresh, call external webhooks, or wake up agents on a regular cadence.

## Accessing Scheduled Jobs

Navigate to **Scheduled Jobs** in the sidebar. The page shows all jobs for your company in a table with columns: Name, Scope, Type, Schedule, Last Run, Next Run, Status, and Actions.

Use the **search bar** to filter by job name or description. Use the **Type** and **Status** dropdowns to narrow the list. Switch between **table view** (default) and **card view** using the toggle at the right end of the filter bar.

## Creating a Job

Click **New job**. Fill in:

1. **Name** — a clear label (e.g. "Sync product docs — weekly")
2. **Description** — optional context for your team
3. **Job type** — choose one of three types (see below)
4. **Type-specific config** — source ID, webhook URL, or agent details
5. **Cron expression** — standard 5-field cron (e.g. `0 9 * * 1` = every Monday at 9am)
6. **Timezone** — defaults to UTC

Optionally expand **Execution settings**, **Retry on failure**, and **On failure notifications** for advanced control.

## Job Types

### Knowledge Sync

Triggers a Brain knowledge source to re-index its content. Requires a **Brain Source ID** — find this in your Brain settings.

Use case: keep a knowledge source up to date with a remote document that changes weekly.

### Webhook

Makes an HTTP request to an external URL. Configure:
- **URL** — must be a public (non-private) address
- **Method** — `POST` (default), `GET`, `PUT`, or `PATCH`
- **Request body** — JSON string sent as the body (POST/PUT/PATCH)
- **Auth secret** — optionally select a stored company secret; it is sent as `Authorization: Bearer <value>`

Use case: trigger a data pipeline, notify a Slack webhook, or call a third-party automation.

> **Note:** Webhook URLs that resolve to private/loopback IP ranges (10.x, 192.168.x, localhost, etc.) are rejected to prevent SSRF.

### Agent Run

Creates a wakeup request for one of your agents with a specific task. Configure:
- **Agent** — select from your company's agents
- **Task title** — short label for the task
- **Task description** — optional prompt/instructions for the agent

Use case: have the CEO agent produce a weekly report every Monday morning.

## Schedule (Cron Expressions)

Jobs use standard 5-field cron syntax: `minute hour day-of-month month day-of-week`

| Example | Meaning |
|---------|---------|
| `0 9 * * 1` | Every Monday at 9am |
| `0 */6 * * *` | Every 6 hours |
| `30 8 * * 1-5` | Weekdays at 8:30am |
| `0 0 1 * *` | First day of every month at midnight |

The UI shows a human-readable summary below the cron field.

## Overlap and Missed Run Policies

| Setting | Option | Meaning |
|---------|--------|---------|
| **If already running** | `skip` (default) | New scheduled run is skipped if previous is still running |
| | `queue` | New run starts alongside the previous |
| **If run was missed** | `skip` (default) | Missed run is ignored |
| | `run_once` | One catch-up run fires immediately |

## Retry on Failure

Set **Max retries** (0–5) and **Retry delay** (1 min – 1 hr). Each retry is recorded as a separate run with an incremented attempt number.

> **Warning:** Webhooks may not be idempotent. Retries can cause duplicate side-effects (e.g. duplicate Slack messages, duplicate orders).

## Pausing and Resuming

Use the **⋯ menu → Pause** to stop a job from running without deleting it. The row dims to 60% opacity. Use **Resume** to re-enable it. `nextRunAt` is recalculated when resumed.

## Running Immediately

Use **⋯ menu → Run now** to fire a job immediately regardless of its schedule. A toast confirms the trigger. The result appears in the run log within seconds.

## Viewing Run History

Click the **logs icon** (scroll icon) on any row to open the run history drawer. It shows the last 50 runs with:
- Status badge (success / failed / running / timed out / cancelled)
- Triggered by (scheduler / manual / retry)
- Duration
- Output or error message
- Link to agent transcript (for `agent_run` jobs)

Run logs are kept for **90 days** then automatically purged.

## Status Meanings

| Status | Meaning |
|--------|---------|
| Active | Job is enabled and will run on schedule |
| Paused | Job is disabled and will not run |

Run statuses:

| Status | Meaning |
|--------|---------|
| `success` | Completed without error |
| `failed` | Execution error occurred |
| `running` | Currently executing |
| `timed_out` | Exceeded the timeout limit |
| `cancelled` | Manually cancelled |

## Deleting a Job

Use **⋯ menu → Delete**. A confirmation dialog appears. Deletion is permanent and removes all run history.

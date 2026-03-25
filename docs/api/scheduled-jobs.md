---
title: Scheduled Jobs
summary: Create and manage cron-based automation jobs
---

Scheduled jobs let you automate recurring tasks on a cron schedule. Three job types are supported: `knowledge_sync`, `webhook`, and `agent_run`. Jobs are executed by an in-process scheduler loop that runs every 60 seconds using `SELECT FOR UPDATE SKIP LOCKED` to prevent duplicate execution across multiple instances.

## Job Types

| Type | What it does | Default timeout |
|------|-------------|-----------------|
| `knowledge_sync` | Triggers a Brain knowledge source sync | 15 min |
| `webhook` | HTTP POST/GET/PUT/PATCH to an external URL | 5 min |
| `agent_run` | Creates a wakeup request for an agent with a task | 60 min |

## List Jobs

```
GET /api/companies/{companyId}/scheduled-jobs
```

Returns all scheduled jobs for the company ordered by creation time.

**Response**
```json
{
  "jobs": [
    {
      "id": "uuid",
      "companyId": "uuid",
      "name": "Weekly knowledge sync",
      "description": null,
      "scope": "company",
      "scopeTargetId": null,
      "jobType": "knowledge_sync",
      "config": { "source_id": "source-uuid" },
      "cronExpression": "0 9 * * 1",
      "timezone": "UTC",
      "timeoutSeconds": null,
      "overlapPolicy": "skip",
      "missedRunPolicy": "skip",
      "retryMax": 0,
      "retryDelaySeconds": 300,
      "onFailureNotifyInApp": true,
      "onFailureWebhookUrl": null,
      "onFailureWebhookSecretId": null,
      "enabled": true,
      "lastRunAt": "2026-03-24T09:00:00Z",
      "nextRunAt": "2026-03-31T09:00:00Z",
      "createdAt": "2026-03-01T00:00:00Z",
      "updatedAt": "2026-03-24T09:00:00Z"
    }
  ]
}
```

## Get Job

```
GET /api/companies/{companyId}/scheduled-jobs/{jobId}
```

## Create Job

```
POST /api/companies/{companyId}/scheduled-jobs
```

**Body fields**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | yes | Human-readable name |
| `description` | string | no | Optional description |
| `jobType` | `knowledge_sync` \| `webhook` \| `agent_run` | yes | Execution type |
| `config` | object | yes | Type-specific config (see below) |
| `cronExpression` | string | yes | Standard 5-field cron expression |
| `timezone` | string | no | IANA timezone name, default `UTC` |
| `scope` | string | no | `company` (default), `agent`, or `project` |
| `scopeTargetId` | string | no | Agent or project ID when scope is not `company` |
| `timeoutSeconds` | number | no | Override per-type default |
| `overlapPolicy` | `skip` \| `queue` | no | What to do if job is still running, default `skip` |
| `missedRunPolicy` | `skip` \| `run_once` | no | What to do if a run was missed, default `skip` |
| `retryMax` | number | no | Max retry attempts on failure, default `0` |
| `retryDelaySeconds` | number | no | Delay between retries in seconds, default `300` |
| `onFailureNotifyInApp` | boolean | no | Show in-app notification on failure, default `true` |
| `onFailureWebhookUrl` | string | no | URL to call on failure |
| `onFailureWebhookSecretId` | string | no | Secret ID for failure webhook auth |

### Config by job type

**knowledge_sync**
```json
{ "source_id": "brain-source-uuid" }
```

**webhook**
```json
{
  "url": "https://example.com/hook",
  "method": "POST",
  "body": "{\"key\":\"value\"}",
  "auth_secret_id": "secret-uuid-or-null"
}
```
Webhook URLs targeting private/loopback IP ranges are rejected (SSRF guard).

**agent_run**
```json
{
  "agent_id": "agent-uuid",
  "task_title": "Weekly review",
  "task_description": "Analyse last week's activity and post a summary."
}
```

**Response:** `201` with `{ "job": { ...job } }`

## Update Job

```
PATCH /api/companies/{companyId}/scheduled-jobs/{jobId}
```

Partial update — send only the fields you want to change. Changing `cronExpression` or `timezone` automatically recalculates `nextRunAt`.

## Delete Job

```
DELETE /api/companies/{companyId}/scheduled-jobs/{jobId}
```

Deletes the job and all its run history. Returns `{ "ok": true }`.

## Pause / Resume

```
POST /api/companies/{companyId}/scheduled-jobs/{jobId}/pause
POST /api/companies/{companyId}/scheduled-jobs/{jobId}/resume
```

Sets `enabled = false / true`. A paused job is never claimed by the scheduler.

## Run Now (manual trigger)

```
POST /api/companies/{companyId}/scheduled-jobs/{jobId}/run
```

Fires the job immediately in a background task. The endpoint responds instantly with `{ "ok": true, "message": "Job triggered" }` and execution continues asynchronously. The result is recorded in `scheduled_job_runs`.

## List Run History

```
GET /api/companies/{companyId}/scheduled-jobs/{jobId}/runs?limit=20
```

Returns the most recent runs, newest first. Max `limit` is 100.

**Run object**

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Run UUID |
| `status` | `running` \| `success` \| `failed` \| `timed_out` \| `cancelled` | Final status |
| `attempt` | number | `1` for first attempt, `2+` for retries |
| `triggeredBy` | `scheduler` \| `manual` \| `retry` | How this run started |
| `startedAt` | ISO string | When execution began |
| `finishedAt` | ISO string \| null | When execution ended |
| `durationMs` | number \| null | Wall-clock duration |
| `output` | string \| null | Success output message |
| `error` | string \| null | Error message if failed |
| `heartbeatRunId` | string \| null | For `agent_run` jobs: the heartbeat run ID |

## Scheduler internals

- Loop interval: 60 seconds
- Claims jobs where `enabled = true AND next_run_at <= NOW()` using `FOR UPDATE SKIP LOCKED`
- After each run, `nextRunAt` is recalculated from the cron expression
- Run logs older than 90 days are purged automatically

# Scheduled Jobs Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.
> After each task: run `/clean-code` then `/code-review` on changed files before committing.

**Goal:** Build a full scheduled jobs system — DB schema, in-process scheduler loop, three job executors (knowledge_sync / webhook / agent_run), REST API, and React UI (/jobs page + agent tab).

**Architecture:** In-process Node.js scheduler (setInterval 60s) inside the Sanad AI EOI server reads `scheduled_jobs` rows due for execution using `SELECT FOR UPDATE SKIP LOCKED` (prevents dual execution). `agent_run` jobs reuse the existing heartbeat/wakeup system; `webhook` and `knowledge_sync` jobs execute as async tasks tracked in `scheduled_job_runs`. All gap fixes from design: missed-run policy, overlap check via heartbeat_runs, webhook secrets via company_secrets table, 90-day log retention.

**Tech Stack:** TypeScript, Drizzle ORM (PostgreSQL), Express.js, React, TanStack Query, shadcn/ui, Tailwind CSS, `croner` npm package for cron parsing.

**Workflow per task:** implement → `/clean-code` → `/code-review` → commit

---

## Task 1: DB Schema — scheduled_jobs table

**Files:**
- Create: `packages/db/src/schema/scheduled_jobs.ts`
- Modify: `packages/db/src/schema/index.ts`

**Step 1: Create the schema file**

```typescript
// packages/db/src/schema/scheduled_jobs.ts
import { pgTable, uuid, text, integer, boolean, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

export const scheduledJobs = pgTable(
  "scheduled_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    name: text("name").notNull(),
    description: text("description"),
    scope: text("scope").notNull(), // company | project | agent
    scopeTargetId: uuid("scope_target_id"), // agentId or projectId depending on scope
    jobType: text("job_type").notNull(), // knowledge_sync | webhook | agent_run
    config: jsonb("config").$type<Record<string, unknown>>().notNull().default({}),
    cronExpression: text("cron_expression").notNull(),
    timezone: text("timezone").notNull().default("UTC"),
    timeoutSeconds: integer("timeout_seconds"), // null = auto default by type
    overlapPolicy: text("overlap_policy").notNull().default("skip"), // skip | queue
    missedRunPolicy: text("missed_run_policy").notNull().default("skip"), // skip | run_once
    retryMax: integer("retry_max").notNull().default(0),
    retryDelaySeconds: integer("retry_delay_seconds").notNull().default(300),
    onFailureNotifyInApp: boolean("on_failure_notify_in_app").notNull().default(true),
    onFailureWebhookUrl: text("on_failure_webhook_url"),
    onFailureWebhookSecretId: uuid("on_failure_webhook_secret_id"),
    enabled: boolean("enabled").notNull().default(true),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    nextRunAt: timestamp("next_run_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyNextRunIdx: index("scheduled_jobs_company_next_run_idx").on(table.companyId, table.nextRunAt),
  }),
);
```

**Step 2: Export from schema index**

Add to `packages/db/src/schema/index.ts`:
```typescript
export { scheduledJobs } from "./scheduled_jobs.js";
```

**Step 3: Commit**
```bash
git add packages/db/src/schema/scheduled_jobs.ts packages/db/src/schema/index.ts
git commit -m "feat(db): add scheduled_jobs schema"
```

---

## Task 2: DB Schema — scheduled_job_runs table

**Files:**
- Create: `packages/db/src/schema/scheduled_job_runs.ts`
- Modify: `packages/db/src/schema/index.ts`

**Step 1: Create the schema file**

```typescript
// packages/db/src/schema/scheduled_job_runs.ts
import { pgTable, uuid, text, integer, timestamp, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { scheduledJobs } from "./scheduled_jobs.js";

export const scheduledJobRuns = pgTable(
  "scheduled_job_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id").notNull().references(() => scheduledJobs.id, { onDelete: "cascade" }),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    status: text("status").notNull().default("running"), // running | success | failed | timed_out | cancelled
    attempt: integer("attempt").notNull().default(1),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    durationMs: integer("duration_ms"),
    output: text("output"),
    error: text("error"),
    heartbeatRunId: uuid("heartbeat_run_id"), // links agent_run type to heartbeat_runs
    triggeredBy: text("triggered_by").notNull().default("scheduler"), // scheduler | manual
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    jobStartedIdx: index("scheduled_job_runs_job_started_idx").on(table.jobId, table.startedAt),
    companyCreatedIdx: index("scheduled_job_runs_company_created_idx").on(table.companyId, table.createdAt),
  }),
);
```

**Step 2: Export from schema index**

Add to `packages/db/src/schema/index.ts`:
```typescript
export { scheduledJobRuns } from "./scheduled_job_runs.js";
```

**Step 3: Commit**
```bash
git add packages/db/src/schema/scheduled_job_runs.ts packages/db/src/schema/index.ts
git commit -m "feat(db): add scheduled_job_runs schema"
```

---

## Task 3: DB Migration

**Files:**
- Create: `packages/db/src/migrations/0028_scheduled_jobs.sql`
- Modify: `packages/db/src/migrations/meta/_journal.json`

**Step 1: Create the migration SQL**

```sql
-- packages/db/src/migrations/0028_scheduled_jobs.sql
CREATE TABLE "scheduled_jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id"),
  "name" text NOT NULL,
  "description" text,
  "scope" text NOT NULL,
  "scope_target_id" uuid,
  "job_type" text NOT NULL,
  "config" jsonb DEFAULT '{}' NOT NULL,
  "cron_expression" text NOT NULL,
  "timezone" text DEFAULT 'UTC' NOT NULL,
  "timeout_seconds" integer,
  "overlap_policy" text DEFAULT 'skip' NOT NULL,
  "missed_run_policy" text DEFAULT 'skip' NOT NULL,
  "retry_max" integer DEFAULT 0 NOT NULL,
  "retry_delay_seconds" integer DEFAULT 300 NOT NULL,
  "on_failure_notify_in_app" boolean DEFAULT true NOT NULL,
  "on_failure_webhook_url" text,
  "on_failure_webhook_secret_id" uuid,
  "enabled" boolean DEFAULT true NOT NULL,
  "last_run_at" timestamp with time zone,
  "next_run_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scheduled_job_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "job_id" uuid NOT NULL REFERENCES "scheduled_jobs"("id") ON DELETE CASCADE,
  "company_id" uuid NOT NULL REFERENCES "companies"("id"),
  "status" text DEFAULT 'running' NOT NULL,
  "attempt" integer DEFAULT 1 NOT NULL,
  "started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "finished_at" timestamp with time zone,
  "duration_ms" integer,
  "output" text,
  "error" text,
  "heartbeat_run_id" uuid,
  "triggered_by" text DEFAULT 'scheduler' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "scheduled_jobs_company_next_run_idx" ON "scheduled_jobs" ("company_id", "next_run_at");
--> statement-breakpoint
CREATE INDEX "scheduled_job_runs_job_started_idx" ON "scheduled_job_runs" ("job_id", "started_at" DESC);
--> statement-breakpoint
CREATE INDEX "scheduled_job_runs_company_created_idx" ON "scheduled_job_runs" ("company_id", "created_at" DESC);
```

**Step 2: Add to migration journal**

Add to the `entries` array in `packages/db/src/migrations/meta/_journal.json`:
```json
{
  "idx": 28,
  "version": "7",
  "when": 1742810000000,
  "tag": "0028_scheduled_jobs",
  "breakpoints": true
}
```

**Step 3: Install croner package**
```bash
cd /home/eslam/data/projects/paperclip
pnpm add croner --filter @sanadai/server
```

**Step 4: Commit**
```bash
git add packages/db/src/migrations/0028_scheduled_jobs.sql packages/db/src/migrations/meta/_journal.json
git commit -m "feat(db): migration for scheduled_jobs and scheduled_job_runs tables"
```

---

## Task 4: Scheduled Jobs Service (CRUD)

**Files:**
- Create: `server/src/services/scheduled-jobs.ts`
- Modify: `server/src/services/index.ts`

**Step 1: Create the service**

```typescript
// server/src/services/scheduled-jobs.ts
import { and, asc, desc, eq, lte, sql } from "drizzle-orm";
import type { Db } from "@sanadai/db";
import { scheduledJobs, scheduledJobRuns } from "@sanadai/db";
import { Cron } from "croner";

export type ScheduledJob = typeof scheduledJobs.$inferSelect;
export type ScheduledJobRun = typeof scheduledJobRuns.$inferSelect;

export type CreateJobInput = {
  companyId: string;
  name: string;
  description?: string;
  scope: string;
  scopeTargetId?: string;
  jobType: string;
  config: Record<string, unknown>;
  cronExpression: string;
  timezone?: string;
  timeoutSeconds?: number;
  overlapPolicy?: string;
  missedRunPolicy?: string;
  retryMax?: number;
  retryDelaySeconds?: number;
  onFailureNotifyInApp?: boolean;
  onFailureWebhookUrl?: string;
  onFailureWebhookSecretId?: string;
};

function computeNextRun(cronExpression: string, timezone: string): Date | null {
  try {
    const job = new Cron(cronExpression, { timezone, maxRuns: 1 });
    return job.nextRun();
  } catch {
    return null;
  }
}

export function scheduledJobsService(db: Db) {
  return {
    async list(companyId: string): Promise<ScheduledJob[]> {
      return db
        .select()
        .from(scheduledJobs)
        .where(eq(scheduledJobs.companyId, companyId))
        .orderBy(asc(scheduledJobs.createdAt));
    },

    async get(jobId: string): Promise<ScheduledJob | null> {
      const rows = await db.select().from(scheduledJobs).where(eq(scheduledJobs.id, jobId)).limit(1);
      return rows[0] ?? null;
    },

    async create(input: CreateJobInput): Promise<ScheduledJob> {
      const nextRunAt = computeNextRun(input.cronExpression, input.timezone ?? "UTC");
      const rows = await db
        .insert(scheduledJobs)
        .values({
          companyId: input.companyId,
          name: input.name,
          description: input.description ?? null,
          scope: input.scope,
          scopeTargetId: input.scopeTargetId ?? null,
          jobType: input.jobType,
          config: input.config,
          cronExpression: input.cronExpression,
          timezone: input.timezone ?? "UTC",
          timeoutSeconds: input.timeoutSeconds ?? null,
          overlapPolicy: input.overlapPolicy ?? "skip",
          missedRunPolicy: input.missedRunPolicy ?? "skip",
          retryMax: input.retryMax ?? 0,
          retryDelaySeconds: input.retryDelaySeconds ?? 300,
          onFailureNotifyInApp: input.onFailureNotifyInApp ?? true,
          onFailureWebhookUrl: input.onFailureWebhookUrl ?? null,
          onFailureWebhookSecretId: input.onFailureWebhookSecretId ?? null,
          nextRunAt,
        })
        .returning();
      return rows[0];
    },

    async update(jobId: string, input: Partial<CreateJobInput>): Promise<ScheduledJob | null> {
      const updates: Partial<typeof scheduledJobs.$inferInsert> = {
        updatedAt: new Date(),
        ...input,
      };
      if (input.cronExpression || input.timezone) {
        const existing = await this.get(jobId);
        if (existing) {
          const expr = input.cronExpression ?? existing.cronExpression;
          const tz = input.timezone ?? existing.timezone;
          updates.nextRunAt = computeNextRun(expr, tz);
        }
      }
      const rows = await db
        .update(scheduledJobs)
        .set(updates)
        .where(eq(scheduledJobs.id, jobId))
        .returning();
      return rows[0] ?? null;
    },

    async delete(jobId: string): Promise<boolean> {
      const rows = await db.delete(scheduledJobs).where(eq(scheduledJobs.id, jobId)).returning();
      return rows.length > 0;
    },

    async setEnabled(jobId: string, enabled: boolean): Promise<ScheduledJob | null> {
      const rows = await db
        .update(scheduledJobs)
        .set({ enabled, updatedAt: new Date() })
        .where(eq(scheduledJobs.id, jobId))
        .returning();
      return rows[0] ?? null;
    },

    async listRuns(jobId: string, limit = 20): Promise<ScheduledJobRun[]> {
      return db
        .select()
        .from(scheduledJobRuns)
        .where(eq(scheduledJobRuns.jobId, jobId))
        .orderBy(desc(scheduledJobRuns.startedAt))
        .limit(limit);
    },

    async createRun(jobId: string, companyId: string, attempt: number, triggeredBy: string): Promise<ScheduledJobRun> {
      const rows = await db
        .insert(scheduledJobRuns)
        .values({ jobId, companyId, attempt, triggeredBy, status: "running" })
        .returning();
      return rows[0];
    },

    async finishRun(
      runId: string,
      status: "success" | "failed" | "timed_out" | "cancelled",
      output?: string,
      error?: string,
      heartbeatRunId?: string,
    ): Promise<void> {
      const finishedAt = new Date();
      const run = await db.select().from(scheduledJobRuns).where(eq(scheduledJobRuns.id, runId)).limit(1);
      const durationMs = run[0] ? finishedAt.getTime() - new Date(run[0].startedAt).getTime() : null;
      await db
        .update(scheduledJobRuns)
        .set({ status, finishedAt, durationMs, output: output ?? null, error: error ?? null, heartbeatRunId: heartbeatRunId ?? null })
        .where(eq(scheduledJobRuns.id, runId));
      await db
        .update(scheduledJobs)
        .set({ lastRunAt: finishedAt, updatedAt: finishedAt })
        .where(eq(scheduledJobs.id, run[0]?.jobId ?? ""));
    },

    async updateNextRun(jobId: string): Promise<void> {
      const job = await this.get(jobId);
      if (!job) return;
      const nextRunAt = computeNextRun(job.cronExpression, job.timezone);
      await db.update(scheduledJobs).set({ nextRunAt, updatedAt: new Date() }).where(eq(scheduledJobs.id, jobId));
    },

    // Used by scheduler loop — returns jobs due now, claims them with FOR UPDATE SKIP LOCKED
    async claimDueJobs(): Promise<ScheduledJob[]> {
      const now = new Date();
      return db
        .select()
        .from(scheduledJobs)
        .where(
          and(
            eq(scheduledJobs.enabled, true),
            lte(scheduledJobs.nextRunAt, now),
          ),
        )
        .for("update", { skipLocked: true });
    },

    // Purge runs older than 90 days
    async purgeOldRuns(): Promise<number> {
      const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      const deleted = await db
        .delete(scheduledJobRuns)
        .where(lte(scheduledJobRuns.createdAt, cutoff))
        .returning();
      return deleted.length;
    },
  };
}
```

**Step 2: Export from services index**

Add to `server/src/services/index.ts`:
```typescript
export { scheduledJobsService, type ScheduledJob, type ScheduledJobRun } from "./scheduled-jobs.js";
```

**Step 3: Commit**
```bash
git add server/src/services/scheduled-jobs.ts server/src/services/index.ts
git commit -m "feat(server): add scheduledJobsService CRUD"
```

---

## Task 5: Job Executors

**Files:**
- Create: `server/src/services/scheduled-job-executors.ts`

**Step 1: Create executors file**

```typescript
// server/src/services/scheduled-job-executors.ts
import type { Db } from "@sanadai/db";
import { agentWakeupRequests, heartbeatRuns } from "@sanadai/db";
import { and, eq, inArray } from "drizzle-orm";
import type { ScheduledJob } from "./scheduled-jobs.js";
import { logger } from "../middleware/logger.js";

// Default timeouts by job type (seconds)
const DEFAULT_TIMEOUTS: Record<string, number> = {
  webhook: 5 * 60,
  knowledge_sync: 15 * 60,
  agent_run: 60 * 60,
};

export function getTimeoutSeconds(job: ScheduledJob): number {
  return job.timeoutSeconds ?? DEFAULT_TIMEOUTS[job.jobType] ?? 15 * 60;
}

// ── Knowledge Sync Executor ──────────────────────────────────────────────────
export async function executeKnowledgeSync(
  job: ScheduledJob,
  brainApiUrl: string,
  brainApiKey: string,
): Promise<{ output: string; error?: string }> {
  const sourceId = (job.config as Record<string, unknown>).source_id as string;
  if (!sourceId) return { output: "", error: "Missing source_id in job config" };

  const timeoutMs = getTimeoutSeconds(job) * 1000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${brainApiUrl}/knowledge/sync/${sourceId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": brainApiKey },
      body: JSON.stringify({ company_id: job.companyId }),
      signal: controller.signal,
    });
    const data = (await res.json()) as Record<string, unknown>;
    if (!res.ok || !data.ok) {
      return { output: JSON.stringify(data), error: (data.error as string) ?? `HTTP ${res.status}` };
    }
    return { output: `Synced: ${data.chunks} chunks in ${data.elapsed_seconds}s` };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { output: "", error: msg.includes("abort") ? "Timed out" : msg };
  } finally {
    clearTimeout(timer);
  }
}

// ── Webhook Executor ─────────────────────────────────────────────────────────
export async function executeWebhook(
  job: ScheduledJob,
  getSecretValue: (secretId: string) => Promise<string | null>,
): Promise<{ output: string; error?: string }> {
  const config = job.config as Record<string, unknown>;
  const url = config.url as string;
  const method = (config.method as string) ?? "POST";
  const body = config.body as string | undefined;
  const secretId = config.auth_secret_id as string | undefined;

  if (!url) return { output: "", error: "Missing webhook URL in job config" };

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (secretId) {
    const secretValue = await getSecretValue(secretId);
    if (secretValue) headers["Authorization"] = `Bearer ${secretValue}`;
  }

  const timeoutMs = getTimeoutSeconds(job) * 1000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: method !== "GET" ? (body ?? "{}") : undefined,
      signal: controller.signal,
    });
    const responseText = await res.text().catch(() => "");
    if (!res.ok) {
      return { output: responseText, error: `HTTP ${res.status} ${res.statusText}` };
    }
    return { output: `HTTP ${res.status} OK${responseText ? ` · ${responseText.slice(0, 200)}` : ""}` };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { output: "", error: msg.includes("abort") ? `Timed out after ${getTimeoutSeconds(job)}s` : msg };
  } finally {
    clearTimeout(timer);
  }
}

// ── Agent Run Executor ───────────────────────────────────────────────────────
export async function executeAgentRun(
  job: ScheduledJob,
  db: Db,
): Promise<{ output: string; error?: string; heartbeatRunId?: string }> {
  const config = job.config as Record<string, unknown>;
  const agentId = config.agent_id as string;
  const taskTitle = (config.task_title as string) ?? "Scheduled task";
  const taskDescription = (config.task_description as string) ?? "";

  if (!agentId) return { output: "", error: "Missing agent_id in job config" };

  // GAP 5 fix: check heartbeat_runs for running agent before creating wakeup
  const runningRuns = await db
    .select({ id: heartbeatRuns.id })
    .from(heartbeatRuns)
    .where(and(eq(heartbeatRuns.agentId, agentId), inArray(heartbeatRuns.status, ["queued", "running"])))
    .limit(1);

  if (runningRuns.length > 0 && job.overlapPolicy === "skip") {
    return { output: "", error: "Agent is already running — skipped (overlap policy: skip)" };
  }

  try {
    const wakeupRows = await db
      .insert(agentWakeupRequests)
      .values({
        agentId,
        companyId: job.companyId,
        requestedBy: "scheduled_job",
        context: JSON.stringify({ source: "scheduled_job", jobId: job.id, taskTitle, taskDescription }),
        status: "pending",
      })
      .returning();

    return { output: `Wakeup request created: ${wakeupRows[0].id}`, heartbeatRunId: undefined };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { output: "", error: msg };
  }
}
```

**Step 2: Commit**
```bash
git add server/src/services/scheduled-job-executors.ts
git commit -m "feat(server): add job executors for knowledge_sync, webhook, agent_run"
```

---

## Task 6: Scheduler Loop Service

**Files:**
- Create: `server/src/services/scheduler-loop.ts`
- Modify: `server/src/services/index.ts`
- Modify: `server/src/index.ts` (start loop on server startup)

**Step 1: Create scheduler loop**

```typescript
// server/src/services/scheduler-loop.ts
import type { Db } from "@sanadai/db";
import { scheduledJobsService } from "./scheduled-jobs.js";
import { executeKnowledgeSync, executeWebhook, executeAgentRun } from "./scheduled-job-executors.js";
import { secretService } from "./secrets.js";
import { logger } from "../middleware/logger.js";

const LOOP_INTERVAL_MS = 60_000; // 60 seconds
let loopTimer: NodeJS.Timeout | null = null;

export function startSchedulerLoop(db: Db): void {
  if (loopTimer) return; // already running
  logger.info("Scheduler loop started");

  const tick = async () => {
    try {
      await runSchedulerTick(db);
    } catch (err) {
      logger.error({ err }, "Scheduler tick error");
    }
  };

  loopTimer = setInterval(tick, LOOP_INTERVAL_MS);
  // Run once immediately on start (handles missed runs on restart)
  tick();
}

export function stopSchedulerLoop(): void {
  if (loopTimer) {
    clearInterval(loopTimer);
    loopTimer = null;
  }
}

async function runSchedulerTick(db: Db): Promise<void> {
  const svc = scheduledJobsService(db);
  const secSvc = secretService(db);

  // Auto-purge old runs (runs ~once/day effectively since it's cheap)
  const rand = Math.random();
  if (rand < 0.017) { // ~1/60 chance = roughly once per hour
    const deleted = await svc.purgeOldRuns();
    if (deleted > 0) logger.info({ deleted }, "Purged old scheduled job runs");
  }

  const dueJobs = await svc.claimDueJobs();
  if (dueJobs.length === 0) return;

  logger.info({ count: dueJobs.length }, "Scheduler: running due jobs");

  await Promise.allSettled(dueJobs.map(job => runJobWithRetry(db, svc, secSvc, job, 1)));
}

async function runJobWithRetry(
  db: Db,
  svc: ReturnType<typeof scheduledJobsService>,
  secSvc: ReturnType<typeof secretService>,
  job: Awaited<ReturnType<typeof svc.get>>,
  attempt: number,
): Promise<void> {
  if (!job) return;

  // GAP 1: missed run policy — if server was down and run is very late (>2× interval), check policy
  // nextRunAt is already in the past when we get here from claimDueJobs

  const run = await svc.createRun(job.id, job.companyId, attempt, attempt === 1 ? "scheduler" : "retry");

  const brainApiUrl = process.env.SANAD_BRAIN_URL ?? "http://localhost:8100";
  const brainApiKey = process.env.SANAD_BRAIN_API_KEY ?? "";

  let result: { output: string; error?: string; heartbeatRunId?: string };

  try {
    if (job.jobType === "knowledge_sync") {
      result = await executeKnowledgeSync(job, brainApiUrl, brainApiKey);
    } else if (job.jobType === "webhook") {
      result = await executeWebhook(job, async (secretId) => {
        const secret = await secSvc.getValue(secretId, job.companyId);
        return secret ?? null;
      });
    } else if (job.jobType === "agent_run") {
      result = await executeAgentRun(job, db);
    } else {
      result = { output: "", error: `Unknown job type: ${job.jobType}` };
    }
  } catch (err: unknown) {
    result = { output: "", error: err instanceof Error ? err.message : String(err) };
  }

  const succeeded = !result.error;
  await svc.finishRun(
    run.id,
    succeeded ? "success" : "failed",
    result.output,
    result.error,
    result.heartbeatRunId,
  );

  // Update next run time
  await svc.updateNextRun(job.id);

  // Retry logic
  if (!succeeded && attempt <= job.retryMax) {
    const delayMs = job.retryDelaySeconds * 1000;
    logger.info({ jobId: job.id, attempt, nextAttempt: attempt + 1, delayMs }, "Scheduling retry");
    setTimeout(() => runJobWithRetry(db, svc, secSvc, job, attempt + 1), delayMs);
    return;
  }

  // On final failure: send notifications
  if (!succeeded && attempt > job.retryMax) {
    await sendFailureNotifications(db, job, result.error ?? "Unknown error", attempt, secSvc);
  }
}

async function sendFailureNotifications(
  db: Db,
  job: NonNullable<Awaited<ReturnType<ReturnType<typeof scheduledJobsService>["get"]>>>,
  errorMessage: string,
  finalAttempt: number,
  secSvc: ReturnType<typeof secretService>,
): Promise<void> {
  // In-app notification (stored in activity log — UI polls for it)
  if (job.onFailureNotifyInApp) {
    try {
      const { logActivity } = await import("./activity-log.js");
      await logActivity(db, {
        companyId: job.companyId,
        actorType: "system",
        actorId: "scheduler",
        action: "scheduled_job.failed",
        resourceType: "scheduled_job",
        resourceId: job.id,
        metadata: { jobName: job.name, error: errorMessage, attempts: finalAttempt },
      });
    } catch (err) {
      logger.error({ err }, "Failed to log in-app notification");
    }
  }

  // Failure webhook
  if (job.onFailureWebhookUrl) {
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (job.onFailureWebhookSecretId) {
        const secret = await secSvc.getValue(job.onFailureWebhookSecretId, job.companyId);
        if (secret) headers["Authorization"] = `Bearer ${secret}`;
      }
      await fetch(job.onFailureWebhookUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          event: "scheduled_job.failed",
          job_id: job.id,
          job_name: job.name,
          error: errorMessage,
          attempts: finalAttempt,
          company_id: job.companyId,
        }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch (err) {
      logger.error({ err, jobId: job.id }, "Failed to send failure webhook");
    }
  }
}
```

**Step 2: Export from services index**

Add to `server/src/services/index.ts`:
```typescript
export { startSchedulerLoop, stopSchedulerLoop } from "./scheduler-loop.js";
```

**Step 3: Start loop on server startup**

In `server/src/index.ts`, find where `heartbeatService` is imported and used, then add after it starts:
```typescript
import { startSchedulerLoop } from "./services/index.js";
// ... after server starts listening:
startSchedulerLoop(db);
```

Find the `server.listen` callback in `server/src/index.ts` and add `startSchedulerLoop(db)` there.

**Step 4: Commit**
```bash
git add server/src/services/scheduler-loop.ts server/src/services/index.ts server/src/index.ts
git commit -m "feat(server): add scheduler loop — runs due jobs every 60s"
```

---

## Task 7: REST API Routes

**Files:**
- Create: `server/src/routes/scheduled-jobs.ts`
- Modify: `server/src/app.ts`

**Step 1: Create routes file**

```typescript
// server/src/routes/scheduled-jobs.ts
import { Router } from "express";
import type { Db } from "@sanadai/db";
import { assertBoard, assertCompanyAccess } from "./authz.js";
import { scheduledJobsService } from "../services/scheduled-jobs.js";
import { executeKnowledgeSync, executeWebhook, executeAgentRun } from "../services/scheduled-job-executors.js";
import { secretService } from "../services/index.js";

export function scheduledJobRoutes(db: Db) {
  const router = Router();

  // List jobs for a company
  router.get("/companies/:companyId/scheduled-jobs", async (req, res) => {
    assertBoard(req);
    const { companyId } = req.params;
    assertCompanyAccess(req, companyId);
    const svc = scheduledJobsService(db);
    const jobs = await svc.list(companyId);
    res.json({ jobs });
  });

  // Create job
  router.post("/companies/:companyId/scheduled-jobs", async (req, res) => {
    assertBoard(req);
    const { companyId } = req.params;
    assertCompanyAccess(req, companyId);
    const svc = scheduledJobsService(db);
    const job = await svc.create({ ...req.body, companyId });
    res.status(201).json({ job });
  });

  // Get single job
  router.get("/companies/:companyId/scheduled-jobs/:jobId", async (req, res) => {
    assertBoard(req);
    const { companyId, jobId } = req.params;
    assertCompanyAccess(req, companyId);
    const svc = scheduledJobsService(db);
    const job = await svc.get(jobId);
    if (!job || job.companyId !== companyId) return res.status(404).json({ error: "Not found" });
    res.json({ job });
  });

  // Update job
  router.patch("/companies/:companyId/scheduled-jobs/:jobId", async (req, res) => {
    assertBoard(req);
    const { companyId, jobId } = req.params;
    assertCompanyAccess(req, companyId);
    const svc = scheduledJobsService(db);
    const existing = await svc.get(jobId);
    if (!existing || existing.companyId !== companyId) return res.status(404).json({ error: "Not found" });
    const job = await svc.update(jobId, req.body);
    res.json({ job });
  });

  // Delete job
  router.delete("/companies/:companyId/scheduled-jobs/:jobId", async (req, res) => {
    assertBoard(req);
    const { companyId, jobId } = req.params;
    assertCompanyAccess(req, companyId);
    const svc = scheduledJobsService(db);
    const existing = await svc.get(jobId);
    if (!existing || existing.companyId !== companyId) return res.status(404).json({ error: "Not found" });
    await svc.delete(jobId);
    res.json({ ok: true });
  });

  // Pause / resume
  router.post("/companies/:companyId/scheduled-jobs/:jobId/pause", async (req, res) => {
    assertBoard(req);
    const { companyId, jobId } = req.params;
    assertCompanyAccess(req, companyId);
    const svc = scheduledJobsService(db);
    const job = await svc.setEnabled(jobId, false);
    if (!job || job.companyId !== companyId) return res.status(404).json({ error: "Not found" });
    res.json({ job });
  });

  router.post("/companies/:companyId/scheduled-jobs/:jobId/resume", async (req, res) => {
    assertBoard(req);
    const { companyId, jobId } = req.params;
    assertCompanyAccess(req, companyId);
    const svc = scheduledJobsService(db);
    const job = await svc.setEnabled(jobId, true);
    if (!job || job.companyId !== companyId) return res.status(404).json({ error: "Not found" });
    res.json({ job });
  });

  // Run now (manual trigger)
  router.post("/companies/:companyId/scheduled-jobs/:jobId/run", async (req, res) => {
    assertBoard(req);
    const { companyId, jobId } = req.params;
    assertCompanyAccess(req, companyId);
    const svc = scheduledJobsService(db);
    const secSvc = secretService(db);
    const job = await svc.get(jobId);
    if (!job || job.companyId !== companyId) return res.status(404).json({ error: "Not found" });

    // Fire async — respond immediately
    res.json({ ok: true, message: "Job triggered" });

    const run = await svc.createRun(jobId, companyId, 1, "manual");
    const brainApiUrl = process.env.SANAD_BRAIN_URL ?? "http://localhost:8100";
    const brainApiKey = process.env.SANAD_BRAIN_API_KEY ?? "";

    let result: { output: string; error?: string; heartbeatRunId?: string };
    if (job.jobType === "knowledge_sync") {
      result = await executeKnowledgeSync(job, brainApiUrl, brainApiKey);
    } else if (job.jobType === "webhook") {
      result = await executeWebhook(job, async (secretId) => {
        const secret = await secSvc.getValue(secretId, companyId);
        return secret ?? null;
      });
    } else {
      result = await executeAgentRun(job, db);
    }
    await svc.finishRun(run.id, result.error ? "failed" : "success", result.output, result.error, result.heartbeatRunId);
  });

  // Get run logs
  router.get("/companies/:companyId/scheduled-jobs/:jobId/runs", async (req, res) => {
    assertBoard(req);
    const { companyId, jobId } = req.params;
    assertCompanyAccess(req, companyId);
    const svc = scheduledJobsService(db);
    const existing = await svc.get(jobId);
    if (!existing || existing.companyId !== companyId) return res.status(404).json({ error: "Not found" });
    const limit = Math.min(Number(req.query.limit ?? 20), 100);
    const runs = await svc.listRuns(jobId, limit);
    res.json({ runs });
  });

  return router;
}
```

**Step 2: Register route in app.ts**

In `server/src/app.ts`, add import:
```typescript
import { scheduledJobRoutes } from "./routes/scheduled-jobs.js";
```

Add inside the `// Mount API routes` section:
```typescript
api.use(scheduledJobRoutes(db));
```

**Step 3: Commit**
```bash
git add server/src/routes/scheduled-jobs.ts server/src/app.ts
git commit -m "feat(server): add scheduled jobs REST API routes"
```

---

## Task 8: UI — API Client

**Files:**
- Create: `ui/src/api/scheduled-jobs.ts`
- Modify: `ui/src/lib/queryKeys.ts`

**Step 1: Create API client**

```typescript
// ui/src/api/scheduled-jobs.ts
import { api } from "./client";

export interface ScheduledJob {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  scope: string;
  scopeTargetId: string | null;
  jobType: string; // knowledge_sync | webhook | agent_run
  config: Record<string, unknown>;
  cronExpression: string;
  timezone: string;
  timeoutSeconds: number | null;
  overlapPolicy: string;
  missedRunPolicy: string;
  retryMax: number;
  retryDelaySeconds: number;
  onFailureNotifyInApp: boolean;
  onFailureWebhookUrl: string | null;
  onFailureWebhookSecretId: string | null;
  enabled: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduledJobRun {
  id: string;
  jobId: string;
  status: string; // running | success | failed | timed_out | cancelled
  attempt: number;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  output: string | null;
  error: string | null;
  heartbeatRunId: string | null;
  triggeredBy: string;
  createdAt: string;
}

export type CreateJobInput = Omit<ScheduledJob, "id" | "companyId" | "createdAt" | "updatedAt" | "lastRunAt" | "nextRunAt">;

export const scheduledJobsApi = {
  list: (companyId: string) =>
    api.get<{ jobs: ScheduledJob[] }>(`/companies/${companyId}/scheduled-jobs`),

  get: (companyId: string, jobId: string) =>
    api.get<{ job: ScheduledJob }>(`/companies/${companyId}/scheduled-jobs/${jobId}`),

  create: (companyId: string, input: CreateJobInput) =>
    api.post<{ job: ScheduledJob }>(`/companies/${companyId}/scheduled-jobs`, input),

  update: (companyId: string, jobId: string, input: Partial<CreateJobInput>) =>
    api.patch<{ job: ScheduledJob }>(`/companies/${companyId}/scheduled-jobs/${jobId}`, input),

  delete: (companyId: string, jobId: string) =>
    api.delete<{ ok: boolean }>(`/companies/${companyId}/scheduled-jobs/${jobId}`),

  pause: (companyId: string, jobId: string) =>
    api.post<{ job: ScheduledJob }>(`/companies/${companyId}/scheduled-jobs/${jobId}/pause`, {}),

  resume: (companyId: string, jobId: string) =>
    api.post<{ job: ScheduledJob }>(`/companies/${companyId}/scheduled-jobs/${jobId}/resume`, {}),

  runNow: (companyId: string, jobId: string) =>
    api.post<{ ok: boolean }>(`/companies/${companyId}/scheduled-jobs/${jobId}/run`, {}),

  runs: (companyId: string, jobId: string, limit = 20) =>
    api.get<{ runs: ScheduledJobRun[] }>(`/companies/${companyId}/scheduled-jobs/${jobId}/runs?limit=${limit}`),
};
```

**Step 2: Add query keys**

In `ui/src/lib/queryKeys.ts`, add:
```typescript
scheduledJobs: {
  list: (companyId: string) => ["scheduled-jobs", companyId] as const,
  runs: (companyId: string, jobId: string) => ["scheduled-job-runs", companyId, jobId] as const,
},
```

**Step 3: Commit**
```bash
git add ui/src/api/scheduled-jobs.ts ui/src/lib/queryKeys.ts
git commit -m "feat(ui): add scheduled jobs API client and query keys"
```

---

## Task 9: UI — JobDialog (Create/Edit)

**Files:**
- Create: `ui/src/components/scheduled-jobs/JobDialog.tsx`

**Step 1: Create dialog component**

Build `JobDialog` from the approved prototype. Key sections:
- Basic: name, description, scope, assignment
- Job type: 3 visual cards (Knowledge Sync / Webhook / Agent Run) with default timeout shown
- Dynamic config per type (knowledge_sync: source select; webhook: URL + method + secret ref + body; agent_run: agent + title + description)
- Schedule: cron preset pills + raw input + live human-readable preview
- Timezone selector
- Accordion: Execution Settings (timeout auto/custom, overlap policy skip/queue, missed run policy skip/run_once)
- Accordion: Retry on Failure (max retries pills 0–5, delay pills 5min/15min/1hr)
- Accordion: On Failure Notifications (in-app toggle, failure webhook toggle + URL + secret)

See prototype at `docs/prototypes/scheduled-jobs.html` for exact UI.

Use `useQuery` for loading agents/sources/secrets. Use `useMutation` for create/update.

**Step 2: Commit**
```bash
git add ui/src/components/scheduled-jobs/JobDialog.tsx
git commit -m "feat(ui): add JobDialog component for create/edit scheduled jobs"
```

---

## Task 10: UI — JobLogsDrawer

**Files:**
- Create: `ui/src/components/scheduled-jobs/JobLogsDrawer.tsx`

**Step 1: Create drawer component**

Drawer slides in from right. Shows:
- Header: job name + "Kept 90 days · last 20 runs shown"
- Each run: status dot (green/red/yellow), status text, time, duration
- Yellow "retry #N" badge for attempt > 1
- Monospace output/error block when expanded (click to expand)
- For agent_run type: "→ View full agent run" link with heartbeatRunId
- Uses `useQuery` with `scheduledJobsApi.runs()`

**Step 2: Commit**
```bash
git add ui/src/components/scheduled-jobs/JobLogsDrawer.tsx
git commit -m "feat(ui): add JobLogsDrawer component"
```

---

## Task 11: UI — ScheduledJobs Page

**Files:**
- Create: `ui/src/pages/ScheduledJobs.tsx`
- Create: `ui/src/components/scheduled-jobs/JobsTable.tsx`
- Create: `ui/src/components/scheduled-jobs/JobsCards.tsx`

**Step 1: Create JobsTable**

Table columns: Name (+ description), Scope badge, Type badge, Schedule (human + cron), Last Run (dot + relative time + duration), Next Run, Status pill, Actions (run/logs/pause/edit/delete).

Error rows: show "Failed after N attempts · error text" in Last Run cell.
Running rows: show pulsing yellow dot + "running · Xm" in name.
Paused rows: 55% opacity.

**Step 2: Create JobsCards**

Cards grouped by scope (Company Jobs / Agent Jobs / Project Jobs). Each card: name, type + scope badges, status pill, schedule box (human label + cron + last/next), action buttons (Run / Logs / edit icon).

**Step 3: Create ScheduledJobs page**

```typescript
// ui/src/pages/ScheduledJobs.tsx
// - useCompany() for companyId
// - useQuery scheduledJobsApi.list()
// - Filter bar: search, scope, type, status, table/cards toggle
// - Stats header: "N jobs · M active · K error"
// - Renders JobsTable or JobsCards
// - JobDialog for create/edit
// - JobLogsDrawer for logs
// - Auto-refresh every 30s when any job is running
// - Toast on run-now action
```

**Step 4: Commit**
```bash
git add ui/src/pages/ScheduledJobs.tsx ui/src/components/scheduled-jobs/
git commit -m "feat(ui): add ScheduledJobs page with table and card views"
```

---

## Task 12: UI — Routing + Sidebar

**Files:**
- Modify: `ui/src/App.tsx`
- Modify: `ui/src/components/AppSidebar.tsx` (or wherever sidebar nav lives)

**Step 1: Add route in App.tsx**

```typescript
import { ScheduledJobs } from "./pages/ScheduledJobs";
// In router config:
<Route path=":boardSlug/jobs" element={<ScheduledJobs />} />
```

**Step 2: Add sidebar item**

Find the sidebar navigation file. Add "Scheduled Jobs" item with clock icon, linking to `/:boardSlug/jobs`.

**Step 3: Build and deploy**
```bash
cd /home/eslam/data/projects/paperclip/ui && pnpm build
scp -r dist/* paperclip-server:/app/ui/dist/
docker restart paperclip-server-1
```

**Step 4: Commit**
```bash
git add ui/src/App.tsx ui/src/components/AppSidebar.tsx
git commit -m "feat(ui): add /jobs route and sidebar navigation"
```

---

## Quality Gates (run after EVERY task)

```bash
# After each task:
# 1. /clean-code on changed files
# 2. /code-review on changed files
# 3. Fix any MUST FIX issues before committing
```

## Environment Variables Required

Add to server `.env` / config:
```
SANAD_BRAIN_URL=http://100.109.59.30:8100
SANAD_BRAIN_API_KEY=<brain_api_key>
```

## Post-Deployment Testing Checklist

- [ ] Migration applied (`select count(*) from scheduled_jobs` returns 0 rows)
- [ ] Create a knowledge_sync job → verify it appears in table
- [ ] Click "Run now" → verify run appears in logs drawer with success/error
- [ ] Create a webhook job → run it → verify HTTP call was made
- [ ] Set retry=2 → trigger failure → verify 3 run rows in logs with attempt badges
- [ ] Pause a job → verify nextRunAt stops updating
- [ ] Scheduler loop running → check server logs for "Scheduler loop started"
- [ ] Check log retention: purgeOldRuns called periodically

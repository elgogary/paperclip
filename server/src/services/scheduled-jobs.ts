import { and, asc, desc, eq, lte } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { scheduledJobs, scheduledJobRuns } from "@paperclipai/db";
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
    const job = new Cron(cronExpression, { timezone });
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

    async update(jobId: string, input: Partial<Omit<CreateJobInput, "companyId">>): Promise<ScheduledJob | null> {
      const updates: Record<string, unknown> = { ...input, updatedAt: new Date() };
      if (input.cronExpression !== undefined || input.timezone !== undefined) {
        const existing = await this.get(jobId);
        if (existing) {
          const expr = input.cronExpression ?? existing.cronExpression;
          const tz = input.timezone ?? existing.timezone;
          updates.nextRunAt = computeNextRun(expr, tz);
        }
      }
      const rows = await db
        .update(scheduledJobs)
        .set(updates as Partial<typeof scheduledJobs.$inferInsert>)
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
      const runRows = await db
        .select()
        .from(scheduledJobRuns)
        .where(eq(scheduledJobRuns.id, runId))
        .limit(1);
      const durationMs = runRows[0]
        ? finishedAt.getTime() - new Date(runRows[0].startedAt).getTime()
        : null;
      await db
        .update(scheduledJobRuns)
        .set({
          status,
          finishedAt,
          durationMs,
          output: output ?? null,
          error: error ?? null,
          heartbeatRunId: heartbeatRunId ?? null,
        })
        .where(eq(scheduledJobRuns.id, runId));
      if (runRows[0]) {
        await db
          .update(scheduledJobs)
          .set({ lastRunAt: finishedAt, updatedAt: finishedAt })
          .where(eq(scheduledJobs.id, runRows[0].jobId));
      }
    },

    async updateNextRun(jobId: string): Promise<void> {
      const job = await this.get(jobId);
      if (!job) return;
      const nextRunAt = computeNextRun(job.cronExpression, job.timezone);
      await db
        .update(scheduledJobs)
        .set({ nextRunAt, updatedAt: new Date() })
        .where(eq(scheduledJobs.id, jobId));
    },

    // Used by scheduler loop — claims jobs due now with FOR UPDATE SKIP LOCKED (prevents dual execution)
    async claimDueJobs(): Promise<ScheduledJob[]> {
      const now = new Date();
      return db
        .select()
        .from(scheduledJobs)
        .where(and(eq(scheduledJobs.enabled, true), lte(scheduledJobs.nextRunAt, now)))
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

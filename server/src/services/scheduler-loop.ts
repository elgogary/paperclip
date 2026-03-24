import type { Db } from "@paperclipai/db";
import { logger } from "../middleware/logger.js";
import { scheduledJobsService, type ScheduledJob } from "./scheduled-jobs.js";
import { executeKnowledgeSync, executeWebhook, executeAgentRun } from "./scheduled-job-executors.js";
import { secretService } from "./secrets.js";
import { logActivity } from "./activity-log.js";

const LOOP_INTERVAL_MS = 60_000;
let loopTimer: NodeJS.Timeout | null = null;

export function startSchedulerLoop(db: Db): void {
  if (loopTimer) return;
  logger.info("Scheduler loop started (interval: 60s)");

  const tick = async () => {
    try {
      await runSchedulerTick(db);
    } catch (err) {
      logger.error({ err }, "Scheduler tick error");
    }
  };

  loopTimer = setInterval(tick, LOOP_INTERVAL_MS);
  tick(); // run immediately on start to handle missed runs
}

export function stopSchedulerLoop(): void {
  if (loopTimer) {
    clearInterval(loopTimer);
    loopTimer = null;
    logger.info("Scheduler loop stopped");
  }
}

async function runSchedulerTick(db: Db): Promise<void> {
  const svc = scheduledJobsService(db);

  // Purge old runs ~once per hour (1/60 chance per tick)
  if (Math.random() < 0.017) {
    const deleted = await svc.purgeOldRuns();
    if (deleted > 0) logger.info({ deleted }, "Purged old scheduled job runs");
  }

  const dueJobs = await svc.claimDueJobs();
  if (dueJobs.length === 0) return;

  logger.info({ count: dueJobs.length }, "Scheduler: dispatching due jobs");
  await Promise.allSettled(dueJobs.map((job) => runJobWithRetry(db, svc, job, 1)));
}

async function runJobWithRetry(
  db: Db,
  svc: ReturnType<typeof scheduledJobsService>,
  job: ScheduledJob,
  attempt: number,
): Promise<void> {
  const secSvc = secretService(db);
  const brainApiUrl = process.env.SANAD_BRAIN_URL ?? "http://localhost:8100";
  const brainApiKey = process.env.SANAD_BRAIN_API_KEY ?? "";

  const triggeredBy = attempt === 1 ? "scheduler" : "retry";
  const run = await svc.createRun(job.id, job.companyId, attempt, triggeredBy);

  let result: { output: string; error?: string; heartbeatRunId?: string };

  try {
    if (job.jobType === "knowledge_sync") {
      result = await executeKnowledgeSync(job, brainApiUrl, brainApiKey);
    } else if (job.jobType === "webhook") {
      result = await executeWebhook(job, (secretId) => secSvc.resolveById(job.companyId, secretId));
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
  await svc.updateNextRun(job.id);

  if (!succeeded && attempt < job.retryMax) {
    const delayMs = job.retryDelaySeconds * 1000;
    logger.info({ jobId: job.id, attempt, nextAttempt: attempt + 1, delayMs }, "Scheduling retry");
    setTimeout(() => runJobWithRetry(db, svc, job, attempt + 1), delayMs);
    return;
  }

  if (!succeeded && attempt >= job.retryMax) {
    await sendFailureNotifications(db, job, result.error ?? "Unknown error", attempt, secSvc);
  }
}

async function sendFailureNotifications(
  db: Db,
  job: ScheduledJob,
  errorMessage: string,
  finalAttempt: number,
  secSvc: ReturnType<typeof secretService>,
): Promise<void> {
  if (job.onFailureNotifyInApp) {
    try {
      await logActivity(db, {
        companyId: job.companyId,
        actorType: "system",
        actorId: "scheduler",
        action: "scheduled_job.failed",
        entityType: "scheduled_job",
        entityId: job.id,
        details: { jobName: job.name, error: errorMessage, attempts: finalAttempt },
      });
    } catch (err) {
      logger.error({ err }, "Failed to write in-app failure notification");
    }
  }

  if (job.onFailureWebhookUrl) {
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (job.onFailureWebhookSecretId) {
        const secret = await secSvc.resolveById(job.companyId, job.onFailureWebhookSecretId);
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
      logger.error({ err, jobId: job.id }, "Failed to deliver failure webhook");
    }
  }
}

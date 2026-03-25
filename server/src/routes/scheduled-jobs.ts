import { type Response, Router } from "express";
import type { Db } from "@paperclipai/db";
import { assertBoard, assertCompanyAccess } from "./authz.js";
import { scheduledJobsService, type ScheduledJob } from "../services/scheduled-jobs.js";
import { executeKnowledgeSync, executeWebhook, executeAgentRun, executeDream, executeMemoryIngest } from "../services/scheduled-job-executors.js";
import { secretService } from "../services/secrets.js";
import { logger } from "../middleware/logger.js";

// Fetch a job and verify it belongs to the company. Returns null and sends 404 if not found.
async function getJobOrNotFound(
  svc: ReturnType<typeof scheduledJobsService>,
  jobId: string,
  companyId: string,
  res: Response,
): Promise<ScheduledJob | null> {
  const job = await svc.get(jobId);
  if (!job || job.companyId !== companyId) {
    res.status(404).json({ error: "Not found" });
    return null;
  }
  return job;
}

export function scheduledJobRoutes(db: Db) {
  const router = Router();
  const svc = scheduledJobsService(db);

  router.get("/companies/:companyId/scheduled-jobs", async (req, res) => {
    assertBoard(req);
    const { companyId } = req.params as { companyId: string };
    assertCompanyAccess(req, companyId);

    const jobs = await svc.list(companyId);
    res.json({ jobs });
  });

  router.post("/companies/:companyId/scheduled-jobs", async (req, res) => {
    assertBoard(req);
    const { companyId } = req.params as { companyId: string };
    assertCompanyAccess(req, companyId);

    const {
      name, description, scope, scopeTargetId, jobType, config, cronExpression, timezone,
      timeoutSeconds, overlapPolicy, missedRunPolicy, retryMax, retryDelaySeconds,
      onFailureNotifyInApp, onFailureWebhookUrl, onFailureWebhookSecretId,
    } = req.body as Record<string, unknown>;
    const job = await svc.create({
      companyId, name: name as string, description: description as string | undefined,
      scope: (scope as string) ?? "company", scopeTargetId: scopeTargetId as string | undefined,
      jobType: jobType as string, config: (config as Record<string, unknown>) ?? {},
      cronExpression: cronExpression as string, timezone: timezone as string | undefined,
      timeoutSeconds: timeoutSeconds as number | undefined,
      overlapPolicy: overlapPolicy as string | undefined,
      missedRunPolicy: missedRunPolicy as string | undefined,
      retryMax: retryMax as number | undefined, retryDelaySeconds: retryDelaySeconds as number | undefined,
      onFailureNotifyInApp: onFailureNotifyInApp as boolean | undefined,
      onFailureWebhookUrl: onFailureWebhookUrl as string | undefined,
      onFailureWebhookSecretId: onFailureWebhookSecretId as string | undefined,
    });
    res.status(201).json({ job });
  });

  router.get("/companies/:companyId/scheduled-jobs/:jobId", async (req, res) => {
    assertBoard(req);
    const { companyId, jobId } = req.params as { companyId: string; jobId: string };
    assertCompanyAccess(req, companyId);

    const job = await getJobOrNotFound(svc, jobId, companyId, res);
    if (!job) return;
    res.json({ job });
  });

  router.patch("/companies/:companyId/scheduled-jobs/:jobId", async (req, res) => {
    assertBoard(req);
    const { companyId, jobId } = req.params as { companyId: string; jobId: string };
    assertCompanyAccess(req, companyId);

    const existing = await getJobOrNotFound(svc, jobId, companyId, res);
    if (!existing) return;
    const job = await svc.update(jobId, req.body);
    res.json({ job });
  });

  router.delete("/companies/:companyId/scheduled-jobs/:jobId", async (req, res) => {
    assertBoard(req);
    const { companyId, jobId } = req.params as { companyId: string; jobId: string };
    assertCompanyAccess(req, companyId);

    const existing = await getJobOrNotFound(svc, jobId, companyId, res);
    if (!existing) return;
    await svc.delete(jobId);
    res.json({ ok: true });
  });

  router.post("/companies/:companyId/scheduled-jobs/:jobId/pause", async (req, res) => {
    assertBoard(req);
    const { companyId, jobId } = req.params as { companyId: string; jobId: string };
    assertCompanyAccess(req, companyId);

    const existing = await getJobOrNotFound(svc, jobId, companyId, res);
    if (!existing) return;
    const job = await svc.setEnabled(jobId, false);
    res.json({ job });
  });

  router.post("/companies/:companyId/scheduled-jobs/:jobId/resume", async (req, res) => {
    assertBoard(req);
    const { companyId, jobId } = req.params as { companyId: string; jobId: string };
    assertCompanyAccess(req, companyId);

    const existing = await getJobOrNotFound(svc, jobId, companyId, res);
    if (!existing) return;
    const job = await svc.setEnabled(jobId, true);
    res.json({ job });
  });

  // Manual run-now trigger — responds immediately, executes in background
  router.post("/companies/:companyId/scheduled-jobs/:jobId/run", async (req, res) => {
    assertBoard(req);
    const { companyId, jobId } = req.params as { companyId: string; jobId: string };
    assertCompanyAccess(req, companyId);

    const job = await getJobOrNotFound(svc, jobId, companyId, res);
    if (!job) return;

    res.json({ ok: true, message: "Job triggered" });

    // Fire-and-forget background execution — errors logged, not propagated
    void (async () => {
      try {
        const secSvc = secretService(db);
        const brainApiUrl = process.env.SANAD_BRAIN_URL ?? "http://localhost:8100";
        const brainApiKey = process.env.SANAD_BRAIN_API_KEY ?? "";
        const run = await svc.createRun(jobId, companyId, 1, "manual");
        let result: { output: string; error?: string; heartbeatRunId?: string };
        try {
          if (job.jobType === "knowledge_sync") {
            result = await executeKnowledgeSync(job, brainApiUrl, brainApiKey);
          } else if (job.jobType === "webhook") {
            result = await executeWebhook(job, (secretId) => secSvc.resolveById(companyId, secretId));
          } else if (job.jobType === "dream") {
            result = await executeDream(job, brainApiUrl, brainApiKey);
          } else if (job.jobType === "memory_ingest") {
            result = await executeMemoryIngest(job, brainApiUrl, brainApiKey);
          } else {
            result = await executeAgentRun(job, db);
          }
        } catch (err: unknown) {
          result = { output: "", error: err instanceof Error ? err.message : String(err) };
        }
        await svc.finishRun(run.id, result.error ? "failed" : "success", result.output, result.error, result.heartbeatRunId);
      } catch (err) {
        logger.error({ err, jobId }, "Background manual run failed");
      }
    })();
  });

  router.get("/companies/:companyId/scheduled-jobs/:jobId/runs", async (req, res) => {
    assertBoard(req);
    const { companyId, jobId } = req.params as { companyId: string; jobId: string };
    assertCompanyAccess(req, companyId);

    const existing = await getJobOrNotFound(svc, jobId, companyId, res);
    if (!existing) return;
    const limit = Math.min(Number(req.query.limit ?? 20), 100);
    const runs = await svc.listRuns(jobId, limit);
    res.json({ runs });
  });

  return router;
}

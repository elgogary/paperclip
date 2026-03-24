import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { assertBoard, assertCompanyAccess } from "./authz.js";
import { scheduledJobsService } from "../services/scheduled-jobs.js";
import { executeKnowledgeSync, executeWebhook, executeAgentRun } from "../services/scheduled-job-executors.js";
import { secretService } from "../services/secrets.js";
import { logger } from "../middleware/logger.js";

export function scheduledJobRoutes(db: Db) {
  const router = Router();

  router.get("/companies/:companyId/scheduled-jobs", async (req, res) => {
    assertBoard(req);
    const { companyId } = req.params as { companyId: string };
    assertCompanyAccess(req, companyId);
    const svc = scheduledJobsService(db);
    const jobs = await svc.list(companyId);
    res.json({ jobs });
  });

  router.post("/companies/:companyId/scheduled-jobs", async (req, res) => {
    assertBoard(req);
    const { companyId } = req.params as { companyId: string };
    assertCompanyAccess(req, companyId);
    const svc = scheduledJobsService(db);
    const job = await svc.create({ ...req.body, companyId });
    res.status(201).json({ job });
  });

  router.get("/companies/:companyId/scheduled-jobs/:jobId", async (req, res) => {
    assertBoard(req);
    const { companyId, jobId } = req.params as { companyId: string; jobId: string };
    assertCompanyAccess(req, companyId);
    const svc = scheduledJobsService(db);
    const job = await svc.get(jobId);
    if (!job || job.companyId !== companyId) return res.status(404).json({ error: "Not found" });
    res.json({ job });
  });

  router.patch("/companies/:companyId/scheduled-jobs/:jobId", async (req, res) => {
    assertBoard(req);
    const { companyId, jobId } = req.params as { companyId: string; jobId: string };
    assertCompanyAccess(req, companyId);
    const svc = scheduledJobsService(db);
    const existing = await svc.get(jobId);
    if (!existing || existing.companyId !== companyId) return res.status(404).json({ error: "Not found" });
    const job = await svc.update(jobId, req.body);
    res.json({ job });
  });

  router.delete("/companies/:companyId/scheduled-jobs/:jobId", async (req, res) => {
    assertBoard(req);
    const { companyId, jobId } = req.params as { companyId: string; jobId: string };
    assertCompanyAccess(req, companyId);
    const svc = scheduledJobsService(db);
    const existing = await svc.get(jobId);
    if (!existing || existing.companyId !== companyId) return res.status(404).json({ error: "Not found" });
    await svc.delete(jobId);
    res.json({ ok: true });
  });

  router.post("/companies/:companyId/scheduled-jobs/:jobId/pause", async (req, res) => {
    assertBoard(req);
    const { companyId, jobId } = req.params as { companyId: string; jobId: string };
    assertCompanyAccess(req, companyId);
    const svc = scheduledJobsService(db);
    const existing = await svc.get(jobId);
    if (!existing || existing.companyId !== companyId) return res.status(404).json({ error: "Not found" });
    const job = await svc.setEnabled(jobId, false);
    res.json({ job });
  });

  router.post("/companies/:companyId/scheduled-jobs/:jobId/resume", async (req, res) => {
    assertBoard(req);
    const { companyId, jobId } = req.params as { companyId: string; jobId: string };
    assertCompanyAccess(req, companyId);
    const svc = scheduledJobsService(db);
    const existing = await svc.get(jobId);
    if (!existing || existing.companyId !== companyId) return res.status(404).json({ error: "Not found" });
    const job = await svc.setEnabled(jobId, true);
    res.json({ job });
  });

  // Manual run-now trigger — responds immediately, executes async
  router.post("/companies/:companyId/scheduled-jobs/:jobId/run", async (req, res) => {
    assertBoard(req);
    const { companyId, jobId } = req.params as { companyId: string; jobId: string };
    assertCompanyAccess(req, companyId);
    const svc = scheduledJobsService(db);
    const job = await svc.get(jobId);
    if (!job || job.companyId !== companyId) return res.status(404).json({ error: "Not found" });

    res.json({ ok: true, message: "Job triggered" });

    // Execute in background
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
      } else {
        result = await executeAgentRun(job, db);
      }
    } catch (err: unknown) {
      result = { output: "", error: err instanceof Error ? err.message : String(err) };
    }

    await svc.finishRun(run.id, result.error ? "failed" : "success", result.output, result.error, result.heartbeatRunId);
  });

  router.get("/companies/:companyId/scheduled-jobs/:jobId/runs", async (req, res) => {
    assertBoard(req);
    const { companyId, jobId } = req.params as { companyId: string; jobId: string };
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

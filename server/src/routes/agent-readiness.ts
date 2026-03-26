import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { agentReadinessService } from "../services/agent-readiness.js";
import { notFound } from "../errors.js";

export function agentReadinessRoutes(db: Db) {
  const router = Router();

  // GET /api/agents/:id/readiness — calculate readiness score
  router.get("/agents/:id/readiness", async (req, res) => {
    try {
      const result = await agentReadinessService.calculate(db, req.params.id);
      res.json(result);
    } catch (e: any) {
      if (e.message === "Agent not found") throw notFound("Agent not found");
      throw e;
    }
  });

  // POST /api/agents/:id/metrics — record task completion metric
  router.post("/agents/:id/metrics", async (req, res) => {
    const { companyId, taskId, toolsUsed, skillsApplied, skillsFailed, fallbacksUsed, durationMinutes, tokensUsed, errors, success, notes } = req.body;
    if (typeof success !== "boolean") {
      return res.status(400).json({ error: "success (boolean) is required" });
    }
    if (!companyId) {
      return res.status(400).json({ error: "companyId is required" });
    }
    const row = await agentReadinessService.recordMetric(db, {
      companyId,
      agentId: req.params.id,
      taskId,
      toolsUsed,
      skillsApplied,
      skillsFailed,
      fallbacksUsed,
      durationMinutes,
      tokensUsed,
      errors,
      success,
      notes,
    });
    res.status(201).json(row);
  });

  // GET /api/agents/:id/metrics — get recent metrics
  router.get("/agents/:id/metrics", async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const rows = await agentReadinessService.getMetrics(db, req.params.id, limit);
    res.json(rows);
  });

  return router;
}

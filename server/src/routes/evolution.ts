import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { assertBoard, assertCompanyAccess } from "./authz.js";
import { skillEvolutionService } from "../services/skill-evolution.js";
import { skillMetricsTracker } from "../services/skill-metrics-tracker.js";

export function evolutionRoutes(db: Db) {
  const router = Router();
  const evoSvc = skillEvolutionService(db);
  const metricsSvc = skillMetricsTracker(db);

  // ── Evolution Events ──────────────────────────────────────────────────────

  router.get("/companies/:companyId/evolution/events", async (req, res) => {
    assertBoard(req);
    const { companyId } = req.params as { companyId: string };
    assertCompanyAccess(req, companyId);

    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
    const status = req.query.status as string | undefined;
    const events = await evoSvc.listEvents(companyId, { limit, status });
    res.json({ events });
  });

  router.get("/companies/:companyId/evolution/events/:eventId", async (req, res) => {
    assertBoard(req);
    const { companyId, eventId } = req.params as { companyId: string; eventId: string };
    assertCompanyAccess(req, companyId);

    const event = await evoSvc.getEvent(eventId);
    if (!event || event.companyId !== companyId) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ event });
  });

  router.post("/companies/:companyId/evolution/events/:eventId/approve", async (req, res) => {
    assertBoard(req);
    const { companyId, eventId } = req.params as { companyId: string; eventId: string };
    assertCompanyAccess(req, companyId);

    const event = await evoSvc.getEvent(eventId);
    if (!event || event.companyId !== companyId) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    try {
      await evoSvc.applyEvolution(eventId);
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Bad request" });
    }
  });

  router.post("/companies/:companyId/evolution/events/:eventId/reject", async (req, res) => {
    assertBoard(req);
    const { companyId, eventId } = req.params as { companyId: string; eventId: string };
    assertCompanyAccess(req, companyId);

    const event = await evoSvc.getEvent(eventId);
    if (!event || event.companyId !== companyId) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const { reason } = req.body as { reason?: string };
    try {
      await evoSvc.rejectEvolution(eventId, reason ?? "rejected_by_board");
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Bad request" });
    }
  });

  // ── Skill Agent Metrics ───────────────────────────────────────────────────

  router.get("/companies/:companyId/skills/:skillId/metrics", async (req, res) => {
    assertBoard(req);
    const { companyId, skillId } = req.params as { companyId: string; skillId: string };
    assertCompanyAccess(req, companyId);

    const metrics = await metricsSvc.getSkillMetrics(skillId);
    res.json({ metrics });
  });

  router.post("/companies/:companyId/skills/:skillId/metrics/record", async (req, res) => {
    assertBoard(req);
    const { companyId, skillId } = req.params as { companyId: string; skillId: string };
    assertCompanyAccess(req, companyId);

    const { skillVersion, agentId, used, successful, tokenCount } = req.body as {
      skillVersion: number;
      agentId: string;
      used: boolean;
      successful: boolean;
      tokenCount?: number;
    };

    if (!skillVersion || !agentId || used === undefined || successful === undefined) {
      res.status(400).json({ error: "skillVersion, agentId, used, and successful are required" });
      return;
    }

    try {
      await metricsSvc.recordUsage({ skillId, skillVersion, agentId, used, successful, tokenCount });
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Bad request" });
    }
  });

  return router;
}

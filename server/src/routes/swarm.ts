import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { assertBoard, assertCompanyAccess } from "./authz.js";
import { swarmService } from "../services/swarm.js";

export function swarmRoutes(db: Db) {
  const router = Router();
  const svc = swarmService(db);

  // ── Sources ──
  router.get("/companies/:companyId/swarm/sources", async (req, res) => {
    assertBoard(req);
    const { companyId } = req.params as { companyId: string };
    assertCompanyAccess(req, companyId);
    const sources = await svc.listSources(companyId);
    res.json({ sources });
  });

  router.post("/companies/:companyId/swarm/sources", async (req, res) => {
    assertBoard(req);
    const { companyId } = req.params as { companyId: string };
    assertCompanyAccess(req, companyId);
    const { name, url, sourceType, trustLevel, capabilityTypes, syncIntervalMinutes, metadata } = req.body;
    if (!name || !url || !sourceType) {
      res.status(400).json({ error: "name, url, and sourceType are required" });
      return;
    }
    try {
      const source = await svc.createSource({ companyId, name, url, sourceType, trustLevel, capabilityTypes, syncIntervalMinutes, metadata });
      await svc.logAudit({ companyId, action: "source_added", capabilityName: name, actorType: "board", actorBoardUserId: req.actor?.userId, detail: `Source ${name} (${sourceType}) added` });
      res.status(201).json({ source });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Bad request" });
    }
  });

  router.patch("/companies/:companyId/swarm/sources/:sourceId", async (req, res) => {
    assertBoard(req);
    const { companyId, sourceId } = req.params as { companyId: string; sourceId: string };
    assertCompanyAccess(req, companyId);
    const existing = await svc.getSource(sourceId);
    if (!existing || existing.companyId !== companyId) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const { name, url, trustLevel, capabilityTypes, enabled, syncIntervalMinutes, metadata } = req.body;
    await svc.updateSource(sourceId, { name, url, trustLevel, capabilityTypes, enabled, syncIntervalMinutes, metadata });
    res.json({ ok: true });
  });

  router.delete("/companies/:companyId/swarm/sources/:sourceId", async (req, res) => {
    assertBoard(req);
    const { companyId, sourceId } = req.params as { companyId: string; sourceId: string };
    assertCompanyAccess(req, companyId);
    const existing = await svc.getSource(sourceId);
    if (!existing || existing.companyId !== companyId) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    await svc.deleteSource(sourceId);
    await svc.logAudit({ companyId, action: "source_removed", capabilityName: existing.name, actorType: "board", actorBoardUserId: req.actor?.userId, detail: `Source ${existing.name} removed` });
    res.json({ ok: true });
  });

  // ── Capabilities (catalog) ──
  router.get("/companies/:companyId/swarm/capabilities", async (req, res) => {
    assertBoard(req);
    const { companyId } = req.params as { companyId: string };
    assertCompanyAccess(req, companyId);
    const { type, search, trustLevel, pricingTier } = req.query as Record<string, string | undefined>;
    const capabilities = await svc.listCapabilities(companyId, { type, search, trustLevel, pricingTier });
    res.json({ capabilities });
  });

  router.get("/companies/:companyId/swarm/capabilities/:capabilityId", async (req, res) => {
    assertBoard(req);
    const { companyId, capabilityId } = req.params as { companyId: string; capabilityId: string };
    assertCompanyAccess(req, companyId);
    const capability = await svc.getCapability(capabilityId);
    if (!capability || capability.companyId !== companyId) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ capability });
  });

  router.get("/companies/:companyId/swarm/capabilities/counts", async (req, res) => {
    assertBoard(req);
    const { companyId } = req.params as { companyId: string };
    assertCompanyAccess(req, companyId);
    const counts = await svc.getCapabilityCounts(companyId);
    res.json({ counts });
  });

  // ── Installs ──
  router.get("/companies/:companyId/swarm/installs", async (req, res) => {
    assertBoard(req);
    const { companyId } = req.params as { companyId: string };
    assertCompanyAccess(req, companyId);
    const { type, status } = req.query as Record<string, string | undefined>;
    const installs = await svc.listInstalls(companyId, { type, status });
    res.json({ installs });
  });

  router.post("/companies/:companyId/swarm/installs", async (req, res) => {
    assertBoard(req);
    const { companyId } = req.params as { companyId: string };
    assertCompanyAccess(req, companyId);
    const { capabilityId, name, capabilityType, version, pricingTier, priceMonthlyUsd, config, metadata } = req.body;
    if (!name || !capabilityType) {
      res.status(400).json({ error: "name and capabilityType are required" });
      return;
    }
    try {
      const install = await svc.installCapability({
        companyId,
        capabilityId,
        name,
        capabilityType,
        version,
        installedByBoard: req.actor?.userId,
        approvedBy: req.actor?.userId ?? "auto",
        pricingTier,
        priceMonthlyUsd,
        config,
        metadata,
      });
      await svc.logAudit({
        companyId,
        action: "install",
        capabilityName: name,
        capabilityType,
        actorType: "board",
        actorBoardUserId: req.actor?.userId,
        detail: `Installed ${name} (${capabilityType})`,
        costUsd: priceMonthlyUsd ?? 0,
      });
      res.status(201).json({ install });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Bad request" });
    }
  });

  router.post("/companies/:companyId/swarm/installs/:installId/disable", async (req, res) => {
    assertBoard(req);
    const { companyId, installId } = req.params as { companyId: string; installId: string };
    assertCompanyAccess(req, companyId);
    const existing = await svc.getInstall(installId);
    if (!existing || existing.companyId !== companyId) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    await svc.updateInstallStatus(installId, "disabled");
    await svc.logAudit({ companyId, action: "remove", capabilityName: existing.name, capabilityType: existing.capabilityType, actorType: "board", actorBoardUserId: req.actor?.userId, detail: `Disabled ${existing.name}` });
    res.json({ ok: true });
  });

  router.delete("/companies/:companyId/swarm/installs/:installId", async (req, res) => {
    assertBoard(req);
    const { companyId, installId } = req.params as { companyId: string; installId: string };
    assertCompanyAccess(req, companyId);
    const existing = await svc.getInstall(installId);
    if (!existing || existing.companyId !== companyId) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    await svc.updateInstallStatus(installId, "removed");
    await svc.logAudit({ companyId, action: "remove", capabilityName: existing.name, capabilityType: existing.capabilityType, actorType: "board", actorBoardUserId: req.actor?.userId, detail: `Removed ${existing.name}` });
    res.json({ ok: true });
  });

  router.get("/companies/:companyId/swarm/installs/counts", async (req, res) => {
    assertBoard(req);
    const { companyId } = req.params as { companyId: string };
    assertCompanyAccess(req, companyId);
    const counts = await svc.getInstallCounts(companyId);
    res.json({ counts });
  });

  // ── Audit Log ──
  router.get("/companies/:companyId/swarm/audit", async (req, res) => {
    assertBoard(req);
    const { companyId } = req.params as { companyId: string };
    assertCompanyAccess(req, companyId);
    const { action, limit } = req.query as Record<string, string | undefined>;
    const entries = await svc.listAuditLog(companyId, { action, limit: limit ? parseInt(limit, 10) : undefined });
    res.json({ entries });
  });

  return router;
}

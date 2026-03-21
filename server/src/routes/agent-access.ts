import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { agentAccessService } from "../services/index.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";

export function agentAccessRoutes(db: Db) {
  const router = Router();
  const svc = agentAccessService(db);

  router.get("/companies/:companyId/agent-access", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const result = await svc.listByCompany(companyId);
    res.json(result);
  });

  router.get("/agents/:agentId/access", async (req, res) => {
    const agentId = req.params.agentId as string;
    const grants = await svc.listByAgent(agentId);
    res.json(grants);
  });

  router.post("/companies/:companyId/agent-access", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);

    const { agentId, userId } = req.body as { agentId: string; userId: string };
    if (!agentId || !userId) {
      res.status(422).json({ error: "agentId and userId are required" });
      return;
    }

    const actor = getActorInfo(req);
    const grant = await svc.grant({
      companyId,
      agentId,
      userId,
      grantedBy: actor.actorId,
    });

    if (!grant) {
      res.status(200).json({ status: "already_granted" });
      return;
    }

    res.status(201).json(grant);
  });

  router.delete("/agent-access/:grantId", async (req, res) => {
    const grantId = req.params.grantId as string;
    const deleted = await svc.revoke(grantId);
    if (!deleted) {
      res.status(404).json({ error: "Grant not found" });
      return;
    }
    res.json(deleted);
  });

  return router;
}

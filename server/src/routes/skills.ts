import { type Response, Router } from "express";
import type { Db } from "@paperclipai/db";
import { assertBoard, assertCompanyAccess } from "./authz.js";
import { skillsService, type Skill } from "../services/skills.js";

async function getSkillOrNotFound(
  svc: ReturnType<typeof skillsService>,
  skillId: string,
  companyId: string,
  res: Response,
): Promise<Skill | null> {
  const skill = await svc.get(skillId);
  if (!skill || skill.companyId !== companyId) {
    res.status(404).json({ error: "Not found" });
    return null;
  }
  return skill;
}

export function skillRoutes(db: Db) {
  const router = Router();
  const svc = skillsService(db);

  router.get("/companies/:companyId/skills", async (req, res) => {
    assertBoard(req);
    const { companyId } = req.params as { companyId: string };
    assertCompanyAccess(req, companyId);

    const skills = await svc.list(companyId);
    res.json({ skills });
  });

  router.post("/companies/:companyId/skills", async (req, res) => {
    assertBoard(req);
    const { companyId } = req.params as { companyId: string };
    assertCompanyAccess(req, companyId);

    try {
      const { name, description, icon, category, source, instructions, triggerHint, invokedBy, enabled, createdBy } = req.body;
      const skill = await svc.create({ companyId, name, description, icon, category, source, instructions, triggerHint, invokedBy, enabled, createdBy });
      res.status(201).json({ skill });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Bad request" });
    }
  });

  router.get("/companies/:companyId/skills/:skillId", async (req, res) => {
    assertBoard(req);
    const { companyId, skillId } = req.params as { companyId: string; skillId: string };
    assertCompanyAccess(req, companyId);

    const skill = await getSkillOrNotFound(svc, skillId, companyId, res);
    if (!skill) return;
    res.json({ skill });
  });

  router.patch("/companies/:companyId/skills/:skillId", async (req, res) => {
    assertBoard(req);
    const { companyId, skillId } = req.params as { companyId: string; skillId: string };
    assertCompanyAccess(req, companyId);

    const existing = await getSkillOrNotFound(svc, skillId, companyId, res);
    if (!existing) return;
    try {
      const { name, description, icon, category, source, instructions, triggerHint, invokedBy, enabled } = req.body;
      const skill = await svc.update(skillId, { name, description, icon, category, source, instructions, triggerHint, invokedBy, enabled });
      res.json({ skill });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Bad request" });
    }
  });

  router.delete("/companies/:companyId/skills/:skillId", async (req, res) => {
    assertBoard(req);
    const { companyId, skillId } = req.params as { companyId: string; skillId: string };
    assertCompanyAccess(req, companyId);

    const existing = await getSkillOrNotFound(svc, skillId, companyId, res);
    if (!existing) return;
    await svc.remove(skillId);
    res.json({ ok: true });
  });

  router.get("/companies/:companyId/skills/:skillId/access", async (req, res) => {
    assertBoard(req);
    const { companyId, skillId } = req.params as { companyId: string; skillId: string };
    assertCompanyAccess(req, companyId);

    const existing = await getSkillOrNotFound(svc, skillId, companyId, res);
    if (!existing) return;
    const access = await svc.listAccess(skillId);
    res.json({ access });
  });

  router.put("/companies/:companyId/skills/:skillId/access", async (req, res) => {
    assertBoard(req);
    const { companyId, skillId } = req.params as { companyId: string; skillId: string };
    assertCompanyAccess(req, companyId);

    const existing = await getSkillOrNotFound(svc, skillId, companyId, res);
    if (!existing) return;
    const { grants } = req.body as { grants?: unknown };
    if (!Array.isArray(grants)) {
      res.status(400).json({ error: "grants must be an array" });
      return;
    }
    await svc.bulkUpdateAccess(skillId, grants);
    res.json({ ok: true });
  });

  return router;
}

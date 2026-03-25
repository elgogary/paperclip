import { type Response, Router } from "express";
import type { Db } from "@paperclipai/db";
import { assertBoard, assertCompanyAccess } from "./authz.js";
import { skillsService, type Skill } from "../services/skills.js";
import { skillVersionsService } from "../services/skill-versions.js";
import { skillAuditService } from "../services/skill-audit.js";
import { skillCreatorService } from "../services/skill-creator.js";

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
  const versionsSvc = skillVersionsService(db);
  const auditSvc = skillAuditService(db);
  const creatorSvc = skillCreatorService(db);

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

  // ── Versioning & Evolution ──

  router.get("/companies/:companyId/skills/:skillId/versions", async (req, res) => {
    assertBoard(req);
    const { companyId, skillId } = req.params as { companyId: string; skillId: string };
    assertCompanyAccess(req, companyId);

    const existing = await getSkillOrNotFound(svc, skillId, companyId, res);
    if (!existing) return;
    const versions = await versionsSvc.listVersions(skillId);
    res.json({ versions });
  });

  router.get("/companies/:companyId/skills/:skillId/versions/:version", async (req, res) => {
    assertBoard(req);
    const { companyId, skillId, version } = req.params as { companyId: string; skillId: string; version: string };
    assertCompanyAccess(req, companyId);

    const existing = await getSkillOrNotFound(svc, skillId, companyId, res);
    if (!existing) return;
    const ver = await versionsSvc.getVersion(skillId, parseInt(version, 10));
    if (!ver) {
      res.status(404).json({ error: "Version not found" });
      return;
    }
    res.json({ version: ver });
  });

  router.post("/companies/:companyId/skills/:skillId/versions/:targetVersion/rollback", async (req, res) => {
    assertBoard(req);
    const { companyId, skillId, targetVersion } = req.params as { companyId: string; skillId: string; targetVersion: string };
    assertCompanyAccess(req, companyId);

    const existing = await getSkillOrNotFound(svc, skillId, companyId, res);
    if (!existing) return;
    try {
      const version = await versionsSvc.rollback(skillId, parseInt(targetVersion, 10));
      res.json({ version });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Bad request" });
    }
  });

  router.get("/companies/:companyId/skills/:skillId/versions/:v1/diff/:v2", async (req, res) => {
    assertBoard(req);
    const { companyId, skillId, v1, v2 } = req.params as { companyId: string; skillId: string; v1: string; v2: string };
    assertCompanyAccess(req, companyId);

    const existing = await getSkillOrNotFound(svc, skillId, companyId, res);
    if (!existing) return;
    const diff = await versionsSvc.diffVersions(skillId, parseInt(v1, 10), parseInt(v2, 10));
    res.json({ diff });
  });

  router.post("/companies/:companyId/skills/:skillId/audit", async (req, res) => {
    assertBoard(req);
    const { companyId, skillId } = req.params as { companyId: string; skillId: string };
    assertCompanyAccess(req, companyId);

    const existing = await getSkillOrNotFound(svc, skillId, companyId, res);
    if (!existing) return;
    try {
      const result = await auditSvc.auditSkill(skillId);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Bad request" });
    }
  });

  router.post("/companies/:companyId/skills/generate", async (req, res) => {
    assertBoard(req);
    const { companyId } = req.params as { companyId: string };
    assertCompanyAccess(req, companyId);

    const { description, category } = req.body as { description?: string; category?: string };
    if (!description) {
      res.status(400).json({ error: "description is required" });
      return;
    }
    try {
      const generated = await creatorSvc.generateSkill({ description, category, companyId });
      res.json(generated);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Bad request" });
    }
  });

  return router;
}

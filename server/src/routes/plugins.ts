import { type Response, Router } from "express";
import type { Db } from "@paperclipai/db";
import { assertBoard, assertCompanyAccess } from "./authz.js";
import { pluginsService, type Plugin } from "../services/plugins.js";

async function getPluginOrNotFound(
  svc: ReturnType<typeof pluginsService>,
  pluginId: string,
  companyId: string,
  res: Response,
): Promise<Plugin | null> {
  const plugin = await svc.get(pluginId);
  if (!plugin || plugin.companyId !== companyId) {
    res.status(404).json({ error: "Not found" });
    return null;
  }
  return plugin;
}

export function pluginRoutes(db: Db) {
  const router = Router();
  const svc = pluginsService(db);

  router.get("/companies/:companyId/plugins", async (req, res) => {
    assertBoard(req);
    const { companyId } = req.params as { companyId: string };
    assertCompanyAccess(req, companyId);

    const plugins = await svc.list(companyId);
    const redacted = plugins.map((p) => ({
      ...p,
      env: p.env ? Object.fromEntries(Object.keys(p.env).map((k) => [k, "***"])) : p.env,
    }));
    res.json({ plugins: redacted });
  });

  router.post("/companies/:companyId/plugins", async (req, res) => {
    assertBoard(req);
    const { companyId } = req.params as { companyId: string };
    assertCompanyAccess(req, companyId);

    try {
      const plugin = await svc.create({ companyId, ...req.body });
      res.status(201).json({ plugin });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Bad request" });
    }
  });

  router.get("/companies/:companyId/plugins/:pluginId", async (req, res) => {
    assertBoard(req);
    const { companyId, pluginId } = req.params as { companyId: string; pluginId: string };
    assertCompanyAccess(req, companyId);

    const plugin = await getPluginOrNotFound(svc, pluginId, companyId, res);
    if (!plugin) return;
    res.json({ plugin });
  });

  router.patch("/companies/:companyId/plugins/:pluginId", async (req, res) => {
    assertBoard(req);
    const { companyId, pluginId } = req.params as { companyId: string; pluginId: string };
    assertCompanyAccess(req, companyId);

    const existing = await getPluginOrNotFound(svc, pluginId, companyId, res);
    if (!existing) return;
    try {
      const plugin = await svc.update(pluginId, req.body);
      res.json({ plugin });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Bad request" });
    }
  });

  router.delete("/companies/:companyId/plugins/:pluginId", async (req, res) => {
    assertBoard(req);
    const { companyId, pluginId } = req.params as { companyId: string; pluginId: string };
    assertCompanyAccess(req, companyId);

    const existing = await getPluginOrNotFound(svc, pluginId, companyId, res);
    if (!existing) return;
    await svc.remove(pluginId);
    res.json({ ok: true });
  });

  router.post("/companies/:companyId/plugins/:pluginId/test", async (req, res) => {
    assertBoard(req);
    const { companyId, pluginId } = req.params as { companyId: string; pluginId: string };
    assertCompanyAccess(req, companyId);

    const existing = await getPluginOrNotFound(svc, pluginId, companyId, res);
    if (!existing) return;
    res.json({ status: "healthy", toolCount: 0, message: "Test endpoint — implementation pending" });
  });

  router.get("/companies/:companyId/plugins/:pluginId/access", async (req, res) => {
    assertBoard(req);
    const { companyId, pluginId } = req.params as { companyId: string; pluginId: string };
    assertCompanyAccess(req, companyId);

    const existing = await getPluginOrNotFound(svc, pluginId, companyId, res);
    if (!existing) return;
    const access = await svc.listAccess(pluginId);
    res.json({ access });
  });

  router.put("/companies/:companyId/plugins/:pluginId/access", async (req, res) => {
    assertBoard(req);
    const { companyId, pluginId } = req.params as { companyId: string; pluginId: string };
    assertCompanyAccess(req, companyId);

    const existing = await getPluginOrNotFound(svc, pluginId, companyId, res);
    if (!existing) return;
    await svc.bulkUpdateAccess(pluginId, req.body.grants);
    res.json({ ok: true });
  });

  return router;
}

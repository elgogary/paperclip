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

function redactEnv(p: Plugin): Plugin {
  return {
    ...p,
    env: p.env ? Object.fromEntries(Object.keys(p.env).map((k) => [k, "***"])) : p.env,
  };
}

export function pluginRoutes(db: Db) {
  const router = Router();
  const svc = pluginsService(db);

  router.get("/companies/:companyId/plugins", async (req, res) => {
    assertBoard(req);
    const { companyId } = req.params as { companyId: string };
    assertCompanyAccess(req, companyId);

    const plugins = await svc.list(companyId);
    res.json({ plugins: plugins.map(redactEnv) });
  });

  router.post("/companies/:companyId/plugins", async (req, res) => {
    assertBoard(req);
    const { companyId } = req.params as { companyId: string };
    assertCompanyAccess(req, companyId);

    try {
      const { name, description, icon, transport, command, args, env, url, enabled } = req.body;
      if (!name || typeof name !== "string" || !name.trim()) {
        res.status(400).json({ error: "name is required" });
        return;
      }
      const plugin = await svc.create({ companyId, name, description, icon, transport, command, args, env, url, enabled });
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
    res.json({ plugin: redactEnv(plugin) });
  });

  router.patch("/companies/:companyId/plugins/:pluginId", async (req, res) => {
    assertBoard(req);
    const { companyId, pluginId } = req.params as { companyId: string; pluginId: string };
    assertCompanyAccess(req, companyId);

    const existing = await getPluginOrNotFound(svc, pluginId, companyId, res);
    if (!existing) return;
    try {
      const { name, description, icon, transport, command, args, env, url, enabled } = req.body;
      // Filter out redacted env values (***) — only update keys with real values
      const safeEnv = env && typeof env === "object"
        ? Object.fromEntries(Object.entries(env as Record<string, string>).filter(([, v]) => v !== "***"))
        : undefined;
      const mergedEnv = safeEnv ? { ...(existing.env ?? {}), ...safeEnv } : undefined;
      const plugin = await svc.update(pluginId, { name, description, icon, transport, command, args, env: mergedEnv, url, enabled });
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
    const { grants } = req.body as { grants?: unknown };
    if (!Array.isArray(grants)) {
      res.status(400).json({ error: "grants must be an array" });
      return;
    }
    const valid = grants.every(
      (g: unknown) =>
        typeof g === "object" && g !== null &&
        typeof (g as Record<string, unknown>).agentId === "string" &&
        typeof (g as Record<string, unknown>).granted === "boolean",
    );
    if (!valid) {
      res.status(400).json({ error: "Each grant must have { agentId: string, granted: boolean }" });
      return;
    }
    await svc.bulkUpdateAccess(pluginId, grants as { agentId: string; granted: boolean }[]);
    res.json({ ok: true });
  });

  return router;
}

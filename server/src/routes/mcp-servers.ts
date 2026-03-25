import { type Response, Router } from "express";
import type { Db } from "@paperclipai/db";
import { assertBoard, assertCompanyAccess } from "./authz.js";
import { mcpServersService, type McpServerConfig } from "../services/mcp-servers.js";

async function getServerOrNotFound(
  svc: ReturnType<typeof mcpServersService>,
  serverId: string,
  companyId: string,
  res: Response,
): Promise<McpServerConfig | null> {
  const server = await svc.get(serverId);
  if (!server || server.companyId !== companyId) {
    res.status(404).json({ error: "Not found" });
    return null;
  }
  return server;
}

function redactEnv(s: McpServerConfig): McpServerConfig {
  return {
    ...s,
    env: s.env ? Object.fromEntries(Object.keys(s.env).map((k) => [k, "***"])) : s.env,
  };
}

export function mcpServerRoutes(db: Db) {
  const router = Router();
  const svc = mcpServersService(db);

  router.get("/companies/:companyId/mcp-servers", async (req, res) => {
    assertBoard(req);
    const { companyId } = req.params as { companyId: string };
    assertCompanyAccess(req, companyId);

    const servers = await svc.list(companyId);
    res.json({ servers: servers.map(redactEnv) });
  });

  router.post("/companies/:companyId/mcp-servers", async (req, res) => {
    assertBoard(req);
    const { companyId } = req.params as { companyId: string };
    assertCompanyAccess(req, companyId);

    try {
      const { name, direction, transport, command, args, env, url, enabled, catalogId, configJson } = req.body;
      if (!name || typeof name !== "string" || !name.trim()) {
        res.status(400).json({ error: "name is required" });
        return;
      }
      const server = await svc.create({ companyId, name, direction, transport, command, args, env, url, enabled, catalogId, configJson });
      res.status(201).json({ server });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Bad request" });
    }
  });

  router.get("/companies/:companyId/mcp-servers/:serverId", async (req, res) => {
    assertBoard(req);
    const { companyId, serverId } = req.params as { companyId: string; serverId: string };
    assertCompanyAccess(req, companyId);

    const server = await getServerOrNotFound(svc, serverId, companyId, res);
    if (!server) return;
    res.json({ server: redactEnv(server) });
  });

  router.patch("/companies/:companyId/mcp-servers/:serverId", async (req, res) => {
    assertBoard(req);
    const { companyId, serverId } = req.params as { companyId: string; serverId: string };
    assertCompanyAccess(req, companyId);

    const existing = await getServerOrNotFound(svc, serverId, companyId, res);
    if (!existing) return;
    try {
      const { name, direction, transport, command, args, env, url, enabled, configJson } = req.body;
      // Filter out redacted env values (***) — only update keys with real values
      const safeEnv = env && typeof env === "object"
        ? Object.fromEntries(Object.entries(env as Record<string, string>).filter(([, v]) => v !== "***"))
        : undefined;
      // Merge: keep existing env values, override only non-redacted ones
      const mergedEnv = safeEnv ? { ...(existing.env ?? {}), ...safeEnv } : undefined;
      const server = await svc.update(serverId, { name, direction, transport, command, args, env: mergedEnv, url, enabled, configJson });
      res.json({ server });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Bad request" });
    }
  });

  router.delete("/companies/:companyId/mcp-servers/:serverId", async (req, res) => {
    assertBoard(req);
    const { companyId, serverId } = req.params as { companyId: string; serverId: string };
    assertCompanyAccess(req, companyId);

    const existing = await getServerOrNotFound(svc, serverId, companyId, res);
    if (!existing) return;
    await svc.remove(serverId);
    res.json({ ok: true });
  });

  router.post("/companies/:companyId/mcp-servers/:serverId/test", async (req, res) => {
    assertBoard(req);
    const { companyId, serverId } = req.params as { companyId: string; serverId: string };
    assertCompanyAccess(req, companyId);

    const existing = await getServerOrNotFound(svc, serverId, companyId, res);
    if (!existing) return;
    res.json({ status: "healthy", toolCount: 0, message: "Test endpoint — implementation pending" });
  });

  router.post("/companies/:companyId/mcp-servers/:serverId/toggle", async (req, res) => {
    assertBoard(req);
    const { companyId, serverId } = req.params as { companyId: string; serverId: string };
    assertCompanyAccess(req, companyId);

    const existing = await getServerOrNotFound(svc, serverId, companyId, res);
    if (!existing) return;
    const { enabled } = req.body as { enabled: boolean };
    await svc.toggleEnabled(serverId, enabled);
    res.json({ ok: true });
  });

  router.get("/companies/:companyId/mcp-servers/:serverId/access", async (req, res) => {
    assertBoard(req);
    const { companyId, serverId } = req.params as { companyId: string; serverId: string };
    assertCompanyAccess(req, companyId);

    const existing = await getServerOrNotFound(svc, serverId, companyId, res);
    if (!existing) return;
    const access = await svc.listAccess(serverId);
    res.json({ access });
  });

  router.put("/companies/:companyId/mcp-servers/:serverId/access", async (req, res) => {
    assertBoard(req);
    const { companyId, serverId } = req.params as { companyId: string; serverId: string };
    assertCompanyAccess(req, companyId);

    const existing = await getServerOrNotFound(svc, serverId, companyId, res);
    if (!existing) return;
    const { grants } = req.body as { grants?: unknown };
    if (!Array.isArray(grants)) {
      res.status(400).json({ error: "grants must be an array" });
      return;
    }
    await svc.bulkUpdateAccess(serverId, grants);
    res.json({ ok: true });
  });

  router.get("/companies/:companyId/mcp-catalog", async (req, res) => {
    assertBoard(req);
    const { companyId } = req.params as { companyId: string };
    assertCompanyAccess(req, companyId);

    const catalog = await svc.listCatalog();
    res.json({ catalog });
  });

  router.post("/companies/:companyId/mcp-servers/install", async (req, res) => {
    assertBoard(req);
    const { companyId } = req.params as { companyId: string };
    assertCompanyAccess(req, companyId);

    try {
      const { catalogId, env } = req.body as { catalogId: string; env: Record<string, string> };
      const server = await svc.installFromCatalog(companyId, catalogId, env ?? {});
      res.status(201).json({ server });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Bad request" });
    }
  });

  return router;
}

import { type Response, Router } from "express";
import type { Db } from "@paperclipai/db";
import { assertBoard, assertCompanyAccess } from "./authz.js";
import { connectorsService, type Connector } from "../services/connectors.js";

async function getConnectorOrNotFound(
  svc: ReturnType<typeof connectorsService>,
  connectorId: string,
  companyId: string,
  res: Response,
): Promise<Connector | null> {
  const connector = await svc.get(connectorId);
  if (!connector || connector.companyId !== companyId) {
    res.status(404).json({ error: "Not found" });
    return null;
  }
  return connector;
}

function redactConnector(c: Connector) {
  const { oauthTokenEncrypted, oauthRefreshTokenEncrypted, ...safe } = c;
  return safe;
}

export function connectorRoutes(db: Db) {
  const router = Router();
  const svc = connectorsService(db);

  router.get("/companies/:companyId/connectors", async (req, res) => {
    assertBoard(req);
    const { companyId } = req.params as { companyId: string };
    assertCompanyAccess(req, companyId);

    const connectors = await svc.list(companyId);
    res.json({ connectors: connectors.map(redactConnector) });
  });

  router.post("/companies/:companyId/connectors", async (req, res) => {
    assertBoard(req);
    const { companyId } = req.params as { companyId: string };
    assertCompanyAccess(req, companyId);

    try {
      const { name, provider, status, scopes, metadata, connectedBy, connectedAt, enabled } = req.body;
      if (!name || typeof name !== "string" || !name.trim()) {
        res.status(400).json({ error: "name is required" });
        return;
      }
      if (!provider || typeof provider !== "string" || !provider.trim()) {
        res.status(400).json({ error: "provider is required" });
        return;
      }
      const connector = await svc.create({ companyId, name, provider, status, scopes, metadata, connectedBy, connectedAt, enabled });
      res.status(201).json({ connector: redactConnector(connector) });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Bad request" });
    }
  });

  router.post("/companies/:companyId/connectors/:connectorId/disconnect", async (req, res) => {
    assertBoard(req);
    const { companyId, connectorId } = req.params as { companyId: string; connectorId: string };
    assertCompanyAccess(req, companyId);

    const existing = await getConnectorOrNotFound(svc, connectorId, companyId, res);
    if (!existing) return;
    await svc.disconnect(connectorId);
    res.json({ ok: true });
  });

  router.delete("/companies/:companyId/connectors/:connectorId", async (req, res) => {
    assertBoard(req);
    const { companyId, connectorId } = req.params as { companyId: string; connectorId: string };
    assertCompanyAccess(req, companyId);

    const existing = await getConnectorOrNotFound(svc, connectorId, companyId, res);
    if (!existing) return;
    await svc.remove(connectorId);
    res.json({ ok: true });
  });

  return router;
}

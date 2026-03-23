import { Router } from "express";
import type { Db } from "@paperclipai/db";

const BRAIN_URL = process.env.SANAD_BRAIN_URL || "";
const BRAIN_API_KEY = process.env.SANAD_BRAIN_API_KEY || "";

const ALLOWED_PREFIXES = ["memory/", "admin/", "mcp/", "health", "metrics"];

export function sanadBrainRoutes(_db: Db) {
  const router = Router();

  if (!BRAIN_URL) {
    router.all("/brain/*path", (_req, res) => {
      res.status(503).json({ error: "SANAD_BRAIN_URL not configured" });
    });
    return router;
  }

  router.all("/brain/*path", async (req, res) => {
    const rawPath = Array.isArray(req.params.path) ? req.params.path.join("/") : String(req.params.path);
    const path = rawPath.replace(/^\/+/, "").replace(/\.\./g, "");
    if (!ALLOWED_PREFIXES.some((prefix) => path.startsWith(prefix))) {
      res.status(403).json({ error: "Path not allowed" });
      return;
    }
    const qs = new URLSearchParams(req.query as Record<string, string>).toString();
    const url = `${BRAIN_URL}/${path}${qs ? `?${qs}` : ""}`;
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (BRAIN_API_KEY) {
        headers["X-Api-Key"] = BRAIN_API_KEY;
      }
      const fetchInit: RequestInit = {
        method: req.method,
        headers,
      };
      if (!["GET", "HEAD"].includes(req.method)) {
        fetchInit.body = JSON.stringify(req.body);
      }
      const resp = await fetch(url, fetchInit);
      const data = await resp.json();
      res.status(resp.status).json(data);
    } catch {
      res.status(502).json({ error: "Sanad Brain unreachable" });
    }
  });

  return router;
}

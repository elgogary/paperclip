import { Router } from "express";
import type { Db } from "@paperclipai/db";

const BRAIN_URL = process.env.SANAD_BRAIN_URL || "http://100.109.59.30:8100";
const BRAIN_API_KEY = process.env.SANAD_BRAIN_API_KEY || "";

export function sanadBrainRoutes(_db: Db) {
  const router = Router();

  router.all("/brain/*path", async (req, res) => {
    const path = req.params.path;
    const url = `${BRAIN_URL}/${path}`;
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
    } catch (e) {
      res.status(502).json({ error: "Sanad Brain unreachable", detail: String(e) });
    }
  });

  return router;
}

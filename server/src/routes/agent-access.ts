import { Router } from "express";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { eq, desc } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { agentNotes } from "@paperclipai/db";
import { agentAccessService, agentService } from "../services/index.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";

export function agentAccessRoutes(db: Db) {
  const router = Router();
  const svc = agentAccessService(db);
  const agents = agentService(db);

  // --- Agent Access ACL ---

  router.get("/companies/:companyId/agent-access", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const result = await svc.listByCompany(companyId);
    res.json(result);
  });

  router.get("/agents/:agentId/access", async (req, res) => {
    const agentId = req.params.agentId as string;
    const agent = await agents.getById(agentId);
    if (!agent) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }
    assertCompanyAccess(req, agent.companyId);
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

  router.delete("/companies/:companyId/agent-access/:grantId", async (req, res) => {
    const companyId = req.params.companyId as string;
    const grantId = req.params.grantId as string;
    assertCompanyAccess(req, companyId);
    const deleted = await svc.revoke(grantId);
    if (!deleted) {
      res.status(404).json({ error: "Grant not found" });
      return;
    }
    res.json(deleted);
  });

  // --- Agent Instructions (read SOUL.md) ---

  router.get("/agents/:agentId/instructions", async (req, res) => {
    const agentId = req.params.agentId as string;
    const agent = await agents.getById(agentId);
    if (!agent) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }
    assertCompanyAccess(req, agent.companyId);

    const config = (agent as unknown as Record<string, unknown>).adapterConfig as Record<string, unknown> | null;
    const instructionsPath = config?.instructionsFilePath as string | undefined;
    const cwd = config?.cwd as string | undefined;

    if (!instructionsPath) {
      res.json({ path: null, content: null });
      return;
    }

    const fullPath = instructionsPath.startsWith("/")
      ? instructionsPath
      : resolve(cwd ?? "/workspace", instructionsPath);

    try {
      const content = await readFile(fullPath, "utf-8");
      res.json({ path: instructionsPath, content });
    } catch {
      res.json({ path: instructionsPath, content: null, error: "File not found or unreadable" });
    }
  });

  // --- Agent Notes (board comments for improvement cycles) ---

  router.get("/agents/:agentId/notes", async (req, res) => {
    const agentId = req.params.agentId as string;
    const agent = await agents.getById(agentId);
    if (!agent) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }
    assertCompanyAccess(req, agent.companyId);

    const notes = await db
      .select()
      .from(agentNotes)
      .where(eq(agentNotes.agentId, agentId))
      .orderBy(desc(agentNotes.createdAt));

    res.json(notes);
  });

  router.post("/agents/:agentId/notes", async (req, res) => {
    const agentId = req.params.agentId as string;
    const agent = await agents.getById(agentId);
    if (!agent) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }
    assertCompanyAccess(req, agent.companyId);

    const { body } = req.body as { body: string };
    if (!body?.trim()) {
      res.status(422).json({ error: "body is required" });
      return;
    }

    const actor = getActorInfo(req);
    const [note] = await db
      .insert(agentNotes)
      .values({
        companyId: agent.companyId,
        agentId,
        authorUserId: actor.actorId,
        body: body.trim(),
      })
      .returning();

    res.status(201).json(note);
  });

  router.delete("/agents/:agentId/notes/:noteId", async (req, res) => {
    const agentId = req.params.agentId as string;
    const noteId = req.params.noteId as string;
    const agent = await agents.getById(agentId);
    if (!agent) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }
    assertCompanyAccess(req, agent.companyId);

    const [deleted] = await db
      .delete(agentNotes)
      .where(eq(agentNotes.id, noteId))
      .returning();

    if (!deleted) {
      res.status(404).json({ error: "Note not found" });
      return;
    }
    res.json(deleted);
  });

  return router;
}

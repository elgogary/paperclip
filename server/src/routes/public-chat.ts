import { Router } from "express";
import type { Request, Response, NextFunction, RequestHandler } from "express";
import type { Db } from "@paperclipai/db";
import { issueComments, agents } from "@paperclipai/db";
import { eq, asc } from "drizzle-orm";
import {
  createChatSession,
  validateChatToken,
  incrementMessageCount,
  closeChatSession,
  type CreateChatSessionInput,
} from "../services/chat-sessions.js";

type ChatSession = NonNullable<Awaited<ReturnType<typeof validateChatToken>>>;

function makeTokenMiddleware(db: Db): RequestHandler {
  return (async (req: Request, res: Response, next: NextFunction) => {
    const paramToken = String(req.params.token ?? "");
    const headerRaw = req.headers["x-chat-token"];
    const hdrToken = typeof headerRaw === "string" ? headerRaw : "";
    const token = paramToken || hdrToken;
    if (!token) { res.status(401).json({ error: "Missing token" }); return; }

    const session = await validateChatToken(db, token);
    if (!session) { res.status(403).json({ error: "Invalid or expired session" }); return; }

    (req as any)._chatSession = session;
    next();
  }) as RequestHandler;
}

function getSession(req: Request): ChatSession {
  return (req as any)._chatSession;
}

export function publicChatRoutes(db: Db) {
  const router = Router();
  const auth = makeTokenMiddleware(db);

  // Create session (internal — called by watcher)
  router.post("/chat/sessions", (async (req: Request, res: Response) => {
    const { companyId, agentId, issueId, customerEmail, customerName, ttlMinutes, maxMessages } = req.body as Record<string, unknown>;
    if (!companyId || !agentId || !issueId || !customerEmail) {
      res.status(400).json({ error: "companyId, agentId, issueId, customerEmail required" });
      return;
    }
    const result = await createChatSession(db, {
      companyId: companyId as string,
      agentId: agentId as string,
      issueId: issueId as string,
      customerEmail: customerEmail as string,
      customerName: customerName as string | undefined,
      ttlMinutes: ttlMinutes as number | undefined,
      maxMessages: maxMessages as number | undefined,
    });
    res.status(201).json(result);
  }) as RequestHandler);

  // Get session info + agent details
  router.get("/chat/:token", auth, (async (req: Request, res: Response) => {
    const session = getSession(req);
    const [agent] = await db.select().from(agents).where(eq(agents.id, session.agentId)).limit(1);

    res.json({
      sessionId: session.id,
      issueId: session.issueId,
      companyId: session.companyId,
      agentName: agent?.name ?? "Agent",
      agentTitle: agent?.title ?? "",
      agentIcon: agent?.icon ?? "zap",
      agentRole: agent?.role ?? "general",
      agentMetadata: agent?.metadata ?? {},
      customerName: session.customerName,
      customerEmail: session.customerEmail,
      expiresAt: session.expiresAt,
      messageCount: session.messageCount,
      maxMessages: session.maxMessages,
    });
  }) as RequestHandler);

  // List messages
  router.get("/chat/:token/messages", auth, (async (req: Request, res: Response) => {
    const session = getSession(req);
    const comments = await db
      .select()
      .from(issueComments)
      .where(eq(issueComments.issueId, session.issueId))
      .orderBy(asc(issueComments.createdAt));

    const messages = comments.map((c) => ({
      id: c.id,
      role: c.authorAgentId ? "agent" : "customer",
      body: c.body,
      authorAgentId: c.authorAgentId,
      createdAt: c.createdAt,
    }));

    res.json({ messages });
  }) as RequestHandler);

  // Send message (customer)
  router.post("/chat/:token/messages", auth, (async (req: Request, res: Response) => {
    const session = getSession(req);
    const { body } = req.body as { body?: string };

    if (!body || typeof body !== "string" || !body.trim()) {
      res.status(400).json({ error: "Message body required" });
      return;
    }
    if (body.length > 2000) {
      res.status(400).json({ error: "Message too long (max 2000 chars)" });
      return;
    }
    if (session.messageCount >= session.maxMessages) {
      res.status(429).json({ error: "Message limit reached for this session" });
      return;
    }

    const [comment] = await db
      .insert(issueComments)
      .values({
        issueId: session.issueId,
        companyId: session.companyId,
        body: body.trim(),
        authorUserId: null,
        authorAgentId: null,
        metadata: {
          source: "ephemeral_chat",
          sessionId: session.id,
          customerEmail: session.customerEmail,
        },
      } as any)
      .returning();

    await incrementMessageCount(db, session.id);

    res.status(201).json({
      id: comment.id,
      role: "customer",
      body: comment.body,
      createdAt: comment.createdAt,
    });
  }) as RequestHandler);

  // Close session
  router.post("/chat/:token/close", auth, (async (req: Request, res: Response) => {
    await closeChatSession(db, getSession(req).id);
    res.json({ ok: true });
  }) as RequestHandler);

  return router;
}

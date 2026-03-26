import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
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

interface ChatRequest extends Request {
  chatSession?: Awaited<ReturnType<typeof validateChatToken>>;
}

async function requireToken(db: Db) {
  return async (req: ChatRequest, res: Response, next: NextFunction) => {
    const token = req.params.token || (req.headers["x-chat-token"] as string);
    if (!token) { res.status(401).json({ error: "Missing token" }); return; }

    const session = await validateChatToken(db, token);
    if (!session) { res.status(403).json({ error: "Invalid or expired session" }); return; }

    req.chatSession = session;
    next();
  };
}

export function publicChatRoutes(db: Db) {
  const router = Router();
  const auth = requireToken(db);

  // Create session (called by watcher or internal service — not public)
  router.post("/chat/sessions", async (req: Request, res: Response) => {
    const { companyId, agentId, issueId, customerEmail, customerName, ttlMinutes, maxMessages } = req.body;
    if (!companyId || !agentId || !issueId || !customerEmail) {
      res.status(400).json({ error: "companyId, agentId, issueId, customerEmail required" });
      return;
    }
    const result = await createChatSession(db, {
      companyId, agentId, issueId, customerEmail,
      customerName, ttlMinutes, maxMessages,
    } as CreateChatSessionInput);
    res.status(201).json(result);
  });

  // Get session info + agent details
  router.get("/chat/:token", auth, async (req: ChatRequest, res: Response) => {
    const session = req.chatSession!;
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
  });

  // List messages
  router.get("/chat/:token/messages", auth, async (req: ChatRequest, res: Response) => {
    const session = req.chatSession!;
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
  });

  // Send message (customer)
  router.post("/chat/:token/messages", auth, async (req: ChatRequest, res: Response) => {
    const session = req.chatSession!;
    const { body } = req.body;

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
      })
      .returning();

    await incrementMessageCount(db, session.id);

    res.status(201).json({
      id: comment.id,
      role: "customer",
      body: comment.body,
      createdAt: comment.createdAt,
    });
  });

  // Close session
  router.post("/chat/:token/close", auth, async (req: ChatRequest, res: Response) => {
    await closeChatSession(db, req.chatSession!.id);
    res.json({ ok: true });
  });

  return router;
}

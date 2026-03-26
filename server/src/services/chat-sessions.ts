import { createHmac, randomBytes } from "node:crypto";
import { eq, and, gt, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { chatSessions } from "@paperclipai/db";

const SECRET = process.env.CHAT_SESSION_SECRET || process.env.LITELLM_MASTER_KEY || "change-me-in-production";

function signToken(sessionId: string): string {
  const payload = Buffer.from(JSON.stringify({ sid: sessionId, ts: Date.now() })).toString("base64url");
  const sig = createHmac("sha256", SECRET).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

function verifySignature(token: string): string | null {
  const dotIdx = token.indexOf(".");
  if (dotIdx < 1) return null;
  const payload = token.slice(0, dotIdx);
  const sig = token.slice(dotIdx + 1);
  const expected = createHmac("sha256", SECRET).update(payload).digest("base64url");
  if (sig !== expected) return null;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString()).sid ?? null;
  } catch {
    return null;
  }
}

export interface CreateChatSessionInput {
  companyId: string;
  agentId: string;
  issueId: string;
  customerEmail: string;
  customerName?: string;
  ttlMinutes?: number;
  maxMessages?: number;
  metadata?: Record<string, unknown>;
}

export async function createChatSession(db: Db, input: CreateChatSessionInput) {
  const ttl = input.ttlMinutes ?? 60;
  const expiresAt = new Date(Date.now() + ttl * 60 * 1000);

  const [row] = await db.insert(chatSessions).values({
    companyId: input.companyId,
    agentId: input.agentId,
    issueId: input.issueId,
    customerEmail: input.customerEmail,
    customerName: input.customerName ?? null,
    expiresAt,
    maxMessages: input.maxMessages ?? 30,
    metadata: input.metadata ?? null,
    token: randomBytes(16).toString("hex"), // temp placeholder
  }).returning();

  const token = signToken(row.id);
  await db.update(chatSessions).set({ token }).where(eq(chatSessions.id, row.id));

  return { sessionId: row.id, token, expiresAt };
}

export async function validateChatToken(db: Db, token: string) {
  const sessionId = verifySignature(token);
  if (!sessionId) return null;

  const [session] = await db
    .select()
    .from(chatSessions)
    .where(and(
      eq(chatSessions.id, sessionId),
      eq(chatSessions.token, token),
      gt(chatSessions.expiresAt, new Date()),
    ))
    .limit(1);

  if (!session || session.closedAt) return null;
  return session;
}

export async function incrementMessageCount(db: Db, sessionId: string) {
  await db
    .update(chatSessions)
    .set({ messageCount: sql`${chatSessions.messageCount} + 1` })
    .where(eq(chatSessions.id, sessionId));
}

export async function closeChatSession(db: Db, sessionId: string) {
  await db
    .update(chatSessions)
    .set({ closedAt: new Date() })
    .where(eq(chatSessions.id, sessionId));
}

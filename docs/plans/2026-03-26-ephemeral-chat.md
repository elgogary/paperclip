# Ephemeral Agent Chat — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let email recipients click a time-limited link to chat with their assigned agent in real-time, reusing the existing issue-comment chat system.

**Architecture:** Email watcher creates a Paperclip issue (already done). We add a `chat_sessions` DB table for signed tokens, a public Express route that serves a slim chat page, and a token-auth middleware so the customer can read/write issue comments without logging in. The existing WebSocket live-events system delivers real-time updates. No new chat engine — messages ARE issue comments.

**Tech Stack:** TypeScript (server), React (UI), Drizzle (DB), WebSocket (existing), HMAC-SHA256 (token signing)

**Repo:** `/home/eslam/data/projects/paperclip` branch `main-sanad-eoi-app`

---

## Task 1: Add `chat_sessions` DB Table

**Files:**
- Create: `packages/db/src/schema/chat-sessions.ts`
- Modify: `packages/db/src/schema/index.ts` (add export)
- Create: `packages/db/src/migrations/0046_chat_sessions.sql`
- Modify: `packages/db/src/migrations/meta/_journal.json` (add entry)

**Step 1: Create schema file**

```typescript
// packages/db/src/schema/chat-sessions.ts
import { pgTable, uuid, text, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { agents } from "./agents.js";
import { companies } from "./companies.js";

export const chatSessions = pgTable("chat_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id),
  agentId: uuid("agent_id").notNull().references(() => agents.id),
  issueId: uuid("issue_id").notNull(),
  token: text("token").notNull().unique(),
  customerEmail: text("customer_email").notNull(),
  customerName: text("customer_name"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  messageCount: integer("message_count").notNull().default(0),
  maxMessages: integer("max_messages").notNull().default(30),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  closedAt: timestamp("closed_at", { withTimezone: true }),
});
```

**Step 2: Add export to schema/index.ts**

Add line: `export { chatSessions } from "./chat-sessions.js";`

**Step 3: Create migration SQL**

```sql
-- packages/db/src/migrations/0046_chat_sessions.sql
CREATE TABLE IF NOT EXISTS "chat_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id"),
  "agent_id" uuid NOT NULL REFERENCES "agents"("id"),
  "issue_id" uuid NOT NULL,
  "token" text NOT NULL UNIQUE,
  "customer_email" text NOT NULL,
  "customer_name" text,
  "expires_at" timestamp with time zone NOT NULL,
  "message_count" integer NOT NULL DEFAULT 0,
  "max_messages" integer NOT NULL DEFAULT 30,
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "closed_at" timestamp with time zone
);

CREATE INDEX IF NOT EXISTS "chat_sessions_token_idx" ON "chat_sessions" ("token");
CREATE INDEX IF NOT EXISTS "chat_sessions_expires_idx" ON "chat_sessions" ("expires_at");
```

**Step 4: Update migration journal**

Add to `_journal.json` entries array:
```json
{ "idx": 46, "version": "7", "when": 1774800000000, "tag": "0046_chat_sessions", "breakpoints": true }
```

**Step 5: Generate snapshot**

```bash
cd packages/db && cp src/migrations/meta/0045_snapshot.json src/migrations/meta/0046_snapshot.json
```
Then update 0046_snapshot.json to include the chat_sessions table (or let drizzle-kit generate it).

**Step 6: Commit**

```bash
git add packages/db/src/schema/chat-sessions.ts packages/db/src/schema/index.ts \
  packages/db/src/migrations/0046_chat_sessions.sql packages/db/src/migrations/meta/
git commit -m "feat(db): add chat_sessions table for ephemeral agent chat"
```

---

## Task 2: Token Service (create + validate)

**Files:**
- Create: `server/src/services/chat-sessions.ts`

**Step 1: Write the service**

```typescript
// server/src/services/chat-sessions.ts
import { createHmac, randomBytes } from "node:crypto";
import { eq, and, gt } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { chatSessions } from "@paperclipai/db";

const SECRET = process.env.CHAT_SESSION_SECRET || process.env.LITELLM_MASTER_KEY || "change-me";
const DEFAULT_TTL_MINUTES = 60;
const DEFAULT_MAX_MESSAGES = 30;

function signToken(sessionId: string): string {
  const payload = Buffer.from(JSON.stringify({ sid: sessionId, ts: Date.now() })).toString("base64url");
  const sig = createHmac("sha256", SECRET).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

function verifyTokenSignature(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expected = createHmac("sha256", SECRET).update(payload).digest("base64url");
  if (sig !== expected) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    return data.sid ?? null;
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
  const ttl = input.ttlMinutes ?? DEFAULT_TTL_MINUTES;
  const expiresAt = new Date(Date.now() + ttl * 60 * 1000);
  const tempId = randomBytes(16).toString("hex");

  const [row] = await db.insert(chatSessions).values({
    companyId: input.companyId,
    agentId: input.agentId,
    issueId: input.issueId,
    customerEmail: input.customerEmail,
    customerName: input.customerName ?? null,
    expiresAt,
    maxMessages: input.maxMessages ?? DEFAULT_MAX_MESSAGES,
    metadata: input.metadata ?? null,
    token: tempId, // placeholder
  }).returning();

  const token = signToken(row.id);
  await db.update(chatSessions).set({ token }).where(eq(chatSessions.id, row.id));

  return { sessionId: row.id, token, expiresAt };
}

export async function validateChatToken(db: Db, token: string) {
  const sessionId = verifyTokenSignature(token);
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

  if (!session) return null;
  if (session.closedAt) return null;
  return session;
}

export async function incrementMessageCount(db: Db, sessionId: string) {
  await db
    .update(chatSessions)
    .set({ messageCount: chatSessions.messageCount + 1 } as any)
    .where(eq(chatSessions.id, sessionId));
}

export async function closeChatSession(db: Db, sessionId: string) {
  await db
    .update(chatSessions)
    .set({ closedAt: new Date() })
    .where(eq(chatSessions.id, sessionId));
}
```

**Step 2: Commit**

```bash
git add server/src/services/chat-sessions.ts
git commit -m "feat(chat): token service — create, validate, sign with HMAC-SHA256"
```

---

## Task 3: Public Chat API Routes

**Files:**
- Create: `server/src/routes/public-chat.ts`
- Modify: `server/src/app.ts` (mount route)

**Step 1: Write the route**

```typescript
// server/src/routes/public-chat.ts
import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { issues, issueComments, agents } from "@paperclipai/db";
import { eq, asc } from "drizzle-orm";
import {
  validateChatToken,
  incrementMessageCount,
  closeChatSession,
} from "../services/chat-sessions.js";

export function publicChatRoutes(db: Db) {
  const router = Router();

  // Middleware: validate token on all routes
  async function requireToken(req: any, res: any, next: any) {
    const token = req.params.token || req.headers["x-chat-token"];
    if (!token) return res.status(401).json({ error: "Missing token" });

    const session = await validateChatToken(db, token);
    if (!session) return res.status(403).json({ error: "Invalid or expired session" });

    req.chatSession = session;
    next();
  }

  // GET /api/chat/:token — session info + agent details
  router.get("/chat/:token", requireToken, async (req: any, res) => {
    const session = req.chatSession;
    const [agent] = await db.select().from(agents).where(eq(agents.id, session.agentId)).limit(1);

    res.json({
      sessionId: session.id,
      agentName: agent?.name ?? "Agent",
      agentTitle: agent?.title ?? "",
      agentIcon: agent?.icon ?? "zap",
      agentMetadata: agent?.metadata ?? {},
      customerName: session.customerName,
      customerEmail: session.customerEmail,
      expiresAt: session.expiresAt,
      messageCount: session.messageCount,
      maxMessages: session.maxMessages,
    });
  });

  // GET /api/chat/:token/messages — list messages
  router.get("/chat/:token/messages", requireToken, async (req: any, res) => {
    const session = req.chatSession;
    const comments = await db
      .select()
      .from(issueComments)
      .where(eq(issueComments.issueId, session.issueId))
      .orderBy(asc(issueComments.createdAt));

    const messages = comments.map((c) => ({
      id: c.id,
      role: c.authorAgentId ? "agent" : "customer",
      body: c.body,
      createdAt: c.createdAt,
    }));

    res.json({ messages });
  });

  // POST /api/chat/:token/messages — customer sends message
  router.post("/chat/:token/messages", requireToken, async (req: any, res) => {
    const session = req.chatSession;
    const { body } = req.body;

    if (!body || typeof body !== "string" || body.trim().length === 0) {
      return res.status(400).json({ error: "Message body required" });
    }

    if (body.length > 2000) {
      return res.status(400).json({ error: "Message too long (max 2000 chars)" });
    }

    if (session.messageCount >= session.maxMessages) {
      return res.status(429).json({ error: "Message limit reached for this session" });
    }

    // Insert as issue comment (authorUserId = null, authorAgentId = null → customer)
    const [comment] = await db
      .insert(issueComments)
      .values({
        issueId: session.issueId,
        companyId: session.companyId,
        body: body.trim(),
        authorUserId: null,
        authorAgentId: null,
        metadata: { source: "ephemeral_chat", sessionId: session.id, customerEmail: session.customerEmail },
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

  // POST /api/chat/:token/close — customer ends session
  router.post("/chat/:token/close", requireToken, async (req: any, res) => {
    await closeChatSession(db, req.chatSession.id);
    res.json({ ok: true });
  });

  return router;
}
```

**Step 2: Mount in app.ts**

In `server/src/app.ts`, after the existing route mounts, add:
```typescript
import { publicChatRoutes } from "./routes/public-chat.js";
// ... after api.use(evolutionRoutes(db));
api.use(publicChatRoutes(db));
```

**Step 3: Commit**

```bash
git add server/src/routes/public-chat.ts server/src/app.ts
git commit -m "feat(chat): public chat API — session info, messages, send, close"
```

---

## Task 4: Public Chat UI Page

**Files:**
- Create: `ui/src/pages/PublicChat.tsx`
- Modify: `ui/src/App.tsx` (add route outside auth wrapper)

**Step 1: Write PublicChat page**

This is a standalone page (no sidebar, no auth) that reuses MarkdownBody for rendering. Uses the `/api/chat/:token/*` endpoints. Polls for new messages every 3s (WebSocket auth for public users is a future enhancement).

Key features:
- Countdown timer (from session.expiresAt)
- Agent profile card (name, title, icon, identity from metadata)
- Chat bubbles (agent = left, customer = right)
- Input with send button
- Expired state overlay
- Language toggle (Arabic/English)
- Message counter (X/30 remaining)

The page is ~300 lines of React, reusing existing components:
- `MarkdownBody` for message rendering
- `SanadLogo` for branding
- Agent icons from `chat-constants.ts`

**Step 2: Add route in App.tsx**

Add OUTSIDE the auth-wrapped routes (public, no login needed):
```tsx
<Route path="/chat/:token" element={<PublicChat />} />
```

**Step 3: Commit**

```bash
git add ui/src/pages/PublicChat.tsx ui/src/App.tsx
git commit -m "feat(chat): public chat UI — standalone page with timer, agent profile, messages"
```

---

## Task 5: Wire Email Watcher to Create Chat Sessions

**Files:**
- Modify: `tools/email-mcp/watcher.py` (add chat session creation after task creation)

**Step 1: Update watcher flow**

After creating the Paperclip issue and waking the agent, the watcher:
1. Calls `POST /api/chat/sessions` to create a chat session
2. Gets back the token
3. Sends a reply email with the chat link

Add to `create_email_task()` after successful task creation:

```python
# Create ephemeral chat session
chat_result = _paperclip_api("POST", "/chat/sessions", {
    "companyId": PAPERCLIP_COMPANY_ID,
    "agentId": agent_id,
    "issueId": issue_id,
    "customerEmail": em["from_addr"],
    "customerName": em["from_name"],
    "ttlMinutes": 60,
})
chat_token = chat_result.get("token")

if chat_token:
    # Send email with chat link
    chat_url = f"{PAPERCLIP_URL.replace(':3100', ':3100')}/chat/{chat_token}"
    _send_chat_invite_email(em, chat_url, agent_name_for_category(category))
```

**Step 2: Add server endpoint for session creation**

In `public-chat.ts`, add a route that the watcher calls (uses internal auth, not public token):
```typescript
router.post("/chat/sessions", async (req, res) => {
  // This endpoint is called by the watcher (internal, not public)
  const { companyId, agentId, issueId, customerEmail, customerName, ttlMinutes } = req.body;
  const result = await createChatSession(db, { companyId, agentId, issueId, customerEmail, customerName, ttlMinutes });
  res.status(201).json(result);
});
```

**Step 3: Commit**

```bash
git add tools/email-mcp/watcher.py server/src/routes/public-chat.ts
git commit -m "feat(chat): watcher creates chat session + sends invite email with link"
```

---

## Task 6: Token Auth for WebSocket (optional, for real-time)

**Files:**
- Modify: `server/src/realtime/live-events-ws.ts` (add chat token auth path)

**Step 1: Add token query param support**

In `authorizeUpgrade()`, add a fallback for chat tokens:
```typescript
// After existing auth checks, before returning null:
const chatToken = url.searchParams.get("chatToken");
if (chatToken) {
  const session = await validateChatToken(db, chatToken);
  if (session && session.companyId === companyId) {
    return { companyId, actorType: "board" as const, actorId: `chat:${session.id}` };
  }
}
```

This lets the public chat page connect to WebSocket for real-time updates using the chat token.

**Step 2: Commit**

```bash
git add server/src/realtime/live-events-ws.ts
git commit -m "feat(chat): WebSocket auth for ephemeral chat tokens"
```

---

## Definition of Done

| # | Criterion | Test |
|---|---|---|
| 1 | Chat session created with HMAC token | POST /chat/sessions → returns token |
| 2 | Token validates and returns session | GET /api/chat/:token → session info + agent |
| 3 | Customer can read messages | GET /api/chat/:token/messages → comment list |
| 4 | Customer can send messages | POST /api/chat/:token/messages → creates comment |
| 5 | Message limit enforced | 31st message → 429 |
| 6 | Expired token rejected | Wait 60min or set short TTL → 403 |
| 7 | Forged token rejected | Tamper with payload → 403 |
| 8 | UI renders chat with timer | Open /chat/:token → see agent, messages, countdown |
| 9 | UI shows expired overlay | Timer hits 0 → "Session expired" card |
| 10 | Email contains chat link | Watcher sends reply with clickable link |
| 11 | Agent sees customer messages | Customer sends → appears in Paperclip issue |
| 12 | WebSocket delivers real-time | Agent replies → customer sees instantly (if Task 6 done) |

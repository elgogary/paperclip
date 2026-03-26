import { pgTable, uuid, text, timestamp, integer, jsonb, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";

export const chatSessions = pgTable(
  "chat_sessions",
  {
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
  },
  (table) => ({
    tokenIdx: index("chat_sessions_token_idx").on(table.token),
    expiresIdx: index("chat_sessions_expires_idx").on(table.expiresAt),
  }),
);

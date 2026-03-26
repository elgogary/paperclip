import { pgTable, uuid, text, timestamp, jsonb, integer, boolean, index } from "drizzle-orm/pg-core";
import { agents } from "./agents.js";
import { companies } from "./companies.js";

export const agentMetrics = pgTable(
  "agent_metrics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    agentId: uuid("agent_id").notNull().references(() => agents.id),
    taskId: uuid("task_id"),
    toolsUsed: jsonb("tools_used").$type<string[]>().notNull().default([]),
    skillsApplied: jsonb("skills_applied").$type<string[]>().notNull().default([]),
    skillsFailed: jsonb("skills_failed").$type<string[]>().notNull().default([]),
    fallbacksUsed: jsonb("fallbacks_used").$type<string[]>().notNull().default([]),
    durationMinutes: integer("duration_minutes"),
    tokensUsed: integer("tokens_used"),
    errors: jsonb("errors").$type<string[]>().notNull().default([]),
    success: boolean("success").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    agentIdx: index("agent_metrics_agent_idx").on(table.agentId),
    companyIdx: index("agent_metrics_company_idx").on(table.companyId),
    agentCreatedIdx: index("agent_metrics_agent_created_idx").on(table.agentId, table.createdAt),
  }),
);

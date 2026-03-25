import { pgTable, uuid, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { skills } from "./skills.js";
import { agents } from "./agents.js";

export const evolutionEvents = pgTable(
  "evolution_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    skillId: uuid("skill_id").references(() => skills.id),
    eventType: text("event_type").notNull(), // fix | derived | captured | flagged | rejected
    sourceMonitor: text("source_monitor").notNull(), // post_run | tool_degradation | metric_sweep | brain_scan
    heartbeatRunId: uuid("heartbeat_run_id"),
    agentId: uuid("agent_id").references(() => agents.id),
    analysis: jsonb("analysis").$type<Record<string, unknown>>(),
    proposedContent: text("proposed_content"),
    status: text("status").notNull().default("pending"), // pending | approved | applied | rejected
    reviewedBy: text("reviewed_by"), // 'auto' | 'ceo_agent' | user_id
    appliedAt: timestamp("applied_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyCreatedIdx: index("evolution_events_company_created_idx").on(table.companyId, table.createdAt),
    skillIdx: index("evolution_events_skill_idx").on(table.skillId),
  }),
);

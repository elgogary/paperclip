import { pgTable, uuid, text, integer, real, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { skills } from "./skills.js";
import { agents } from "./agents.js";

export const skillAgentMetrics = pgTable(
  "skill_agent_metrics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    skillId: uuid("skill_id").notNull().references(() => skills.id, { onDelete: "cascade" }),
    skillVersion: integer("skill_version").notNull(),
    agentId: uuid("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
    appliedCount: integer("applied_count").notNull().default(0),
    successCount: integer("success_count").notNull().default(0),
    failureCount: integer("failure_count").notNull().default(0),
    fallbackCount: integer("fallback_count").notNull().default(0),
    totalTokens: integer("total_tokens").notNull().default(0),
    avgTokenDelta: real("avg_token_delta").notNull().default(0),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    skillVersionAgentUq: uniqueIndex("skill_agent_metrics_skill_version_agent_uq").on(
      table.skillId,
      table.skillVersion,
      table.agentId,
    ),
    skillIdx: index("skill_agent_metrics_skill_idx").on(table.skillId),
    agentIdx: index("skill_agent_metrics_agent_idx").on(table.agentId),
  }),
);

import { pgTable, uuid, boolean, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { skills } from "./skills.js";
import { agents } from "./agents.js";

export const skillAgentAccess = pgTable(
  "skill_agent_access",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    skillId: uuid("skill_id").notNull().references(() => skills.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
    granted: boolean("granted").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    skillAgentUq: uniqueIndex("skill_agent_access_skill_agent_uq").on(table.skillId, table.agentId),
  }),
);

import { pgTable, uuid, boolean, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { plugins } from "./plugins.js";
import { agents } from "./agents.js";

export const pluginAgentAccess = pgTable(
  "plugin_agent_access",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pluginId: uuid("plugin_id").notNull().references(() => plugins.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
    granted: boolean("granted").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pluginAgentUq: uniqueIndex("plugin_agent_access_plugin_agent_uq").on(table.pluginId, table.agentId),
  }),
);

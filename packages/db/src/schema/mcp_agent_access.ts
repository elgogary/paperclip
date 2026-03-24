import { pgTable, uuid, boolean, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { mcpServerConfigs } from "./mcp_server_configs.js";
import { agents } from "./agents.js";

export const mcpAgentAccess = pgTable(
  "mcp_agent_access",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    mcpServerId: uuid("mcp_server_id").notNull().references(() => mcpServerConfigs.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
    granted: boolean("granted").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    mcpServerAgentUq: uniqueIndex("mcp_agent_access_mcp_server_agent_uq").on(table.mcpServerId, table.agentId),
  }),
);

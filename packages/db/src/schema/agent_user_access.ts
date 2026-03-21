import { pgTable, uuid, text, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { agents } from "./agents.js";
import { companies } from "./companies.js";

export const agentUserAccess = pgTable(
  "agent_user_access",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    grantedBy: text("granted_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    agentUserUniqueIdx: uniqueIndex("agent_user_access_agent_user_unique_idx").on(
      table.agentId,
      table.userId,
    ),
    companyIdx: index("agent_user_access_company_idx").on(table.companyId),
    userIdx: index("agent_user_access_user_idx").on(table.userId),
  }),
);

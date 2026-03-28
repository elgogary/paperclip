import { pgTable, uuid, text, real, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";

export const swarmAuditLog = pgTable(
  "swarm_audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    action: text("action").notNull(), // install | remove | approve | deny | sync | evaluate | flag
    capabilityName: text("capability_name"),
    capabilityType: text("capability_type"),
    actorType: text("actor_type").notNull(), // agent | board | system
    actorId: uuid("actor_id").references(() => agents.id),
    actorBoardUserId: text("actor_board_user_id"),
    detail: text("detail"),
    costUsd: real("cost_usd"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyIdx: index("swarm_audit_company_idx").on(table.companyId),
    companyActionIdx: index("swarm_audit_company_action_idx").on(table.companyId, table.action),
    createdIdx: index("swarm_audit_created_idx").on(table.createdAt),
  }),
);

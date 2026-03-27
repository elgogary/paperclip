import { pgTable, uuid, text, real, integer, timestamp, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";
import { swarmCapabilities } from "./swarm_capabilities.js";

export const swarmInstalls = pgTable(
  "swarm_installs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    capabilityId: uuid("capability_id").references(() => swarmCapabilities.id),
    name: text("name").notNull(),
    capabilityType: text("capability_type").notNull(), // skill | mcp | connector | plugin
    version: text("version"),
    status: text("status").notNull().default("active"), // active | disabled | flagged | removed
    // Who
    installedBy: uuid("installed_by").references(() => agents.id),
    installedByBoard: text("installed_by_board"), // userId if board installed it
    approvedBy: text("approved_by"), // who approved (board userId or auto)
    // Economics
    pricingTier: text("pricing_tier").notNull().default("free"),
    priceMonthlyUsd: real("price_monthly_usd").notNull().default(0),
    totalCostUsd: real("total_cost_usd").notNull().default(0),
    totalValueUsd: real("total_value_usd").notNull().default(0),
    reuseCount: integer("reuse_count").notNull().default(0),
    avgQualityScore: real("avg_quality_score"),
    // Content
    contentHash: text("content_hash"),
    config: jsonb("config").$type<Record<string, unknown>>(),
    snapshot: jsonb("snapshot").$type<Record<string, unknown>>(), // rollback state
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    removedAt: timestamp("removed_at", { withTimezone: true }),
  },
  (table) => ({
    companyIdx: index("swarm_installs_company_idx").on(table.companyId),
    companyNameUq: uniqueIndex("swarm_installs_company_name_uq").on(table.companyId, table.name),
    typeIdx: index("swarm_installs_type_idx").on(table.companyId, table.capabilityType),
    statusIdx: index("swarm_installs_status_idx").on(table.companyId, table.status),
  }),
);

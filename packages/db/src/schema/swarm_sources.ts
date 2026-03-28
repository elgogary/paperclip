import { pgTable, uuid, text, boolean, integer, timestamp, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

export const swarmSources = pgTable(
  "swarm_sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    name: text("name").notNull(),
    url: text("url").notNull(),
    sourceType: text("source_type").notNull(), // local_path | registry | github | npm | custom_url
    trustLevel: text("trust_level").notNull().default("community"), // trusted | verified | community | unknown
    capabilityTypes: jsonb("capability_types").$type<string[]>().notNull().default([]), // skill | mcp | connector | plugin
    enabled: boolean("enabled").notNull().default(true),
    syncIntervalMinutes: integer("sync_interval_minutes").notNull().default(60),
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
    lastSyncStatus: text("last_sync_status"), // success | error | pending
    lastSyncError: text("last_sync_error"),
    capabilityCount: integer("capability_count").notNull().default(0),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyIdx: index("swarm_sources_company_idx").on(table.companyId),
    companyNameUq: uniqueIndex("swarm_sources_company_name_uq").on(table.companyId, table.name),
  }),
);

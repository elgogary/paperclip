import { pgTable, uuid, text, boolean, timestamp, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

export const mcpServerConfigs = pgTable(
  "mcp_server_configs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    direction: text("direction").notNull().default("outbound"),
    transport: text("transport").notNull().default("stdio"),
    command: text("command"),
    args: jsonb("args").$type<string[]>(),
    env: jsonb("env").$type<Record<string, string>>(),
    url: text("url"),
    enabled: boolean("enabled").notNull().default(true),
    healthStatus: text("health_status").notNull().default("unknown"),
    lastHealthCheck: timestamp("last_health_check", { withTimezone: true }),
    catalogId: text("catalog_id"),
    configJson: jsonb("config_json").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companySlugUq: uniqueIndex("mcp_server_configs_company_slug_uq").on(table.companyId, table.slug),
    companyIdx: index("mcp_server_configs_company_idx").on(table.companyId),
  }),
);

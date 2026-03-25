import { pgTable, uuid, text, integer, boolean, timestamp, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

export const plugins = pgTable(
  "plugins",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    icon: text("icon"),
    transport: text("transport"),
    command: text("command"),
    args: jsonb("args").$type<string[]>(),
    env: jsonb("env").$type<Record<string, string>>(),
    url: text("url"),
    toolCount: integer("tool_count").notNull().default(0),
    tools: jsonb("tools").$type<{ name: string; description: string }[]>(),
    healthStatus: text("health_status"),
    lastHealthCheck: timestamp("last_health_check", { withTimezone: true }),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companySlugUq: uniqueIndex("plugins_company_slug_uq").on(table.companyId, table.slug),
    companyIdx: index("plugins_company_idx").on(table.companyId),
  }),
);

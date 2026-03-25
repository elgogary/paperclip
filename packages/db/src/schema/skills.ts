import { type AnyPgColumn, pgTable, uuid, text, boolean, integer, timestamp, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

export const skills = pgTable(
  "skills",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    icon: text("icon"),
    category: text("category"), // coding | research | communication | data | custom
    source: text("source").notNull().default("user"), // user | builtin | community
    instructions: text("instructions").notNull().default(""),
    triggerHint: text("trigger_hint"),
    invokedBy: text("invoked_by").notNull().default("user_or_agent"),
    enabled: boolean("enabled").notNull().default(true),
    createdBy: text("created_by"),
    origin: text("origin").notNull().default("manual"), // manual | captured | derived | fix | imported
    parentId: uuid("parent_id").references((): AnyPgColumn => skills.id),
    version: integer("version").notNull().default(1),
    qualityMetrics: jsonb("quality_metrics").$type<{
      applied_count?: number;
      success_count?: number;
      failure_count?: number;
      fallback_count?: number;
      avg_token_delta?: number;
      completion_rate?: number;
      applied_rate?: number;
      error_rate?: number;
    }>().notNull().default({}),
    embeddingId: text("embedding_id"),
    evolutionStatus: text("evolution_status").notNull().default("active"), // active | dormant | deprecated | pending_review
    defaultVersion: boolean("default_version").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companySlugUq: uniqueIndex("skills_company_slug_uq").on(table.companyId, table.slug),
    companyIdx: index("skills_company_idx").on(table.companyId),
  }),
);

import { pgTable, uuid, text, integer, real, timestamp, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { swarmSources } from "./swarm_sources.js";

export const swarmCapabilities = pgTable(
  "swarm_capabilities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    sourceId: uuid("source_id").notNull().references(() => swarmSources.id),
    externalId: text("external_id"), // ID from the source registry
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    capabilityType: text("capability_type").notNull(), // skill | mcp | connector | plugin
    trustLevel: text("trust_level").notNull().default("community"),
    version: text("version"),
    icon: text("icon"),
    // Pricing
    pricingTier: text("pricing_tier").notNull().default("free"), // free | paid | premium
    priceMonthlyUsd: real("price_monthly_usd").notNull().default(0),
    // Stats
    stars: integer("stars").notNull().default(0),
    installs: integer("installs").notNull().default(0),
    avgQualityScore: real("avg_quality_score"),
    // Content
    readme: text("readme"),
    configTemplate: jsonb("config_template").$type<Record<string, unknown>>(),
    requiredSecrets: jsonb("required_secrets").$type<string[]>(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    // Cache
    contentHash: text("content_hash"),
    cachedAt: timestamp("cached_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyIdx: index("swarm_caps_company_idx").on(table.companyId),
    sourceIdx: index("swarm_caps_source_idx").on(table.sourceId),
    companySlugUq: uniqueIndex("swarm_caps_company_slug_uq").on(table.companyId, table.slug),
    typeIdx: index("swarm_caps_type_idx").on(table.companyId, table.capabilityType),
  }),
);

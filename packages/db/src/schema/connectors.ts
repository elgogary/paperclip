import { pgTable, uuid, text, boolean, timestamp, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

export const connectors = pgTable(
  "connectors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    provider: text("provider").notNull(),
    status: text("status").notNull().default("pending"),
    oauthTokenEncrypted: text("oauth_token_encrypted"),
    oauthRefreshTokenEncrypted: text("oauth_refresh_token_encrypted"),
    oauthExpiresAt: timestamp("oauth_expires_at", { withTimezone: true }),
    scopes: jsonb("scopes").$type<string[]>(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    connectedBy: text("connected_by"),
    connectedAt: timestamp("connected_at", { withTimezone: true }),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyProviderUq: uniqueIndex("connectors_company_provider_uq").on(table.companyId, table.provider),
    companyIdx: index("connectors_company_idx").on(table.companyId),
  }),
);

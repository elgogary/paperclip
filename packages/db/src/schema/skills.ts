import { pgTable, uuid, text, boolean, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
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
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companySlugUq: uniqueIndex("skills_company_slug_uq").on(table.companyId, table.slug),
    companyIdx: index("skills_company_idx").on(table.companyId),
  }),
);

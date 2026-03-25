import { pgTable, uuid, text, integer, timestamp, jsonb, uniqueIndex, index } from "drizzle-orm/pg-core";
import { skills } from "./skills.js";

export const skillVersions = pgTable(
  "skill_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    skillId: uuid("skill_id").notNull().references(() => skills.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    origin: text("origin").notNull(), // fix | derived | captured | manual
    contentDiff: text("content_diff"),
    fullContent: text("full_content").notNull(),
    triggerReason: text("trigger_reason"),
    metricsBefore: jsonb("metrics_before").$type<Record<string, unknown>>().notNull().default({}),
    metricsAfter: jsonb("metrics_after").$type<Record<string, unknown>>().notNull().default({}),
    createdBy: text("created_by"), // 'system' | agent_id | user_id
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    skillVersionUq: uniqueIndex("skill_versions_skill_version_uq").on(table.skillId, table.version),
    skillIdx: index("skill_versions_skill_idx").on(table.skillId),
  }),
);

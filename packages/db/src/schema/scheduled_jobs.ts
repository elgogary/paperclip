import { pgTable, uuid, text, integer, boolean, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

export const scheduledJobs = pgTable(
  "scheduled_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    name: text("name").notNull(),
    description: text("description"),
    scope: text("scope").notNull(), // company | project | agent
    scopeTargetId: uuid("scope_target_id"), // agentId or projectId depending on scope
    jobType: text("job_type").notNull(), // knowledge_sync | webhook | agent_run
    config: jsonb("config").$type<Record<string, unknown>>().notNull().default({}),
    cronExpression: text("cron_expression").notNull(),
    timezone: text("timezone").notNull().default("UTC"),
    timeoutSeconds: integer("timeout_seconds"), // null = auto default by type
    overlapPolicy: text("overlap_policy").notNull().default("skip"), // skip | queue
    missedRunPolicy: text("missed_run_policy").notNull().default("skip"), // skip | run_once
    retryMax: integer("retry_max").notNull().default(0),
    retryDelaySeconds: integer("retry_delay_seconds").notNull().default(300),
    onFailureNotifyInApp: boolean("on_failure_notify_in_app").notNull().default(true),
    onFailureWebhookUrl: text("on_failure_webhook_url"),
    onFailureWebhookSecretId: uuid("on_failure_webhook_secret_id"),
    enabled: boolean("enabled").notNull().default(true),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    nextRunAt: timestamp("next_run_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyNextRunIdx: index("scheduled_jobs_company_next_run_idx").on(table.companyId, table.nextRunAt),
  }),
);

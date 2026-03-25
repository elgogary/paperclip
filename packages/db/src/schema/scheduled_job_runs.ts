import { pgTable, uuid, text, integer, timestamp, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { scheduledJobs } from "./scheduled_jobs.js";

export const scheduledJobRuns = pgTable(
  "scheduled_job_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id").notNull().references(() => scheduledJobs.id, { onDelete: "cascade" }),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    status: text("status").notNull().default("running"), // running | success | failed | timed_out | cancelled
    attempt: integer("attempt").notNull().default(1),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    durationMs: integer("duration_ms"),
    output: text("output"),
    error: text("error"),
    heartbeatRunId: uuid("heartbeat_run_id"), // links agent_run type to heartbeat_runs
    triggeredBy: text("triggered_by").notNull().default("scheduler"), // scheduler | manual | retry
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    jobStartedIdx: index("scheduled_job_runs_job_started_idx").on(table.jobId, table.startedAt),
    companyCreatedIdx: index("scheduled_job_runs_company_created_idx").on(table.companyId, table.createdAt),
  }),
);

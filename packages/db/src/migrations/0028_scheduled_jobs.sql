CREATE TABLE "scheduled_jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id"),
  "name" text NOT NULL,
  "description" text,
  "scope" text NOT NULL,
  "scope_target_id" uuid,
  "job_type" text NOT NULL,
  "config" jsonb DEFAULT '{}' NOT NULL,
  "cron_expression" text NOT NULL,
  "timezone" text DEFAULT 'UTC' NOT NULL,
  "timeout_seconds" integer,
  "overlap_policy" text DEFAULT 'skip' NOT NULL,
  "missed_run_policy" text DEFAULT 'skip' NOT NULL,
  "retry_max" integer DEFAULT 0 NOT NULL,
  "retry_delay_seconds" integer DEFAULT 300 NOT NULL,
  "on_failure_notify_in_app" boolean DEFAULT true NOT NULL,
  "on_failure_webhook_url" text,
  "on_failure_webhook_secret_id" uuid,
  "enabled" boolean DEFAULT true NOT NULL,
  "last_run_at" timestamp with time zone,
  "next_run_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scheduled_job_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "job_id" uuid NOT NULL REFERENCES "scheduled_jobs"("id") ON DELETE CASCADE,
  "company_id" uuid NOT NULL REFERENCES "companies"("id"),
  "status" text DEFAULT 'running' NOT NULL,
  "attempt" integer DEFAULT 1 NOT NULL,
  "started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "finished_at" timestamp with time zone,
  "duration_ms" integer,
  "output" text,
  "error" text,
  "heartbeat_run_id" uuid,
  "triggered_by" text DEFAULT 'scheduler' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "scheduled_jobs_company_next_run_idx" ON "scheduled_jobs" ("company_id", "next_run_at");
--> statement-breakpoint
CREATE INDEX "scheduled_job_runs_job_started_idx" ON "scheduled_job_runs" ("job_id", "started_at" DESC);
--> statement-breakpoint
CREATE INDEX "scheduled_job_runs_company_created_idx" ON "scheduled_job_runs" ("company_id", "created_at" DESC);

CREATE TABLE IF NOT EXISTS "agent_metrics" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id"),
  "agent_id" uuid NOT NULL REFERENCES "agents"("id"),
  "task_id" uuid,
  "tools_used" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "skills_applied" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "skills_failed" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "fallbacks_used" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "duration_minutes" integer,
  "tokens_used" integer,
  "errors" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "success" boolean NOT NULL,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "agent_metrics_agent_idx" ON "agent_metrics" ("agent_id");
CREATE INDEX IF NOT EXISTS "agent_metrics_company_idx" ON "agent_metrics" ("company_id");
CREATE INDEX IF NOT EXISTS "agent_metrics_agent_created_idx" ON "agent_metrics" ("agent_id", "created_at");

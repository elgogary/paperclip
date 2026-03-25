CREATE TABLE "evolution_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"skill_id" uuid,
	"event_type" text NOT NULL,
	"source_monitor" text NOT NULL,
	"heartbeat_run_id" uuid,
	"agent_id" uuid,
	"analysis" jsonb,
	"proposed_content" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"reviewed_by" text,
	"applied_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skill_agent_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"skill_id" uuid NOT NULL,
	"skill_version" integer NOT NULL,
	"agent_id" uuid NOT NULL,
	"applied_count" integer DEFAULT 0 NOT NULL,
	"success_count" integer DEFAULT 0 NOT NULL,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"fallback_count" integer DEFAULT 0 NOT NULL,
	"total_tokens" integer DEFAULT 0 NOT NULL,
	"avg_token_delta" real DEFAULT 0 NOT NULL,
	"last_used_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skill_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"skill_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"origin" text NOT NULL,
	"content_diff" text,
	"full_content" text NOT NULL,
	"trigger_reason" text,
	"metrics_before" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metrics_after" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "skills" ADD COLUMN "origin" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "skills" ADD COLUMN "parent_id" uuid;--> statement-breakpoint
ALTER TABLE "skills" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "skills" ADD COLUMN "quality_metrics" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "skills" ADD COLUMN "embedding_id" text;--> statement-breakpoint
ALTER TABLE "skills" ADD COLUMN "evolution_status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "skills" ADD COLUMN "default_version" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "evolution_events" ADD CONSTRAINT "evolution_events_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evolution_events" ADD CONSTRAINT "evolution_events_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evolution_events" ADD CONSTRAINT "evolution_events_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_agent_metrics" ADD CONSTRAINT "skill_agent_metrics_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_agent_metrics" ADD CONSTRAINT "skill_agent_metrics_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_versions" ADD CONSTRAINT "skill_versions_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "evolution_events_company_created_idx" ON "evolution_events" USING btree ("company_id","created_at");--> statement-breakpoint
CREATE INDEX "evolution_events_skill_idx" ON "evolution_events" USING btree ("skill_id");--> statement-breakpoint
CREATE UNIQUE INDEX "skill_agent_metrics_skill_version_agent_uq" ON "skill_agent_metrics" USING btree ("skill_id","skill_version","agent_id");--> statement-breakpoint
CREATE INDEX "skill_agent_metrics_skill_idx" ON "skill_agent_metrics" USING btree ("skill_id");--> statement-breakpoint
CREATE INDEX "skill_agent_metrics_agent_idx" ON "skill_agent_metrics" USING btree ("agent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "skill_versions_skill_version_uq" ON "skill_versions" USING btree ("skill_id","version");--> statement-breakpoint
CREATE INDEX "skill_versions_skill_idx" ON "skill_versions" USING btree ("skill_id");--> statement-breakpoint
ALTER TABLE "skills" ADD CONSTRAINT "skills_parent_id_skills_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."skills"("id") ON DELETE no action ON UPDATE no action;
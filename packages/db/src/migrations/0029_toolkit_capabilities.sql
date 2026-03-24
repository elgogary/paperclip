CREATE TABLE "skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"icon" text,
	"category" text,
	"source" text DEFAULT 'user' NOT NULL,
	"instructions" text DEFAULT '' NOT NULL,
	"trigger_hint" text,
	"invoked_by" text DEFAULT 'user_or_agent' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skill_agent_access" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"skill_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"granted" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mcp_server_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"direction" text DEFAULT 'outbound' NOT NULL,
	"transport" text DEFAULT 'stdio' NOT NULL,
	"command" text,
	"args" jsonb,
	"env" jsonb,
	"url" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"health_status" text DEFAULT 'unknown' NOT NULL,
	"last_health_check" timestamp with time zone,
	"catalog_id" text,
	"config_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mcp_agent_access" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mcp_server_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"granted" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mcp_catalog" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"icon" text,
	"category" text,
	"npm_package" text,
	"transport" text DEFAULT 'stdio' NOT NULL,
	"default_command" text,
	"default_args" jsonb,
	"required_env" jsonb,
	"docs_url" text,
	"popularity" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "connectors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"provider" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"oauth_token_encrypted" text,
	"oauth_refresh_token_encrypted" text,
	"oauth_expires_at" timestamp with time zone,
	"scopes" jsonb,
	"metadata" jsonb,
	"connected_by" text,
	"connected_at" timestamp with time zone,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plugins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"icon" text,
	"transport" text,
	"command" text,
	"args" jsonb,
	"env" jsonb,
	"url" text,
	"tool_count" integer DEFAULT 0 NOT NULL,
	"tools" jsonb,
	"health_status" text,
	"last_health_check" timestamp with time zone,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plugin_agent_access" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plugin_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"granted" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "skills" ADD CONSTRAINT "skills_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "skill_agent_access" ADD CONSTRAINT "skill_agent_access_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "skill_agent_access" ADD CONSTRAINT "skill_agent_access_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "mcp_server_configs" ADD CONSTRAINT "mcp_server_configs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "mcp_agent_access" ADD CONSTRAINT "mcp_agent_access_mcp_server_id_mcp_server_configs_id_fk" FOREIGN KEY ("mcp_server_id") REFERENCES "public"."mcp_server_configs"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "mcp_agent_access" ADD CONSTRAINT "mcp_agent_access_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "connectors" ADD CONSTRAINT "connectors_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "plugins" ADD CONSTRAINT "plugins_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "plugin_agent_access" ADD CONSTRAINT "plugin_agent_access_plugin_id_plugins_id_fk" FOREIGN KEY ("plugin_id") REFERENCES "public"."plugins"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "plugin_agent_access" ADD CONSTRAINT "plugin_agent_access_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "skills_company_slug_uq" ON "skills" USING btree ("company_id","slug");
--> statement-breakpoint
CREATE INDEX "skills_company_idx" ON "skills" USING btree ("company_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "skill_agent_access_skill_agent_uq" ON "skill_agent_access" USING btree ("skill_id","agent_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "mcp_server_configs_company_slug_uq" ON "mcp_server_configs" USING btree ("company_id","slug");
--> statement-breakpoint
CREATE INDEX "mcp_server_configs_company_idx" ON "mcp_server_configs" USING btree ("company_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "mcp_agent_access_mcp_server_agent_uq" ON "mcp_agent_access" USING btree ("mcp_server_id","agent_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "connectors_company_provider_uq" ON "connectors" USING btree ("company_id","provider");
--> statement-breakpoint
CREATE INDEX "connectors_company_idx" ON "connectors" USING btree ("company_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "plugins_company_slug_uq" ON "plugins" USING btree ("company_id","slug");
--> statement-breakpoint
CREATE INDEX "plugins_company_idx" ON "plugins" USING btree ("company_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "plugin_agent_access_plugin_agent_uq" ON "plugin_agent_access" USING btree ("plugin_id","agent_id");

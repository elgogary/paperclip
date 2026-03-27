-- Swarm Sources: registries and repos the swarm pulls from
CREATE TABLE IF NOT EXISTS "swarm_sources" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id"),
  "name" text NOT NULL,
  "url" text NOT NULL,
  "source_type" text NOT NULL,
  "trust_level" text DEFAULT 'community' NOT NULL,
  "capability_types" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "sync_interval_minutes" integer DEFAULT 60 NOT NULL,
  "last_sync_at" timestamp with time zone,
  "last_sync_status" text,
  "last_sync_error" text,
  "capability_count" integer DEFAULT 0 NOT NULL,
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "swarm_sources_company_idx" ON "swarm_sources" USING btree ("company_id");
CREATE UNIQUE INDEX IF NOT EXISTS "swarm_sources_company_name_uq" ON "swarm_sources" USING btree ("company_id", "name");

-- Swarm Capabilities: cached registry metadata (browseable, not installed)
CREATE TABLE IF NOT EXISTS "swarm_capabilities" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id"),
  "source_id" uuid NOT NULL REFERENCES "swarm_sources"("id"),
  "external_id" text,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "description" text,
  "capability_type" text NOT NULL,
  "trust_level" text DEFAULT 'community' NOT NULL,
  "version" text,
  "icon" text,
  "pricing_tier" text DEFAULT 'free' NOT NULL,
  "price_monthly_usd" real DEFAULT 0 NOT NULL,
  "stars" integer DEFAULT 0 NOT NULL,
  "installs" integer DEFAULT 0 NOT NULL,
  "avg_quality_score" real,
  "readme" text,
  "config_template" jsonb,
  "required_secrets" jsonb,
  "metadata" jsonb,
  "content_hash" text,
  "cached_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "swarm_caps_company_idx" ON "swarm_capabilities" USING btree ("company_id");
CREATE INDEX IF NOT EXISTS "swarm_caps_source_idx" ON "swarm_capabilities" USING btree ("source_id");
CREATE UNIQUE INDEX IF NOT EXISTS "swarm_caps_company_slug_uq" ON "swarm_capabilities" USING btree ("company_id", "slug");
CREATE INDEX IF NOT EXISTS "swarm_caps_type_idx" ON "swarm_capabilities" USING btree ("company_id", "capability_type");

-- Swarm Installs: source of truth for what's installed
CREATE TABLE IF NOT EXISTS "swarm_installs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id"),
  "capability_id" uuid REFERENCES "swarm_capabilities"("id"),
  "name" text NOT NULL,
  "capability_type" text NOT NULL,
  "version" text,
  "status" text DEFAULT 'active' NOT NULL,
  "installed_by" uuid REFERENCES "agents"("id"),
  "installed_by_board" text,
  "approved_by" text,
  "pricing_tier" text DEFAULT 'free' NOT NULL,
  "price_monthly_usd" real DEFAULT 0 NOT NULL,
  "total_cost_usd" real DEFAULT 0 NOT NULL,
  "total_value_usd" real DEFAULT 0 NOT NULL,
  "reuse_count" integer DEFAULT 0 NOT NULL,
  "avg_quality_score" real,
  "content_hash" text,
  "config" jsonb,
  "snapshot" jsonb,
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "removed_at" timestamp with time zone
);

CREATE INDEX IF NOT EXISTS "swarm_installs_company_idx" ON "swarm_installs" USING btree ("company_id");
CREATE UNIQUE INDEX IF NOT EXISTS "swarm_installs_company_name_uq" ON "swarm_installs" USING btree ("company_id", "name");
CREATE INDEX IF NOT EXISTS "swarm_installs_type_idx" ON "swarm_installs" USING btree ("company_id", "capability_type");
CREATE INDEX IF NOT EXISTS "swarm_installs_status_idx" ON "swarm_installs" USING btree ("company_id", "status");

-- Swarm Audit Log: all swarm operations
CREATE TABLE IF NOT EXISTS "swarm_audit_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id"),
  "action" text NOT NULL,
  "capability_name" text,
  "capability_type" text,
  "actor_type" text NOT NULL,
  "actor_id" uuid REFERENCES "agents"("id"),
  "actor_board_user_id" text,
  "detail" text,
  "cost_usd" real,
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "swarm_audit_company_idx" ON "swarm_audit_log" USING btree ("company_id");
CREATE INDEX IF NOT EXISTS "swarm_audit_company_action_idx" ON "swarm_audit_log" USING btree ("company_id", "action");
CREATE INDEX IF NOT EXISTS "swarm_audit_created_idx" ON "swarm_audit_log" USING btree ("created_at");

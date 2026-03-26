CREATE TABLE IF NOT EXISTS "chat_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL REFERENCES "companies"("id"),
	"agent_id" uuid NOT NULL REFERENCES "agents"("id"),
	"issue_id" uuid NOT NULL,
	"token" text NOT NULL UNIQUE,
	"customer_email" text NOT NULL,
	"customer_name" text,
	"expires_at" timestamp with time zone NOT NULL,
	"message_count" integer DEFAULT 0 NOT NULL,
	"max_messages" integer DEFAULT 30 NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone
);

CREATE INDEX IF NOT EXISTS "chat_sessions_token_idx" ON "chat_sessions" ("token");
CREATE INDEX IF NOT EXISTS "chat_sessions_expires_idx" ON "chat_sessions" ("expires_at");

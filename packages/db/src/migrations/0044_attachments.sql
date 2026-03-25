CREATE TABLE IF NOT EXISTS "attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"issue_id" uuid NOT NULL,
	"comment_id" uuid,
	"uploader_type" text NOT NULL,
	"uploader_id" text NOT NULL,
	"filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"storage_key" text NOT NULL,
	"thumbnail_key" text,
	"html_preview_key" text,
	"version_of" uuid,
	"version_num" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'processing' NOT NULL,
	"publish_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attachments_company_id_companies_id_fk') THEN
  ALTER TABLE "attachments" ADD CONSTRAINT "attachments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;
 END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attachments_issue_id_issues_id_fk') THEN
  ALTER TABLE "attachments" ADD CONSTRAINT "attachments_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE cascade ON UPDATE no action;
 END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attachments_comment_id_issue_comments_id_fk') THEN
  ALTER TABLE "attachments" ADD CONSTRAINT "attachments_comment_id_issue_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."issue_comments"("id") ON DELETE set null ON UPDATE no action;
 END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attachments_version_of_attachments_id_fk') THEN
  ALTER TABLE "attachments" ADD CONSTRAINT "attachments_version_of_attachments_id_fk" FOREIGN KEY ("version_of") REFERENCES "public"."attachments"("id") ON DELETE set null ON UPDATE no action;
 END IF;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "attachments_issue_idx" ON "attachments" USING btree ("issue_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "attachments_company_issue_idx" ON "attachments" USING btree ("company_id","issue_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "attachments_comment_idx" ON "attachments" USING btree ("comment_id");

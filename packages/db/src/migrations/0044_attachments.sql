CREATE TABLE IF NOT EXISTS "attachments" (
  "id"               uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id"       uuid NOT NULL REFERENCES "companies"("id") ON DELETE RESTRICT,
  "issue_id"         uuid NOT NULL REFERENCES "issues"("id") ON DELETE CASCADE,
  "comment_id"       uuid REFERENCES "issue_comments"("id") ON DELETE SET NULL,
  "uploader_type"    text NOT NULL,
  "uploader_id"      text NOT NULL,
  "filename"         text NOT NULL,
  "mime_type"        text NOT NULL,
  "size_bytes"       bigint NOT NULL,
  "storage_key"      text NOT NULL,
  "thumbnail_key"    text,
  "html_preview_key" text,
  "version_of"       uuid,
  "version_num"      integer NOT NULL DEFAULT 1,
  "status"           text NOT NULL DEFAULT 'processing',
  "publish_url"      text,
  "created_at"       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "attachments_issue_idx"   ON "attachments"("issue_id");
CREATE INDEX "attachments_company_idx" ON "attachments"("company_id");
CREATE INDEX "attachments_comment_idx" ON "attachments"("comment_id");

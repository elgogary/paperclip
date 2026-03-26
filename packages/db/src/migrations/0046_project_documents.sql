-- Add project_id to documents so docs can be linked to projects
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "project_id" uuid REFERENCES "projects"("id");
CREATE INDEX IF NOT EXISTS "documents_project_idx" ON "documents" ("project_id") WHERE "project_id" IS NOT NULL;

-- Add key column for URL-friendly document slugs within a project
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "key" text;
CREATE UNIQUE INDEX IF NOT EXISTS "documents_company_key_uq" ON "documents" ("company_id", "key") WHERE "key" IS NOT NULL;

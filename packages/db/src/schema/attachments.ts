import { type AnyPgColumn, pgTable, uuid, text, bigint, integer, timestamp, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { issues } from "./issues.js";
import { issueComments } from "./issue_comments.js";

// valid status values: 'processing' | 'ready' | 'error'

export const attachments = pgTable(
  "attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    issueId: uuid("issue_id").notNull().references(() => issues.id, { onDelete: "cascade" }),
    commentId: uuid("comment_id").references(() => issueComments.id, { onDelete: "set null" }),
    // uploader_type: 'user' | 'agent'
    uploaderType: text("uploader_type").notNull(),
    uploaderId: text("uploader_id").notNull(),
    filename: text("filename").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    storageKey: text("storage_key").notNull(),
    thumbnailKey: text("thumbnail_key"),
    htmlPreviewKey: text("html_preview_key"),
    versionOf: uuid("version_of").references((): AnyPgColumn => attachments.id, { onDelete: "set null" }),
    versionNum: integer("version_num").notNull().default(1),
    status: text("status").notNull().default("processing"),
    publishUrl: text("publish_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    issueIdx: index("attachments_issue_idx").on(table.issueId),
    companyIssueIdx: index("attachments_company_issue_idx").on(table.companyId, table.issueId),
    commentIdx: index("attachments_comment_idx").on(table.commentId),
  }),
);

# Multimodal Attachment System — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Full bidirectional file attachment system for Sanad AI EOI — humans and agents attach any file type (images, video, PDF, Office, code), previewed inline in the issue thread, with agent vision support and YouTube/LinkedIn publish pipeline.

**Architecture:** Chunked uploads → MinIO (`paperclip-files` bucket) → async media-worker Docker sidecar (ffmpeg + LibreOffice headless) for thumbnails/HTML conversion → `AttachmentCard` UI component per file type → agent syntax `[[attach:/workspace/path]]` auto-resolved on comment save.

**Tech Stack:** Drizzle ORM (PostgreSQL), MinIO S3, Node.js/TypeScript server, React/TypeScript UI, ffmpeg, LibreOffice headless, PDF.js, highlight.js, YouTube Data API v3, LinkedIn Video API.

**Server:** 65.109.65.159 (Hetzner — alongside existing Sanad AI EOI + Sanad Brain services)

---

## Phase 1: Database + Storage Foundation

### Task 1: Attachments DB schema

**Files:**
- Create: `packages/db/src/schema/attachments.ts`
- Modify: `packages/db/src/schema/index.ts` (add export)
- Create: `packages/db/src/migrations/0031_attachments.sql`

**Step 1: Create the schema file**

```typescript
// packages/db/src/schema/attachments.ts
import { pgTable, uuid, text, bigint, integer, timestamp, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { issues } from "./issues.js";
import { issueComments } from "./issue_comments.js";
import { agents } from "./agents.js";

export const attachments = pgTable(
  "attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    issueId: uuid("issue_id").notNull().references(() => issues.id, { onDelete: "cascade" }),
    commentId: uuid("comment_id").references(() => issueComments.id, { onDelete: "set null" }),
    uploaderType: text("uploader_type").notNull(),   // 'user' | 'agent'
    uploaderId: text("uploader_id").notNull(),
    filename: text("filename").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    storageKey: text("storage_key").notNull(),
    thumbnailKey: text("thumbnail_key"),
    htmlPreviewKey: text("html_preview_key"),
    versionOf: uuid("version_of"),                   // null = original
    versionNum: integer("version_num").notNull().default(1),
    status: text("status").notNull().default("processing"), // processing | ready | error
    publishUrl: text("publish_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    issueIdx: index("attachments_issue_idx").on(table.issueId),
    companyIdx: index("attachments_company_idx").on(table.companyId),
    commentIdx: index("attachments_comment_idx").on(table.commentId),
  }),
);
```

**Step 2: Export from schema index**

In `packages/db/src/schema/index.ts`, add:
```typescript
export * from "./attachments.js";
```

**Step 3: Write the migration SQL**

```sql
-- packages/db/src/migrations/0031_attachments.sql
CREATE TABLE IF NOT EXISTS "attachments" (
  "id"               uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id"       uuid NOT NULL REFERENCES "companies"("id"),
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
```

**Step 4: Run migration**
```bash
cd /home/eslam/data/projects/paperclip
pnpm --filter @sanadai/db migrate
```
Expected: Migration 0031 applied successfully.

**Step 5: Commit**
```bash
git add packages/db/src/schema/attachments.ts packages/db/src/schema/index.ts packages/db/src/migrations/0031_attachments.sql
git commit -m "feat(db): add attachments table with versioning and status"
```

---

### Task 2: Extend attachment-types.ts for all file types + large files

**Files:**
- Modify: `server/src/attachment-types.ts`

**Step 1: Update allowed types and size limit**

Replace `DEFAULT_ALLOWED_TYPES` and `MAX_ATTACHMENT_BYTES` in `server/src/attachment-types.ts`:

```typescript
export const DEFAULT_ALLOWED_TYPES: readonly string[] = [
  "image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif",
  "video/mp4", "video/webm", "video/quicktime", "video/avi",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",  // docx
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",        // xlsx
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",// pptx
  "application/msword", "application/vnd.ms-excel", "application/vnd.ms-powerpoint",
  "text/plain", "text/csv", "text/markdown",
  "application/json", "application/xml",
  "text/javascript", "text/typescript", "text/x-python", "text/x-java",
];

// 2 GB for video, 100 MB default for other types
export const MAX_ATTACHMENT_BYTES =
  Number(process.env.PAPERCLIP_ATTACHMENT_MAX_BYTES) || 100 * 1024 * 1024;

export const MAX_VIDEO_BYTES =
  Number(process.env.PAPERCLIP_VIDEO_MAX_BYTES) || 2 * 1024 * 1024 * 1024;
```

Add helper:
```typescript
export function isVideoType(mimeType: string): boolean {
  return mimeType.startsWith("video/");
}

export function maxBytesForType(mimeType: string): number {
  return isVideoType(mimeType) ? MAX_VIDEO_BYTES : MAX_ATTACHMENT_BYTES;
}
```

**Step 2: Write unit tests**

```typescript
// server/src/__tests__/attachment-types.test.ts
import { describe, it, expect } from "vitest";
import { matchesContentType, maxBytesForType, isVideoType } from "../attachment-types.js";

describe("matchesContentType", () => {
  it("allows video/mp4", () => expect(matchesContentType("video/mp4", ["video/*"])).toBe(true));
  it("allows docx", () => {
    const type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    expect(matchesContentType(type, ["application/vnd.openxmlformats-officedocument.*"])).toBe(true);
  });
});

describe("maxBytesForType", () => {
  it("returns 2GB for video", () => expect(maxBytesForType("video/mp4")).toBe(2 * 1024 * 1024 * 1024));
  it("returns 100MB for pdf", () => expect(maxBytesForType("application/pdf")).toBe(100 * 1024 * 1024));
});
```

**Step 3: Run tests**
```bash
pnpm --filter @sanadai/server test attachment-types
```
Expected: All pass.

**Step 4: Commit**
```bash
git add server/src/attachment-types.ts server/src/__tests__/attachment-types.test.ts
git commit -m "feat: extend allowed attachment types and size limits for all media"
```

---

### Task 3: Chunked upload API routes

**Files:**
- Create: `server/src/routes/attachments.ts`
- Modify: `server/src/routes/index.ts` (register router)

**Step 1: Create attachments router**

```typescript
// server/src/routes/attachments.ts
import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireCompanyAccess } from "../routes/authz.js";
import { db, attachments } from "@sanadai/db";
import { storageService } from "../storage/service.js";
import { isAllowedContentType, maxBytesForType } from "../attachment-types.js";
import { eq } from "drizzle-orm";

export const attachmentsRouter = Router();

// POST /api/attachments/init — start chunked upload
attachmentsRouter.post("/init", requireAuth, requireCompanyAccess, async (req, res) => {
  const { filename, mimeType, sizeBytes, issueId } = req.body;

  if (!isAllowedContentType(mimeType)) {
    return res.status(415).json({ error: `File type ${mimeType} not allowed` });
  }

  if (sizeBytes > maxBytesForType(mimeType)) {
    return res.status(413).json({ error: "File too large" });
  }

  const storageKey = `${req.companyId}/attachments/${Date.now()}-${filename}`;

  const [attachment] = await db.insert(attachments).values({
    companyId: req.companyId,
    issueId,
    uploaderType: "user",
    uploaderId: req.userId,
    filename,
    mimeType,
    sizeBytes,
    storageKey,
    status: "processing",
  }).returning();

  // Get multipart upload ID from storage provider
  const uploadId = await storageService.initMultipartUpload(storageKey, mimeType);

  res.json({ attachmentId: attachment.id, uploadId, storageKey });
});

// PUT /api/attachments/:id/chunks/:n — upload a chunk
attachmentsRouter.put("/:id/chunks/:n", requireAuth, requireCompanyAccess, async (req, res) => {
  const { id, n } = req.params;
  const chunkNum = parseInt(n, 10);

  const [attachment] = await db.select().from(attachments)
    .where(eq(attachments.id, id)).limit(1);

  if (!attachment || attachment.companyId !== req.companyId) {
    return res.status(404).json({ error: "Attachment not found" });
  }

  const etag = await storageService.uploadChunk(
    attachment.storageKey,
    req.body as Buffer,
    chunkNum,
    req.headers["x-upload-id"] as string,
  );

  res.json({ received: true, etag });
});

// POST /api/attachments/:id/complete — finalize upload
attachmentsRouter.post("/:id/complete", requireAuth, requireCompanyAccess, async (req, res) => {
  const { id } = req.params;
  const { uploadId, parts, commentId } = req.body;

  const [attachment] = await db.select().from(attachments)
    .where(eq(attachments.id, id)).limit(1);

  if (!attachment || attachment.companyId !== req.companyId) {
    return res.status(404).json({ error: "Attachment not found" });
  }

  await storageService.completeMultipartUpload(attachment.storageKey, uploadId, parts);

  // Link to comment if provided
  if (commentId) {
    await db.update(attachments).set({ commentId }).where(eq(attachments.id, id));
  }

  // Queue thumbnail/conversion job (fire-and-forget)
  queueMediaJob(attachment).catch(console.error);

  const updated = { ...attachment, commentId, status: "processing" };
  res.json({ attachment: updated });
});

// GET /api/attachments/:id/url — get presigned download URL
attachmentsRouter.get("/:id/url", requireAuth, requireCompanyAccess, async (req, res) => {
  const [attachment] = await db.select().from(attachments)
    .where(eq(attachments.id, req.params.id)).limit(1);

  if (!attachment || attachment.companyId !== req.companyId) {
    return res.status(404).json({ error: "Not found" });
  }

  const url = await storageService.getPresignedUrl(attachment.storageKey, 1800);
  const thumbnailUrl = attachment.thumbnailKey
    ? await storageService.getPresignedUrl(attachment.thumbnailKey, 1800)
    : null;
  const previewUrl = attachment.htmlPreviewKey
    ? await storageService.getPresignedUrl(attachment.htmlPreviewKey, 1800)
    : null;

  res.json({ url, thumbnailUrl, previewUrl, attachment });
});

// GET /api/issues/:issueId/attachments — list attachments for issue
attachmentsRouter.get("/issue/:issueId", requireAuth, requireCompanyAccess, async (req, res) => {
  const rows = await db.select().from(attachments)
    .where(eq(attachments.issueId, req.params.issueId));
  res.json({ attachments: rows });
});

async function queueMediaJob(attachment: typeof attachments.$inferSelect) {
  const WORKER_URL = process.env.MEDIA_WORKER_URL ?? "http://localhost:8200";
  await fetch(`${WORKER_URL}/thumbnail`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ attachmentId: attachment.id, storageKey: attachment.storageKey, mimeType: attachment.mimeType }),
  });
}
```

**Step 2: Register in routes/index.ts**

Find where routes are registered and add:
```typescript
import { attachmentsRouter } from "./attachments.js";
// ...
app.use("/api/attachments", attachmentsRouter);
```

**Step 3: Write route tests**

```typescript
// server/src/__tests__/attachments-routes.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@sanadai/db", () => ({
  db: { insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn(() => [{ id: "att-1", companyId: "co-1", storageKey: "co-1/attachments/test.pdf" }]) })) })),
        select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(() => []) })) })) })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(() => {}) })) })) },
  attachments: {},
}));

describe("POST /api/attachments/init", () => {
  it("rejects disallowed mime type", async () => {
    // test 415 for application/x-executable
  });
  it("rejects oversized file", async () => {
    // test 413 for sizeBytes > limit
  });
});
```

**Step 4: Run tests**
```bash
pnpm --filter @sanadai/server test attachments
```

**Step 5: Commit**
```bash
git add server/src/routes/attachments.ts server/src/routes/index.ts server/src/__tests__/attachments-routes.test.ts
git commit -m "feat(server): chunked upload API for attachments"
```

---

## Phase 2: Agent Attach Syntax

### Task 4: `[[attach:]]` comment parser

**Files:**
- Create: `server/src/services/attachment-resolver.ts`
- Modify: `server/src/routes/issues.ts` (hook into comment create)

**Step 1: Write failing tests**

```typescript
// server/src/__tests__/attachment-resolver.test.ts
import { describe, it, expect } from "vitest";
import { parseAttachTokens, replaceAttachTokens } from "../services/attachment-resolver.js";

describe("parseAttachTokens", () => {
  it("parses simple path", () => {
    const tokens = parseAttachTokens("See [[attach:/workspace/docs/report.docx]]");
    expect(tokens).toEqual([{
      raw: "[[attach:/workspace/docs/report.docx]]",
      path: "/workspace/docs/report.docx",
      title: undefined,
    }]);
  });

  it("parses path with title", () => {
    const tokens = parseAttachTokens('[[attach:/workspace/output/demo.mp4 | title="Demo v2"]]');
    expect(tokens[0].title).toBe("Demo v2");
    expect(tokens[0].path).toBe("/workspace/output/demo.mp4");
  });

  it("returns empty for no tokens", () => {
    expect(parseAttachTokens("plain text")).toEqual([]);
  });

  it("handles multiple tokens", () => {
    const body = "[[attach:/a/b.pdf]] and [[attach:/c/d.docx]]";
    expect(parseAttachTokens(body)).toHaveLength(2);
  });
});

describe("replaceAttachTokens", () => {
  it("replaces token with attachment id marker", () => {
    const result = replaceAttachTokens(
      "See [[attach:/workspace/docs/report.docx]]",
      [{ raw: "[[attach:/workspace/docs/report.docx]]", path: "/workspace/docs/report.docx", attachmentId: "att-123" }]
    );
    expect(result).toBe("See [[attachment:att-123]]");
  });
});
```

**Step 2: Run tests to confirm they fail**
```bash
pnpm --filter @sanadai/server test attachment-resolver
```
Expected: FAIL — module not found.

**Step 3: Implement the resolver**

```typescript
// server/src/services/attachment-resolver.ts
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { db, attachments } from "@sanadai/db";
import { storageService } from "../storage/service.js";
import { isAllowedContentType } from "../attachment-types.js";
import mime from "mime-types";

const ATTACH_REGEX = /\[\[attach:([^\]\|]+?)(?:\s*\|\s*title="([^"]*)")?\]\]/g;

export interface AttachToken {
  raw: string;
  path: string;
  title?: string;
  attachmentId?: string;
}

export function parseAttachTokens(body: string): AttachToken[] {
  const tokens: AttachToken[] = [];
  let match: RegExpExecArray | null;
  ATTACH_REGEX.lastIndex = 0;
  while ((match = ATTACH_REGEX.exec(body)) !== null) {
    tokens.push({ raw: match[0], path: match[1].trim(), title: match[2] });
  }
  return tokens;
}

export function replaceAttachTokens(body: string, resolved: (AttachToken & { attachmentId: string })[]): string {
  let result = body;
  for (const token of resolved) {
    result = result.replace(token.raw, `[[attachment:${token.attachmentId}]]`);
  }
  return result;
}

export async function resolveAttachTokens(
  tokens: AttachToken[],
  companyId: string,
  issueId: string,
  agentId: string,
): Promise<(AttachToken & { attachmentId: string })[]> {
  const resolved: (AttachToken & { attachmentId: string })[] = [];

  for (const token of tokens) {
    // Security: only allow paths inside /workspace/
    const normalised = path.normalize(token.path);
    if (!normalised.startsWith("/workspace/")) {
      console.warn(`[attach-resolver] Rejected path outside /workspace/: ${token.path}`);
      continue;
    }

    let fileBuffer: Buffer;
    try {
      fileBuffer = await fs.readFile(normalised);
    } catch {
      console.warn(`[attach-resolver] File not found: ${normalised}`);
      continue;
    }

    const filename = path.basename(normalised);
    const mimeType = mime.lookup(filename) || "application/octet-stream";

    if (!isAllowedContentType(mimeType)) {
      console.warn(`[attach-resolver] Disallowed mime type: ${mimeType}`);
      continue;
    }

    const storageKey = `${companyId}/attachments/agent/${Date.now()}-${filename}`;
    await storageService.putObject(storageKey, fileBuffer, mimeType);

    const [attachment] = await db.insert(attachments).values({
      companyId,
      issueId,
      uploaderType: "agent",
      uploaderId: agentId,
      filename: token.title ?? filename,
      mimeType,
      sizeBytes: fileBuffer.byteLength,
      storageKey,
      status: "processing",
    }).returning();

    resolved.push({ ...token, attachmentId: attachment.id });

    // Queue thumbnail job
    const WORKER_URL = process.env.MEDIA_WORKER_URL ?? "http://localhost:8200";
    fetch(`${WORKER_URL}/thumbnail`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attachmentId: attachment.id, storageKey, mimeType }),
    }).catch(console.error);
  }

  return resolved;
}
```

**Step 4: Run tests**
```bash
pnpm --filter @sanadai/server test attachment-resolver
```
Expected: All pass.

**Step 5: Hook into comment creation in `server/src/routes/issues.ts`**

Find the comment POST handler and add before saving body:
```typescript
import { parseAttachTokens, resolveAttachTokens, replaceAttachTokens } from "../services/attachment-resolver.js";

// Inside the comment create handler, before inserting comment:
const tokens = parseAttachTokens(body);
let resolvedBody = body;
if (tokens.length > 0 && req.agentId) {
  const resolved = await resolveAttachTokens(tokens, req.companyId, issueId, req.agentId);
  resolvedBody = replaceAttachTokens(body, resolved);
}
// Use resolvedBody instead of body when inserting
```

**Step 6: Commit**
```bash
git add server/src/services/attachment-resolver.ts server/src/__tests__/attachment-resolver.test.ts server/src/routes/issues.ts
git commit -m "feat(server): agent [[attach:]] syntax parser and workspace file resolver"
```

---

## Phase 3: media-worker Docker Service

### Task 5: media-worker Node.js service

**Files:**
- Create: `docker/media-worker/` directory
- Create: `docker/media-worker/package.json`
- Create: `docker/media-worker/src/index.ts`
- Create: `docker/media-worker/Dockerfile`

**Step 1: Create the service**

```typescript
// docker/media-worker/src/index.ts
import Fastify from "fastify";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";

const exec = promisify(execFile);
const app = Fastify({ logger: true });

const s3 = new S3Client({
  endpoint: process.env.MINIO_ENDPOINT ?? "http://minio:9000",
  region: "us-east-1",
  credentials: {
    accessKeyId: process.env.MINIO_ACCESS_KEY ?? "",
    secretAccessKey: process.env.MINIO_SECRET_KEY ?? "",
  },
  forcePathStyle: true,
});

const BUCKET = process.env.MINIO_BUCKET ?? "paperclip-files";

async function downloadFromMinIO(key: string): Promise<Buffer> {
  const { Body } = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  const chunks: Buffer[] = [];
  for await (const chunk of Body as AsyncIterable<Buffer>) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function uploadToMinIO(key: string, data: Buffer, contentType: string): Promise<void> {
  await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: data, ContentType: contentType }));
}

// POST /thumbnail
app.post<{ Body: { attachmentId: string; storageKey: string; mimeType: string } }>("/thumbnail", async (req, reply) => {
  const { storageKey, mimeType } = req.body;
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "mw-"));

  try {
    const fileBuffer = await downloadFromMinIO(storageKey);
    const inputPath = path.join(tmpDir, path.basename(storageKey));
    await fs.writeFile(inputPath, fileBuffer);

    const thumbPath = path.join(tmpDir, "thumb.jpg");
    const thumbnailKey = storageKey.replace(/(\.[^.]+)?$/, "-thumb.jpg");

    if (mimeType.startsWith("video/")) {
      // ffmpeg: extract frame at 1 second
      await exec("ffmpeg", ["-i", inputPath, "-ss", "00:00:01", "-vframes", "1", "-vf", "scale=640:-1", thumbPath]);
    } else if (mimeType.startsWith("image/")) {
      // ffmpeg: resize image to max 640px
      await exec("ffmpeg", ["-i", inputPath, "-vf", "scale=640:-1", thumbPath]);
    } else {
      return reply.send({ thumbnailKey: null, message: "No thumbnail for this type" });
    }

    const thumbBuffer = await fs.readFile(thumbPath);
    await uploadToMinIO(thumbnailKey, thumbBuffer, "image/jpeg");

    return reply.send({ thumbnailKey });
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

// POST /convert  (Office → HTML)
app.post<{ Body: { storageKey: string; mimeType: string } }>("/convert", async (req, reply) => {
  const { storageKey, mimeType } = req.body;
  const officeTypes = [
    "application/vnd.openxmlformats-officedocument",
    "application/msword",
    "application/vnd.ms-excel",
    "application/vnd.ms-powerpoint",
  ];
  if (!officeTypes.some(t => mimeType.startsWith(t))) {
    return reply.status(400).send({ error: "Not an Office file" });
  }

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "mw-conv-"));
  try {
    const fileBuffer = await downloadFromMinIO(storageKey);
    const inputPath = path.join(tmpDir, path.basename(storageKey));
    await fs.writeFile(inputPath, fileBuffer);

    // LibreOffice headless: convert to HTML
    await exec("soffice", ["--headless", "--convert-to", "html", "--outdir", tmpDir, inputPath]);

    const htmlFile = (await fs.readdir(tmpDir)).find(f => f.endsWith(".html"));
    if (!htmlFile) throw new Error("LibreOffice conversion produced no HTML output");

    const htmlBuffer = await fs.readFile(path.join(tmpDir, htmlFile));
    const htmlKey = storageKey.replace(/(\.[^.]+)?$/, "-preview.html");
    await uploadToMinIO(htmlKey, htmlBuffer, "text/html");

    return reply.send({ htmlPreviewKey: htmlKey });
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

// GET /health
app.get("/health", async () => ({ status: "ok" }));

app.listen({ port: 8200, host: "0.0.0.0" }, (err) => {
  if (err) { console.error(err); process.exit(1); }
});
```

**Step 2: Create Dockerfile**

```dockerfile
# docker/media-worker/Dockerfile
FROM jrottenberg/ffmpeg:6.1-ubuntu2204 AS base

RUN apt-get update && apt-get install -y \
    libreoffice \
    nodejs \
    npm \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json ./
RUN npm install --production
COPY src/ ./src/

EXPOSE 8200
CMD ["node", "--loader", "ts-node/esm", "src/index.ts"]
```

**Step 3: Add to docker-compose.yml on server**

```yaml
# Add to docker-compose.yml
media-worker:
  build:
    context: ./docker/media-worker
  restart: unless-stopped
  environment:
    - MINIO_ENDPOINT=http://minio:9000
    - MINIO_ACCESS_KEY=${MINIO_ACCESS_KEY}
    - MINIO_SECRET_KEY=${MINIO_SECRET_KEY}
    - MINIO_BUCKET=paperclip-files
  ports:
    - "127.0.0.1:8200:8200"
  volumes:
    - /workspace:/workspace:ro
```

**Step 4: Commit**
```bash
git add docker/media-worker/
git commit -m "feat(media-worker): Docker sidecar with ffmpeg thumbnails + LibreOffice HTML conversion"
```

---

## Phase 4: UI — AttachmentCard + MarkdownBody

### Task 6: AttachmentCard component

**Files:**
- Create: `ui/src/components/AttachmentCard.tsx`
- Create: `ui/src/api/attachments.ts`
- Modify: `ui/src/components/MarkdownBody.tsx`
- Modify: `ui/src/components/CommentThread.tsx`

**Step 1: Create the API client**

```typescript
// ui/src/api/attachments.ts
import { apiFetch } from "./client.js";

export interface Attachment {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  status: "processing" | "ready" | "error";
  versionNum: number;
  createdAt: string;
}

export interface AttachmentUrls {
  url: string;
  thumbnailUrl: string | null;
  previewUrl: string | null;
  attachment: Attachment;
}

export async function getAttachmentUrls(attachmentId: string): Promise<AttachmentUrls> {
  return apiFetch(`/api/attachments/${attachmentId}/url`);
}

export async function initUpload(payload: {
  filename: string; mimeType: string; sizeBytes: number; issueId: string;
}): Promise<{ attachmentId: string; uploadId: string; storageKey: string }> {
  return apiFetch("/api/attachments/init", { method: "POST", body: JSON.stringify(payload) });
}

export async function uploadChunk(attachmentId: string, chunkNum: number, uploadId: string, chunk: ArrayBuffer): Promise<void> {
  await apiFetch(`/api/attachments/${attachmentId}/chunks/${chunkNum}`, {
    method: "PUT",
    headers: { "x-upload-id": uploadId, "Content-Type": "application/octet-stream" },
    body: chunk,
  });
}

export async function completeUpload(attachmentId: string, uploadId: string, parts: { ETag: string; PartNumber: number }[], commentId?: string): Promise<{ attachment: Attachment }> {
  return apiFetch(`/api/attachments/${attachmentId}/complete`, {
    method: "POST",
    body: JSON.stringify({ uploadId, parts, commentId }),
  });
}
```

**Step 2: Create AttachmentCard component**

```tsx
// ui/src/components/AttachmentCard.tsx
import { useEffect, useState } from "react";
import { FileText, Film, Image, Table, Code, Download, Loader2, AlertCircle } from "lucide-react";
import { getAttachmentUrls, type AttachmentUrls } from "../api/attachments.js";
import { cn } from "../lib/utils.js";

interface AttachmentCardProps {
  attachmentId: string;
  className?: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getMimeCategory(mimeType: string): "image" | "video" | "pdf" | "office" | "code" | "other" {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType.startsWith("application/vnd") || mimeType.includes("msword") || mimeType.includes("ms-excel")) return "office";
  if (mimeType.startsWith("text/") || ["application/json", "application/xml"].includes(mimeType)) return "code";
  return "other";
}

export function AttachmentCard({ attachmentId, className }: AttachmentCardProps) {
  const [data, setData] = useState<AttachmentUrls | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    getAttachmentUrls(attachmentId)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [attachmentId]);

  if (error) {
    return (
      <div className={cn("flex items-center gap-2 text-destructive text-sm border border-destructive/30 rounded p-2", className)}>
        <AlertCircle className="h-4 w-4 shrink-0" />
        <span>Failed to load attachment</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className={cn("flex items-center gap-2 text-muted-foreground text-sm border border-border rounded p-2", className)}>
        <Loader2 className="h-4 w-4 animate-spin shrink-0" />
        <span>Loading attachment...</span>
      </div>
    );
  }

  const { attachment, url, thumbnailUrl, previewUrl } = data;
  const category = getMimeCategory(attachment.mimeType);

  // IMAGE — inline
  if (category === "image") {
    return (
      <div className={cn("rounded overflow-hidden border border-border", className)}>
        <img
          src={url}
          alt={attachment.filename}
          className="max-w-full cursor-pointer hover:opacity-90 transition-opacity"
          onClick={() => window.open(url, "_blank")}
        />
        <div className="px-2 py-1 text-xs text-muted-foreground bg-accent/30 flex justify-between">
          <span>{attachment.filename}</span>
          <span>{formatBytes(attachment.sizeBytes)}</span>
        </div>
      </div>
    );
  }

  // VIDEO — streaming player
  if (category === "video") {
    return (
      <div className={cn("rounded overflow-hidden border border-border", className)}>
        <video controls preload="metadata" className="max-w-full w-full">
          <source src={url} type={attachment.mimeType} />
          Your browser does not support video playback.
        </video>
        <div className="px-2 py-1 text-xs text-muted-foreground bg-accent/30 flex justify-between">
          <span>{attachment.filename}</span>
          <span>{formatBytes(attachment.sizeBytes)}</span>
        </div>
      </div>
    );
  }

  // PDF — modal button
  if (category === "pdf") {
    return (
      <div className={cn("border border-border rounded p-3 flex items-center gap-3", className)}>
        <FileText className="h-8 w-8 text-red-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{attachment.filename}</p>
          <p className="text-xs text-muted-foreground">{formatBytes(attachment.sizeBytes)}</p>
        </div>
        <button
          onClick={() => setShowPreview(true)}
          className="text-xs border border-border rounded px-2 py-1 hover:bg-accent transition-colors"
        >
          View PDF
        </button>
        <a href={url} download={attachment.filename} className="text-muted-foreground hover:text-foreground">
          <Download className="h-4 w-4" />
        </a>
        {showPreview && (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center" onClick={() => setShowPreview(false)}>
            <div className="w-[90vw] h-[90vh] bg-background rounded overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <iframe src={url} className="w-full h-full" title={attachment.filename} />
            </div>
          </div>
        )}
      </div>
    );
  }

  // OFFICE — LibreOffice HTML preview
  if (category === "office") {
    return (
      <div className={cn("border border-border rounded p-3 flex items-center gap-3", className)}>
        <Table className="h-8 w-8 text-green-600 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{attachment.filename}</p>
          <p className="text-xs text-muted-foreground">{formatBytes(attachment.sizeBytes)}</p>
        </div>
        {previewUrl && (
          <button
            onClick={() => setShowPreview(true)}
            className="text-xs border border-border rounded px-2 py-1 hover:bg-accent transition-colors"
          >
            View Document
          </button>
        )}
        <a href={url} download={attachment.filename} className="text-muted-foreground hover:text-foreground">
          <Download className="h-4 w-4" />
        </a>
        {showPreview && previewUrl && (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center" onClick={() => setShowPreview(false)}>
            <div className="w-[90vw] h-[90vh] bg-background rounded overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <iframe src={previewUrl} className="w-full h-full" title={attachment.filename} />
            </div>
          </div>
        )}
      </div>
    );
  }

  // FALLBACK — download card
  return (
    <div className={cn("border border-border rounded p-3 flex items-center gap-3", className)}>
      <Download className="h-8 w-8 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{attachment.filename}</p>
        <p className="text-xs text-muted-foreground">{formatBytes(attachment.sizeBytes)}</p>
      </div>
      <a href={url} download={attachment.filename} className="text-xs border border-border rounded px-2 py-1 hover:bg-accent transition-colors">
        Download
      </a>
    </div>
  );
}
```

**Step 3: Integrate into MarkdownBody**

In `MarkdownBody.tsx`, add attachment ID pattern detection inside the `Markdown` `components` prop. Add a custom paragraph renderer that intercepts `[[attachment:{id}]]` tokens:

```tsx
// In MarkdownBody.tsx — import AttachmentCard
import { AttachmentCard } from "./AttachmentCard.js";

// Add to Markdown components:
p: ({ children }) => {
  // Detect [[attachment:UUID]] in text nodes
  const text = typeof children === "string" ? children : "";
  const attachMatch = /^\[\[attachment:([0-9a-f-]{36})\]\]$/.exec(text.trim());
  if (attachMatch) {
    return <AttachmentCard attachmentId={attachMatch[1]} className="my-2" />;
  }
  return <p>{children}</p>;
},
```

**Step 4: Add drag-drop upload to CommentThread**

In `CommentThread.tsx`, extend the existing `handleAttachFile` to call the chunked upload API instead of `onAttachImage`:
```typescript
// Replace the hidden input accept attribute:
accept="*/*"
// Title changes from "Attach image" to "Attach file"
```

**Step 5: Build and verify**
```bash
pnpm --filter @sanadai/ui build
```
Expected: No TypeScript errors.

**Step 6: Commit**
```bash
git add ui/src/components/AttachmentCard.tsx ui/src/api/attachments.ts ui/src/components/MarkdownBody.tsx ui/src/components/CommentThread.tsx
git commit -m "feat(ui): AttachmentCard component with per-type preview (image/video/pdf/office/code)"
```

---

## Phase 5: Agent Vision

### Task 7: Inject attachments into agent run context

**Files:**
- Create: `server/src/services/attachment-context.ts`
- Modify: `server/src/services/run-context-builder.ts` (or equivalent run start file)

**Step 1: Write failing test**

```typescript
// server/src/__tests__/attachment-context.test.ts
import { describe, it, expect, vi } from "vitest";
vi.mock("@sanadai/db", () => ({ db: {}, attachments: {}, issueComments: {} }));
import { buildAttachmentContext } from "../services/attachment-context.js";

describe("buildAttachmentContext", () => {
  it("returns empty array when no attachments", async () => {
    const result = await buildAttachmentContext("issue-1");
    expect(result).toEqual([]);
  });
});
```

**Step 2: Implement attachment context builder**

```typescript
// server/src/services/attachment-context.ts
import { db, attachments } from "@sanadai/db";
import { eq } from "drizzle-orm";
import { storageService } from "../storage/service.js";

export interface AttachmentContextItem {
  type: "image_url" | "text" | "document";
  filename: string;
  mimeType: string;
  content: string;           // base64 for images, text for documents
}

export async function buildAttachmentContext(issueId: string): Promise<AttachmentContextItem[]> {
  const rows = await db.select().from(attachments)
    .where(eq(attachments.issueId, issueId));

  const ready = rows.filter(a => a.status === "ready" && a.uploaderType === "user");
  const items: AttachmentContextItem[] = [];

  for (const att of ready) {
    if (att.mimeType.startsWith("image/")) {
      const buffer = await storageService.getObject(att.storageKey);
      const base64 = buffer.toString("base64");
      items.push({ type: "image_url", filename: att.filename, mimeType: att.mimeType, content: base64 });
    } else if (att.htmlPreviewKey) {
      const buffer = await storageService.getObject(att.htmlPreviewKey);
      items.push({ type: "text", filename: att.filename, mimeType: att.mimeType, content: buffer.toString("utf-8").slice(0, 8000) });
    }
  }

  return items;
}
```

**Step 3: Update CAPABILITIES.md for agents**

Add to `/home/eslam/optiflow/.agents/_common/CAPABILITIES.md`:
```markdown
## Receiving File Attachments (Agent Vision)

When a human attaches a file to an issue:
- **Images**: you receive them as vision blocks — you can see and describe them
- **Documents (DOCX, PDF, XLSX)**: you receive extracted text — read and analyze
- **Videos**: you receive a key frame (1s) as an image + any timestamp notes

To attach a file you generated, use this syntax in your comment body:
\`\`\`
[[attach:/workspace/docs/reports/my-report.docx]]
[[attach:/workspace/output/demo.mp4 | title="Product Demo v2"]]
\`\`\`
The file will be uploaded, previewed in the UI, and downloadable by the board.
```

**Step 4: Commit**
```bash
git add server/src/services/attachment-context.ts server/src/__tests__/attachment-context.test.ts
git commit -m "feat(server): agent vision — inject human-attached files into run context"
```

---

## Phase 6: Publish Pipeline (YouTube + LinkedIn)

### Task 8: Video publish endpoint

**Files:**
- Create: `server/src/services/video-publisher.ts`
- Modify: `server/src/routes/attachments.ts` (add publish route)

**Step 1: Create video publisher**

```typescript
// server/src/services/video-publisher.ts
import { storageService } from "../storage/service.js";

export type PublishDestination = "youtube" | "linkedin";

export interface PublishResult {
  destination: PublishDestination;
  url: string;
}

export async function publishVideo(
  storageKey: string,
  filename: string,
  title: string,
  description: string,
  destinations: PublishDestination[],
): Promise<PublishResult[]> {
  const buffer = await storageService.getObject(storageKey);
  const results: PublishResult[] = [];

  for (const dest of destinations) {
    if (dest === "youtube") {
      const url = await publishToYouTube(buffer, filename, title, description);
      results.push({ destination: "youtube", url });
    }
    if (dest === "linkedin") {
      const url = await publishToLinkedIn(buffer, filename, title);
      results.push({ destination: "linkedin", url });
    }
  }

  return results;
}

async function publishToYouTube(buffer: Buffer, filename: string, title: string, description: string): Promise<string> {
  // YouTube Data API v3 resumable upload
  // Credentials: YOUTUBE_API_KEY from Infisical
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) throw new Error("YOUTUBE_API_KEY not configured");
  // Implementation: POST to https://www.googleapis.com/upload/youtube/v3/videos
  // Full implementation follows YouTube resumable upload protocol
  throw new Error("YouTube publish: not yet implemented — add OAuth2 flow");
}

async function publishToLinkedIn(buffer: Buffer, filename: string, title: string): Promise<string> {
  // LinkedIn Video API
  // Credentials: LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET from Infisical
  throw new Error("LinkedIn publish: not yet implemented — add OAuth2 flow");
}
```

**Step 2: Add publish route to attachments router**

```typescript
// In server/src/routes/attachments.ts — add:
attachmentsRouter.post("/:id/publish", requireAuth, requireCompanyAccess, async (req, res) => {
  const { destinations, title, description } = req.body;
  const [attachment] = await db.select().from(attachments)
    .where(eq(attachments.id, req.params.id)).limit(1);

  if (!attachment || attachment.companyId !== req.companyId) {
    return res.status(404).json({ error: "Not found" });
  }
  if (!attachment.mimeType.startsWith("video/")) {
    return res.status(400).json({ error: "Only video attachments can be published" });
  }

  const { publishVideo } = await import("../services/video-publisher.js");
  const results = await publishVideo(attachment.storageKey, attachment.filename, title, description, destinations);

  const publishUrl = results.map(r => r.url).join(", ");
  await db.update(attachments).set({ publishUrl }).where(eq(attachments.id, req.params.id));

  res.json({ results, publishUrl });
});
```

**Step 3: Add "Publish" button to AttachmentCard UI**

In `AttachmentCard.tsx`, for video category, add below the player:
```tsx
{attachment.status === "ready" && (
  <button
    onClick={() => handlePublish(attachmentId)}
    className="text-xs border border-border rounded px-2 py-1 hover:bg-accent transition-colors mt-2"
  >
    Publish to YouTube + LinkedIn
  </button>
)}
```

**Step 4: Commit**
```bash
git add server/src/services/video-publisher.ts server/src/routes/attachments.ts ui/src/components/AttachmentCard.tsx
git commit -m "feat: video publish pipeline to YouTube + LinkedIn (OAuth2 stubs ready for credentials)"
```

---

## Deployment

### Task 9: Deploy to 65.109.65.159

**Step 1: Create MinIO bucket**
```bash
ssh user@65.109.65.159
mc alias set minio http://localhost:9002 $MINIO_ACCESS_KEY $MINIO_SECRET_KEY
mc mb minio/paperclip-files
mc anonymous set download minio/paperclip-files  # presigned only — keep private
```

**Step 2: Build and deploy media-worker**
```bash
docker build -t paperclip-media-worker:latest ./docker/media-worker
docker compose up -d media-worker
curl http://localhost:8200/health   # expect: {"status":"ok"}
```

**Step 3: Run DB migration**
```bash
pnpm --filter @sanadai/db migrate
```

**Step 4: Set environment variables**
Add to `.env` on server:
```
MEDIA_WORKER_URL=http://media-worker:8200
PAPERCLIP_ALLOWED_ATTACHMENT_TYPES=image/*,video/*,application/pdf,application/vnd.openxmlformats-officedocument.*,text/*,application/json
PAPERCLIP_ATTACHMENT_MAX_BYTES=104857600
PAPERCLIP_VIDEO_MAX_BYTES=2147483648
```

**Step 5: Restart Sanad AI EOI server**
```bash
docker compose restart server
```

**Step 6: Smoke test**
```bash
# Upload a test PDF via API
curl -X POST http://localhost:3000/api/attachments/init \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"filename":"test.pdf","mimeType":"application/pdf","sizeBytes":1024,"issueId":"ISSUE_ID"}'
# Expect: {"attachmentId":"...","uploadId":"..."}
```

---

## Summary

| Phase | Tasks | Effort |
|-------|-------|--------|
| 1 — DB + Upload API | Tasks 1-3 | 3 days |
| 2 — Agent syntax | Task 4 | 1 day |
| 3 — media-worker | Task 5 | 2 days |
| 4 — UI preview | Task 6 | 3 days |
| 5 — Agent vision | Task 7 | 2 days |
| 6 — Publish pipeline | Tasks 8-9 | 2 days |
| **Total** | | **~13 days** |

Marketing agent video workflow unblocked after **Phase 4** (Task 6).

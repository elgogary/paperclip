---
name: outline-publish
description: Publish markdown wiki pages to Outline (getoutline.com) via API. Creates collections, documents, and nested hierarchies. Supports full wiki upload or single page updates.
argument-hint: "action source_path"
---

## Input
Target: $ARGUMENTS

Scope examples:
- "publish docs/user-guide/ to Outline"
- "sync single page docs/user-guide/02-bidding/create-a-bid.md"
- "create Outline collection Bidding with all pages from 02-bidding/"
- "update existing Outline doc for create-a-bid"
- "list all collections in Outline"

Optional controls:
- **action**: `publish-all` | `publish-folder` | `publish-page` | `update-page` | `list` (default: inferred)
- **source**: path to markdown file or folder
- **collection**: Outline collection name to publish into (auto-created if missing)

---

## Preconditions

### Required: Outline API credentials
Check `.env` in the project root for:
```
OUTLINE_API_URL=https://your-instance.getoutline.com/api
OUTLINE_API_KEY=ol_api_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

If missing, ask the user:
1. "What is your Outline instance URL?" (cloud: `https://app.getoutline.com`, self-hosted: custom domain)
2. "What is your API key?" (Settings > API > Create key — starts with `ol_api_`)

Save to `.env` and never commit or display the key.

---

## Outline API Reference

### Authentication
All requests use Bearer token:
```
Authorization: Bearer ol_api_xxxxx
Content-Type: application/json
```

### Base URL
`{OUTLINE_API_URL}` — all endpoints are POST.

### Key Endpoints

#### Collections (top-level containers)
```bash
# List all collections
curl -X POST {URL}/collections.list \
  -H "Authorization: Bearer {KEY}" \
  -H "Content-Type: application/json" \
  -d '{}'

# Create collection
curl -X POST {URL}/collections.create \
  -H "Authorization: Bearer {KEY}" \
  -H "Content-Type: application/json" \
  -d '{"name": "Bidding", "description": "User guide for the Bidding module"}'

# Response: {"data": {"id": "uuid", "name": "Bidding", ...}}
```

#### Documents
```bash
# Create document in a collection
curl -X POST {URL}/documents.create \
  -H "Authorization: Bearer {KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Create a Bid",
    "text": "# Create a Bid\n\nMarkdown content here...",
    "collectionId": "collection-uuid",
    "publish": true
  }'

# Create nested document (child of another document)
curl -X POST {URL}/documents.create \
  -d '{
    "title": "Child Page",
    "text": "Content...",
    "collectionId": "collection-uuid",
    "parentDocumentId": "parent-doc-uuid",
    "publish": true
  }'

# Update existing document
curl -X POST {URL}/documents.update \
  -d '{
    "id": "doc-uuid",
    "title": "Updated Title",
    "text": "Updated markdown content..."
  }'

# Search documents
curl -X POST {URL}/documents.search \
  -d '{"query": "Create a Bid"}'

# List documents in a collection
curl -X POST {URL}/documents.list \
  -d '{"collectionId": "collection-uuid"}'
```

---

## Execution Pipeline

### Action: `publish-all` (full wiki upload)

1. **Read `.env`** for API credentials
2. **Scan source folder** — map folder structure to collections + documents
3. **Mapping rules**:
   - Each top-level subfolder → 1 Outline Collection
   - `README.md` in a folder → Collection description (not a separate doc)
   - Each `.md` file → 1 Outline Document
   - Subfolders within a collection folder → Nested documents (parentDocumentId)
4. **Create collections** — one API call per collection, store returned UUIDs
5. **Create documents** — in order (parents first, then children for nesting)
6. **Log results** — print created collection/document names with Outline URLs
7. **Save ID mapping** to `.outline-ids.json` in source folder for future syncs

### Action: `publish-folder` (single collection)

1. Find or create the target collection
2. Upload all `.md` files in the folder as documents
3. Respect subfolder nesting via parentDocumentId

### Action: `publish-page` (single document)

1. Find the target collection (from folder name or user-specified)
2. Create the document from the `.md` file
3. If parent folder has an ID mapping, set parentDocumentId

### Action: `update-page` (sync existing)

1. Look up document ID from `.outline-ids.json` or search by title
2. Read the local `.md` file
3. Call `documents.update` with new content

### Action: `list` (read-only)

1. Call `collections.list` and display all collections
2. Optionally call `documents.list` for a specific collection

---

## Folder-to-Collection Mapping

Given this local structure:
```
docs/user-guide/
  README.md              → Master index (not uploaded as doc)
  01-getting-started/    → Collection: "Getting Started"
    welcome.md           → Doc: "Welcome"
    key-concepts.md      → Doc: "Key Concepts"
  02-bidding/            → Collection: "Bidding"
    overview.md          → Doc: "Overview" (first in sort order)
    create-a-bid.md      → Doc: "Create a Bid"
    build-your-estimate.md → Doc: "Build Your Estimate"
  03-contracts/          → Collection: "Contracts"
    ...
  10-end-to-end/         → Collection: "End-to-End Workflows"
    ...
```

### Naming Rules
- Collection name: strip number prefix, title-case the folder name
  - `02-bidding` → "Bidding"
  - `01-getting-started` → "Getting Started"
  - `10-end-to-end` → "End-to-End Workflows"
- Document title: use the `# H1` from the markdown file, or title-case the filename
- Sort order: files are uploaded in alphabetical order (overview.md first by convention)

---

## ID Mapping File (`.outline-ids.json`)

After publishing, save a mapping for future syncs:
```json
{
  "collections": {
    "01-getting-started": "uuid-1",
    "02-bidding": "uuid-2"
  },
  "documents": {
    "01-getting-started/welcome.md": "uuid-3",
    "01-getting-started/key-concepts.md": "uuid-4",
    "02-bidding/overview.md": "uuid-5",
    "02-bidding/create-a-bid.md": "uuid-6"
  },
  "last_sync": "2026-03-15T12:00:00Z"
}
```

---

## Error Handling

| Error | Cause | Fix |
|---|---|---|
| 401 Unauthorized | Bad API key | Re-check `.env` OUTLINE_API_KEY |
| 403 Forbidden | Key lacks permission | User must create key with admin access |
| 404 Not Found | Wrong base URL | Verify OUTLINE_API_URL includes `/api` |
| 400 Validation | Missing required field | Ensure `title` is always set |
| Collection exists | Name conflict | Search first, reuse existing collection ID |
| Document exists | Title conflict in collection | Search first, update instead of create |

---

## Implementation Notes

- Use `curl` via Bash tool for API calls (no external Python deps needed)
- Process collections sequentially (need UUIDs for documents)
- Process documents within a collection sequentially (need parent UUIDs for nesting)
- Strip `<!-- SCREENSHOT: ... -->` HTML comments from markdown before uploading
- Convert relative markdown links `[text](../other-file.md)` to Outline internal links where possible
- Rate limit: Outline has no documented rate limit, but add 200ms delay between calls to be safe

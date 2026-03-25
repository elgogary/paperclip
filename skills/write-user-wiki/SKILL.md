---
name: write-user-wiki
description: Write professional user-guide wiki pages for any ERPNext/Frappe app. Task-oriented, plain language, organized by what users DO — not by code structure. Outputs markdown ready for Outline, GitBook, or docs/ folder.
argument-hint: "module_or_topic audience output_path"
---

## Input
Target: $ARGUMENTS

Scope examples:
- "write user guide for Bidding module"
- "write onboarding guide for Project Managers"
- "write full wiki for AccuBuild"
- "write guide: how to create a bid and submit it"
- "rewrite docs/wiki/03-module-guides/bidding.md as user guide"

Optional controls:
- **audience**: `all` | `estimator` | `project-manager` | `finance` | `admin` (default: all)
- **scope**: `full-app` | `module` | `single-page` | `workflow` (default: inferred)
- **output**: path to write files (default: `docs/user-guide/`)
- **source**: existing developer wiki to convert (reads and rewrites)

---

## Preconditions

1. **Read the app's CLAUDE.md** — understand modules, DocTypes, architecture
2. **Read existing developer wiki** if present — extract domain knowledge but discard code-level detail
3. **Identify the audience** — who will read this? What role? What do they need to DO?
4. **Never write code-level content** — no controller paths, no Python imports, no fieldname tables

---

## Core Philosophy: User Guides vs Developer Docs

| Developer Wiki (what we have) | User Guide Wiki (what we write) |
|---|---|
| Organized by DocType/module code | Organized by user tasks and workflows |
| "Bid Estimation uses NestedSet pattern" | "How to build your cost estimate step by step" |
| Lists 38 DocTypes with roles | Shows 5-7 key workflows with screenshots |
| References `bid.py (3105 lines)` | Says "Click **Save** to keep your changes" |
| Written for developers | Written for the person clicking buttons |
| Fieldname tables (`work_division`, `lft`) | Plain-language field explanations |
| Architecture diagrams | Workflow flowcharts (user perspective) |

---

## Wiki Structure: Three-Layer Model

### Layer 1: Getting Started (1 collection, 3-5 pages)

| Page | Content |
|---|---|
| Welcome | What the system does, who it's for, one-paragraph value prop |
| Navigating the System | How to log in, sidebar, search, workspace, switch modules |
| Key Concepts | Glossary of terms the user must know (Bid, WBS, RFP, Change Order, etc.) — plain definitions, no code |
| Your Role | Role-based quick card: "As an Estimator, you mainly use: Bids, Estimation Grid, Templates" |
| Quick Reference | Cheat sheet: most common actions with 1-line instructions |

### Layer 2: Module Guides (1 collection per module)

Each module follows this EXACT internal structure:

```
[Module Name]/
  1. Overview          — What this module does, when you use it, how it connects
  2. Getting Set Up    — One-time setup steps (if any)
  3. [Workflow 1]      — Step-by-step for the primary daily task
  4. [Workflow 2]      — Step-by-step for the second most common task
  5. [Workflow 3-N]    — Additional workflows as needed
  6. Tips & Shortcuts  — Power-user tips, keyboard shortcuts, bulk actions
  7. Common Questions   — FAQ format: question → answer (only real questions)
  8. Troubleshooting   — Problem → Cause → Solution pattern
```

### Layer 3: End-to-End Flows (1 collection, 1-2 pages per business process)

Cross-module flows that trace a full business process:
- "From RFP to Bid Submission"
- "From Won Bid to Construction Contract"
- "Tracking Costs: Purchase Order to Budget Report"
- "Change Order: Request to Approved Variation"

These are the highest-value pages — they show how modules connect.

---

## Writing Rules (MANDATORY)

### Voice & Tone
- **Second person**: "You can", "Click", "Open" — never "The user should"
- **Active voice**: "Click **Save**" not "The Save button should be clicked"
- **Present tense**: "This creates a new bid" not "This will create a new bid"
- **Plain language**: No jargon without definition. "Cost tree" not "NestedSet hierarchy"
- **Confident**: "Click **Submit**" not "You might want to click Submit"
- **Short sentences**: One idea per sentence. If you need "and", split it.

### Titles & Headings
- **Task pages**: Start with a verb — "Create a Bid", "Add Items to Your Estimate", "Submit for Review"
- **Concept pages**: Use the noun — "Key Concepts", "Understanding Cost Rollups"
- **Never use the DocType name raw** — "Create a Bid" not "Creating a Bid DocType Record"
- **Avoid generic titles** — "How to Add a Vendor" not "Vendor Management"

### Page Structure (Task Pages)

Every task page follows this template:

```markdown
# [Action Verb] + [Object]

[One sentence: what this does and why you'd do it.]

**Before you start**: [Prerequisites — what must exist first. Omit if none.]

## Steps

1. Go to **[Module Name]** from the sidebar.
2. Click **New [Document]**.
3. Fill in **[Field Name]** — [plain explanation of what to enter].
4. Fill in **[Field Name]** — [explanation].
5. Click **Save**.

> **Tip**: [Optional helpful shortcut or note. Max 1-2 per page.]

## What happens next

[One sentence: what the system does after save, or what the user should do next.]

**Related**: [Link to related guide], [Link to related guide]
```

### Page Structure (Concept Pages)

```markdown
# [Concept Name]

[2-3 sentences: what this is and why it matters to your work.]

## How it works

[3-5 sentences: plain-language explanation. Use an analogy if it helps.]

## Key terms

| Term | What it means |
|---|---|
| [Term] | [Plain definition — no code references] |

## Where you'll see this

[1-2 sentences: which screens/workflows this concept appears in, with links.]
```

### Page Structure (Troubleshooting Pages)

```markdown
# Troubleshooting: [Module Name]

## [Symptom described as the user would say it]

**What you see**: [Exact error message or behavior]
**Why this happens**: [Plain cause — no stack traces]
**How to fix it**:
1. [Step 1]
2. [Step 2]
```

### Formatting Rules
- **Bold** for all UI elements: button names, field labels, tab names, menu items
- Use `>` blockquotes for tips, notes, warnings — limit 1-2 per page
- Prefix with **Tip:**, **Note:**, **Important:**, or **Warning:**
- Never use callouts back-to-back
- Numbered lists for sequential steps (1, 2, 3)
- Bullet lists for non-sequential items
- Tables only for genuinely tabular data (field definitions, comparison matrices)
- Keep pages to ~1 scroll length. If it needs a table of contents, split it.
- **Screenshot placeholders**: Use `![Description](screenshot-placeholder.png)` with a comment `<!-- SCREENSHOT: describe exactly what to capture -->`

### Cross-Linking Rules
- Every page must have a "Related" section at the bottom with 2-4 links
- End-to-end flow pages link to every module page they reference
- Module overview pages link to all workflow pages within the module
- Never leave a dead-end page (no outgoing links)

### What to NEVER Include
- File paths, class names, or function names
- Database field names (use the label the user sees)
- Python/JS code snippets
- API endpoints or curl commands
- Architecture diagrams with technical components
- "For developers" sections
- Version numbers or changelog entries
- Internal team references

---

## Execution Pipeline

### Step 1: Audit Source Material
- Read CLAUDE.md and existing developer wiki
- List all modules with their user-facing purpose (not code purpose)
- Identify the top 3-5 workflows per module that users actually DO daily
- Map cross-module flows

### Step 2: Plan the Wiki Structure
- Create the full table of contents following the Three-Layer Model
- Present the TOC to the user for approval before writing
- Ask: "Is there any workflow or feature I'm missing? Any module users don't touch?"

### Step 3: Write Layer 1 (Getting Started)
- Welcome page, navigation guide, key concepts glossary, role cards
- These set the foundation — write them first

### Step 4: Write Layer 2 (Module Guides)
- One module at a time, following the internal structure template
- For each module: overview → setup → workflows → tips → FAQ → troubleshooting
- Include screenshot placeholders with exact descriptions

### Step 5: Write Layer 3 (End-to-End Flows)
- Cross-module workflows that trace a full business process
- These are written last because they reference module pages

### Step 6: Review & Cross-Link
- Verify every page has Related links
- Verify no dead-end pages
- Verify consistent terminology (same term used everywhere for the same concept)
- Verify all titles follow the verb+object pattern for task pages

---

## Output Format

### File Structure
```
docs/user-guide/
  README.md                          # Master index with full TOC
  01-getting-started/
    welcome.md
    navigating-the-system.md
    key-concepts.md
    your-role.md
    quick-reference.md
  02-bidding/
    overview.md
    create-a-bid.md
    build-your-estimate.md
    use-templates.md
    submit-a-bid.md
    tips-and-shortcuts.md
    common-questions.md
    troubleshooting.md
  03-contracts/
    overview.md
    ...
  04-wbs-budgets/
    ...
  05-payments/
    ...
  06-site-operations/
    ...
  07-document-management/
    ...
  10-end-to-end/
    rfp-to-submission.md
    bid-to-contract.md
    tracking-costs.md
    change-orders.md
```

### Naming Conventions
- Folders: `NN-module-name` (numbered for sort order)
- Files: `verb-object.md` for task pages, `noun.md` for concept pages
- All lowercase, hyphens for spaces
- No abbreviations in filenames unless universally known (FAQ, WBS)

---

## Quality Checklist (run before delivering)

- [ ] Every task page starts with a verb
- [ ] Every page has a one-sentence intro explaining what and why
- [ ] No code, file paths, or technical references anywhere
- [ ] All UI elements in **bold**
- [ ] All steps are numbered with one action per step
- [ ] Screenshot placeholders describe exactly what to capture
- [ ] Related links at the bottom of every page
- [ ] Consistent terminology throughout (same term = same meaning everywhere)
- [ ] Pages fit in ~1 scroll (split if longer)
- [ ] Callouts used sparingly (max 2 per page)
- [ ] No passive voice in steps ("Click Save" not "Save should be clicked")
- [ ] No DocType names used raw — always the user-friendly version

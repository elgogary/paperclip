---
title: Skills & Evolution
summary: Create, manage, and evolve agent skills — reusable instruction templates with AI-powered creation and version tracking
---

The Skills page (`/skills`) is where you manage reusable instruction sets for your agents. Skills give agents domain expertise that transfers across tasks.

## What is a Skill?

A skill is a named, versioned instruction template that an agent loads during a run. Think of it as a playbook: "when doing X, follow these steps."

Examples:
- `code-review` — checklist for reviewing code quality, security, and logic
- `add-api-method` — steps for adding a new Frappe whitelisted method
- `bug-fix` — systematic debugging flow (investigate → diagnose → fix → verify)
- `write-user-wiki` — template for writing end-user documentation

## Creating a Skill

### Manual Create

1. Click **+ New Skill**
2. Fill in: name, description, category, trigger hint
3. Write the skill instructions in the markdown editor
4. Set agent access (which agents can use this skill)
5. Click **Save**

### AI-Assisted Create

1. Click **AI Create** (sparkle icon)
2. Describe what you want: _"A skill for reviewing Frappe Python controllers for security issues"_
3. The AI generates the skill instructions
4. Review, edit, and save

## Managing Skills

| Action | How |
|--------|-----|
| Edit | Click skill name → edit instructions |
| Version | Each save creates a new version |
| View history | Click **Versions** on a skill card |
| Duplicate | Use the ··· menu → Duplicate |
| Delete | Use the ··· menu → Delete |
| Test | Click **Test** to run the skill prompt in a sandbox |

## Agent Access

Skills support per-agent access control:
- By default a new skill has no agent access
- Click agent chips in the skill detail panel to grant/revoke
- Green chip = agent can load this skill
- Changes take effect on the next agent run

## Evolution Timeline

The **Evolution** tab shows the learning history of your skills.

When an agent completes a task that used a skill, it can report back what worked and what didn't. The evolution engine:

1. Collects agent feedback across runs
2. Identifies patterns (what instructions were followed, what was ignored)
3. Proposes skill improvements in the **Pending Reviews** queue

### Reviewing Pending Evolutions

1. Go to Skills → Evolution tab
2. See proposed changes: original text vs. suggested improvement
3. Click **Apply** to merge the change into the skill
4. Click **Dismiss** to reject it
5. Click **View Run** to see the context that triggered the suggestion

### Skill Metrics

Each skill card shows:
- **Usage count** — how many times this skill was invoked
- **Success rate** — % of runs where the agent marked the skill as helpful
- **Last used** — when it was last loaded by an agent
- **Evolution score** — how much the skill has improved over time

## Categories

Organize skills by category to find them faster:

| Category | Use for |
|----------|---------|
| Coding | Code generation, review, debugging, refactoring |
| Research | Web research, competitor analysis, data gathering |
| Communication | Emails, memos, announcements, reports |
| Data | ETL, transformation, analysis |
| Documentation | Wikis, API docs, user guides |
| Custom | Domain-specific workflows |

## Skill Library

Browse pre-built templates from the skill library:

1. Click **Browse Library**
2. Filter by category
3. Click **Add** on a template to copy it into your skills
4. Customize for your use case

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/companies/:id/skills` | List all skills |
| `POST` | `/api/companies/:id/skills` | Create skill |
| `GET` | `/api/companies/:id/skills/:skillId` | Get skill detail |
| `PATCH` | `/api/companies/:id/skills/:skillId` | Update skill |
| `DELETE` | `/api/companies/:id/skills/:skillId` | Delete skill |
| `GET` | `/api/companies/:id/skills/:skillId/access` | Get agent access |
| `PUT` | `/api/companies/:id/skills/:skillId/access` | Update agent access |
| `GET` | `/api/companies/:id/skills/:skillId/versions` | List versions |
| `GET` | `/api/companies/:id/skills/:skillId/audit` | View audit log |

See also the full [Scheduled Jobs API](/api/scheduled-jobs) for automating skill sync.

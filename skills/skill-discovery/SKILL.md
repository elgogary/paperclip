---
name: skill-discovery
description: >
  Search the company skill registry for relevant skills before starting any task.
  Use at the BEGINNING of every heartbeat to find reusable patterns, proven
  instructions, and past solutions that match your current assignment. This
  reduces token usage and improves task quality by building on what worked before.
---

# Skill Discovery

Before doing any work, check if your company has relevant skills for this task. Skills are reusable instruction sets created from past successful work — using them saves tokens and improves quality.

## When to Search

Search for skills at the **start of every heartbeat**, right after reading your assignment (Step 4 in the Heartbeat Procedure). Do NOT skip this step even if you think you know what to do.

## How to Search

Call the Paperclip API to find relevant skills:

```
GET /api/companies/{companyId}/skills?search={task_keywords}
```

Use 2-4 keywords from your task description. Examples:
- Task: "Fix the login form validation" → search: "form validation fix"
- Task: "Create API endpoint for invoices" → search: "api endpoint create"
- Task: "Review PR #123" → search: "code review pull request"

## How to Use Retrieved Skills

1. Read the skill's `instructions` field — it contains the full playbook
2. Follow the instructions as your primary approach
3. Adapt as needed for your specific context — the skill is a starting point, not a rigid script
4. If the skill's approach doesn't fit, fall back to your own reasoning

## What to Do If No Skills Match

If the search returns no relevant skills, proceed with your own approach. Your work may be captured as a new skill after completion — this is how the library grows.

## Important

- Skills are company-specific — you only see your company's skills
- Skills have versions — you automatically get the version that works best for your role
- Don't spend more than 30 seconds on skill search — if nothing matches, move on
- You don't need to mention skill discovery in your task output unless a skill was particularly helpful

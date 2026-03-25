---
name: skill-feedback
description: >
  Leave lightweight feedback about skill usage at the END of every heartbeat.
  This feeds the skill evolution engine — your feedback helps skills improve
  automatically. Takes ~50 tokens. Do NOT skip this step.
---

# Skill Feedback

At the **end of every heartbeat**, before exiting, leave a feedback block about the skills you used (or didn't use). This is how the evolution engine learns.

## When to Leave Feedback

After completing your task work and before your final output, add a `SKILL_FEEDBACK` block. This is mandatory for every heartbeat, even if no skills were used.

## Format

Add this block at the very end of your response:

```
SKILL_FEEDBACK:
- skill: {skill_slug} | version: {v} | used: yes/no | helpful: yes/no/partial
- skill: {skill_slug} | version: {v} | used: yes/no | helpful: yes/no/partial
- novel_pattern: "{brief description}" | tools: [{tool1}, {tool2}]
- no_skills_used: true/false
```

## Examples

### Skills were used and helped:
```
SKILL_FEEDBACK:
- skill: code-review | version: 4 | used: yes | helpful: yes
- skill: git-branch-check | version: 1 | used: yes | helpful: partial
- no_skills_used: false
```

### Skills were retrieved but not useful:
```
SKILL_FEEDBACK:
- skill: api-endpoint-create | version: 2 | used: no | helpful: no
- no_skills_used: true
```

### No skills found, but you did something reusable:
```
SKILL_FEEDBACK:
- no_skills_used: true
- novel_pattern: "retry API calls with exponential backoff on 429 errors" | tools: [github.create_pull_request]
```

### Simple task, nothing noteworthy:
```
SKILL_FEEDBACK:
- no_skills_used: true
```

## Field Guide

| Field | Values | Required |
|-------|--------|----------|
| `skill` | The skill slug (e.g., `code-review`) | If skills were retrieved |
| `version` | The version number you received | If skill used |
| `used` | `yes` / `no` — did you follow the skill's instructions? | Yes |
| `helpful` | `yes` / `no` / `partial` — did it improve your work? | If used |
| `novel_pattern` | Brief description of a new reusable pattern you invented | Optional |
| `tools` | MCP tools involved in the novel pattern | If novel_pattern given |
| `no_skills_used` | `true` / `false` | Yes |

## Rules

- Keep it brief — this should take ~50 tokens, not 500
- Be honest — saying a skill wasn't helpful is valuable feedback (triggers improvement)
- `novel_pattern` is how NEW skills get born — describe patterns worth reusing
- Don't fabricate feedback — only report what actually happened
- This block is machine-parsed by the evolution engine — follow the format exactly

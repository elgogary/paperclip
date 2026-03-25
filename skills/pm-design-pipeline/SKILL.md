---
name: pm-design-pipeline
description: Product Manager design pipeline — one command to run market research, UI audit, recommendations, Stitch screen generation, and design system extraction. Produces a complete deliverables package.
argument-hint: "product name and description, e.g. 'AccuBuild construction bid management'"
user-invokable: true
allowed-tools: Bash, Read, Write, Edit, AskUserQuestion, WebSearch, WebFetch, Agent, Skill, TodoWrite, Glob, Grep
---

# PM Design Pipeline

Run one command → answer 6 questions → get a full PM design package: market report, UI audit, recommendations, generated UI screens, and design system.

## PHASE 0: INTAKE

### Step 1: Parse Arguments

If the user provided inline arguments, extract `PRODUCT` from them.
Otherwise, proceed to questions.

### Step 2: Ask Intake Questions

Use `AskUserQuestion` to gather all mission-critical info before burning tokens.

**Question 1 — Product** (skip if parsed from arguments):
```
What product/project are we designing for?
Give a name and one-line description.
Example: "AccuBuild — construction bid management and project tracking platform"
```
Store as: `PRODUCT`

**Question 2 — Audience**:
```
Who is the target user?
Options:
- Construction professionals (estimators, PMs, QS)
- SaaS end users (general)
- Enterprise buyers (IT, procurement)
- Other (specify)
```
Store as: `AUDIENCE`

**Question 3 — Competitors**:
```
Name 2-5 competitors or similar products.
Example: "Procore, Buildertrend, PlanGrid, Sage 300"
If unknown, say "research for me"
```
Store as: `COMPETITORS`

**Question 4 — Focus Areas**:
```
What screens or areas should we focus on?
Options:
- Full audit (all screens)
- Specific screens (list them)
- Marketing site / landing page
- Dashboard + key workflows
```
Store as: `SCREENS`

**Question 5 — Design Style**:
```
Design style preference?
Options:
- Professional & clean (blue/white, Inter font)
- Dark & modern (dark sidebar, accent colors)
- Warm & approachable (rounded, friendly)
- Match existing brand (provide colors/font)
```
Store as: `STYLE`

If user selects "Match existing brand", ask for:
- Primary color hex (e.g., #046BD2)
- Font preference (e.g., Inter)
- Light or dark mode

**Question 6 — Execution Mode**:
```
How should the pipeline run?
Options:
- Auto — runs everything end-to-end, no pauses
- Checkpoints — pauses after research, audit, and screens to review
- Step-by-step — pauses after every phase for your approval
```
Store as: `MODE`

### Step 3: Confirm Mission

Display all parsed variables:
```
=== PM DESIGN PIPELINE ===
Product:      {PRODUCT}
Audience:     {AUDIENCE}
Competitors:  {COMPETITORS}
Focus:        {SCREENS}
Style:        {STYLE}
Mode:         {MODE}

Output folder: docs/plans/YYYY-MM-DD-pm-pipeline/
Estimated phases: 6
==============================
Starting Phase 1...
```

### Step 4: Create Output Folder

```bash
mkdir -p docs/plans/$(date +%Y-%m-%d)-pm-pipeline/screens
```

### Step 5: Write Brief

Write `00-brief.md` to the output folder with all intake answers.

---

## PHASE 1: MARKET RESEARCH

### Execute
Invoke the `market-research` skill:
```
Skill: market-research
Args: "{PRODUCT}. Competitors: {COMPETITORS}. Target audience: {AUDIENCE}. --quick"
```

### Capture Output
After the skill completes, the market research report will be in the conversation.
Save key findings to `01-market-research.md` in the output folder.

Extract and store these variables for later phases:
- `MARKET_GAPS` — top 3-5 gaps/opportunities found
- `COMPETITOR_STRENGTHS` — what competitors do well
- `POSITIONING` — how to differentiate

### Checkpoint
If `MODE` = checkpoints or step-by-step:
```
AskUserQuestion: "Phase 1 complete — market research done.
Key findings: {summary}
Continue to Phase 2 (UI Audit)?"
```

---

## PHASE 2: UI AUDIT

### Execute
Invoke the `ui-ux-ba` skill:
```
Skill: ui-ux-ba
Args: "{SCREENS} — audit against competitor patterns from Phase 1. Competitors: {COMPETITORS}. Market gaps: {MARKET_GAPS}"
```

### Capture Output
Save the UI audit to `02-ui-audit.md`.

Extract:
- `UI_ISSUES` — top 5-10 UI/UX issues found
- `QUICK_WINS` — changes that are easy + high impact
- `MAJOR_GAPS` — significant missing features or UX problems

### Checkpoint
If `MODE` = checkpoints or step-by-step:
```
AskUserQuestion: "Phase 2 complete — UI audit done.
Issues found: {count}. Quick wins: {count}.
Continue to Phase 3 (Recommendations)?"
```

---

## PHASE 3: RECOMMENDATIONS

### Execute
Invoke the `recommend-improvements` skill:
```
Skill: recommend-improvements
Args: "Based on market research (gaps: {MARKET_GAPS}) and UI audit (issues: {UI_ISSUES}), provide prioritized recommendations for {PRODUCT}. Focus areas: {SCREENS}"
```

### Capture Output
Save to `03-recommendations.md`.

Extract:
- `TOP_RECOMMENDATIONS` — top 3-5 prioritized improvements (these become Stitch prompts)

### Checkpoint
If `MODE` = checkpoints or step-by-step:
```
AskUserQuestion: "Phase 3 complete — {count} recommendations prioritized.
Top 3:
1. {rec1}
2. {rec2}
3. {rec3}
Continue to Phase 4 (Prompt Generation)?"
```

---

## PHASE 4: PROMPT GENERATION

### Execute
For each recommendation in `TOP_RECOMMENDATIONS`, invoke:
```
Skill: enhance-prompt
Args: "Create a Stitch-optimized prompt for: {recommendation}. Style: {STYLE}. Product: {PRODUCT}. Audience: {AUDIENCE}."
```

### Capture Output
Save all enhanced prompts to `04-stitch-prompts.md`.

Store as: `STITCH_PROMPTS[]` — array of enhanced prompts

### Checkpoint
If `MODE` = step-by-step:
```
AskUserQuestion: "Phase 4 complete — {count} Stitch prompts generated.
Continue to Phase 5 (Screen Generation)?"
```

---

## PHASE 5: SCREEN GENERATION

### Step 1: Get or Create Stitch Project

Check if a Stitch project exists for this product:
```bash
curl -s -X POST "https://stitch.googleapis.com/mcp" \
  -H "Content-Type: application/json" \
  -H "X-Goog-Api-Key: $STITCH_API_KEY" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"list_projects","arguments":{}}}'
```

If no matching project, create one:
```bash
curl -s -X POST "https://stitch.googleapis.com/mcp" \
  -H "Content-Type: application/json" \
  -H "X-Goog-Api-Key: $STITCH_API_KEY" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"create_project","arguments":{"title":"{PRODUCT}"}}}'
```

Extract `PROJECT_ID` from the response.

### Step 2: Generate Screens

For each prompt in `STITCH_PROMPTS[]`:
```bash
curl -s -X POST "https://stitch.googleapis.com/mcp" \
  -H "Content-Type: application/json" \
  -H "X-Goog-Api-Key: $STITCH_API_KEY" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"generate_screen_from_text","arguments":{"projectId":"{PROJECT_ID}","prompt":"{enhanced_prompt}"}}}' \
  -o "docs/plans/YYYY-MM-DD-pm-pipeline/screens/screen-{n}-result.json"
```

### Step 3: Download Assets

For each generated screen, parse the JSON response to extract:
- `screenshot.downloadUrl` → download as `screen-{n}-{title}.png`
- `htmlCode.downloadUrl` → download as `screen-{n}-{title}.html`

Use Python to parse:
```bash
python -c "
import json, urllib.request
with open('screen-{n}-result.json') as f:
    data = json.load(f)
sc = data['result']['structuredContent']
screen = sc['outputComponents'][1]['design']['screens'][0]
urllib.request.urlretrieve(screen['screenshot']['downloadUrl'], 'screen-{n}-{title}.png')
urllib.request.urlretrieve(screen['htmlCode']['downloadUrl'], 'screen-{n}-{title}.html')
"
```

### Checkpoint
If `MODE` = checkpoints or step-by-step:
```
AskUserQuestion: "Phase 5 complete — {count} screens generated.
View them in: docs/plans/YYYY-MM-DD-pm-pipeline/screens/
Continue to Phase 6 (Design System)?"
```

---

## PHASE 6: DESIGN SYSTEM

### Extract DESIGN.md

From the Stitch API response (Phase 5), extract the `designMd` field:
```bash
python -c "
import json
with open('screen-1-result.json') as f:
    data = json.load(f)
sc = data['result']['structuredContent']
ds = sc['outputComponents'][0]['designSystem']['designSystem']['theme']['designMd']
with open('05-DESIGN.md', 'w') as out:
    out.write(ds)
"
```

Also extract key color tokens and font settings into a structured section at the top.

---

## PHASE 7: SUMMARY

### Generate SUMMARY.md

Write a `SUMMARY.md` that ties everything together:

```markdown
# PM Design Pipeline — {PRODUCT}
**Date:** YYYY-MM-DD
**Mode:** {MODE}

## Mission
{PRODUCT} — {one-liner from brief}

## Key Findings

### Market Research
- {top 3 market gaps}

### UI Audit
- {top 3 UI issues}

### Top Recommendations
1. {rec1}
2. {rec2}
3. {rec3}

## Generated Screens
| # | Screen | HTML | Screenshot |
|---|--------|------|------------|
| 1 | {title} | [HTML](screens/screen-1.html) | [PNG](screens/screen-1.png) |
| 2 | {title} | [HTML](screens/screen-2.html) | [PNG](screens/screen-2.png) |

## Design System
See [05-DESIGN.md](05-DESIGN.md)

## Deliverables
- [00-brief.md](00-brief.md) — Mission brief
- [01-market-research.md](01-market-research.md) — Market analysis
- [02-ui-audit.md](02-ui-audit.md) — UI/UX audit
- [03-recommendations.md](03-recommendations.md) — Prioritized improvements
- [04-stitch-prompts.md](04-stitch-prompts.md) — Enhanced prompts
- [05-DESIGN.md](05-DESIGN.md) — Design system
- [screens/](screens/) — Generated UI screens
```

### Final Message
```
=== PM DESIGN PIPELINE COMPLETE ===
All deliverables saved to: docs/plans/YYYY-MM-DD-pm-pipeline/

Screens generated: {count}
Open in browser: start docs/plans/YYYY-MM-DD-pm-pipeline/screens/screen-1-*.html

Next steps:
- Review screens and DESIGN.md
- Use /implement-prototype to convert screens to real code
- Use /create-prototype to refine specific components
=======================================
```

---

## ERROR HANDLING

- If a sub-skill fails, log the error and continue to the next phase
- If Stitch API fails, check API key is set: `source .env && echo $STITCH_API_KEY`
- If no competitors provided, run market research in discovery mode
- If no screens specified, default to "full audit"
- Always save partial results — never lose completed phases due to later failures

## STITCH API KEY

The API key is stored in the project `.env` file as `STITCH_API_KEY`.
Load it before any API call:
```bash
source .env
```

If `.env` doesn't exist or `STITCH_API_KEY` is empty, ask the user to provide it.

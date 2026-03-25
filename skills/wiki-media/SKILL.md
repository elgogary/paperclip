---
name: wiki-media
description: Capture screenshots and record videos of any Frappe/ERPNext site using Playwright. Logs in, navigates, clicks, and captures media for user-guide wikis. Outputs PNG screenshots and MP4 videos with optional captions. Works headless on Windows.
argument-hint: "action site_url manifest_or_target"
---

## Input
Target: $ARGUMENTS

Scope examples:
- "capture screenshots for bidding module wiki"
- "record video: how to create a bid"
- "capture all screens from manifest docs/user-guide/media-manifest.json"
- "screenshot https://accbuilddev.mvpstorm.com/app/bid"
- "record video of estimation grid workflow"

Optional controls:
- **action**: `screenshot` | `video` | `manifest` | `setup` (default: inferred)
- **site**: URL of the Frappe site (default: from `.env` ACCUBUILD_DEV_URL)
- **output**: directory for saved media (default: `docs/user-guide/images/`)
- **viewport**: `1280x720` | `1440x900` | `1920x1080` (default: `1280x720`)
- **captions**: `true` | `false` — burn captions into videos (default: true)

---

## Preconditions

### Required: Capture script installed
The capture script lives at `.claude/tools/wiki-media/capture.js`. If missing, run setup:

```bash
cd ~/.claude/tools/wiki-media && npm install
npx playwright install chromium
```

### Required: Site credentials
Read from `.env` in the project root:
```
ACCUBUILD_DEV_URL=https://accbuilddev.mvpstorm.com
ACCUBUILD_DEV_API_KEY=...
ACCUBUILD_DEV_API_SECRET=...
```

Or login credentials (user/password) passed at runtime.

---

## Architecture

```
┌──────────────────────────────────────────────────┐
│  wiki-media skill (SKILL.md)                     │
│  - Reads manifest or builds one from request     │
│  - Calls capture.js via Node                     │
└──────────┬───────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────┐
│  capture.js (Playwright script)                  │
│  - Launches headless Chromium                    │
│  - Logs into Frappe via /api/method/login        │
│  - Executes manifest steps                       │
│  - Screenshots: page.screenshot() → PNG          │
│  - Videos: context.recordVideo → WebM → MP4      │
│  - Captions: generates .srt → FFmpeg burn-in     │
└──────────┬───────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────┐
│  Output                                          │
│  docs/user-guide/images/*.png (screenshots)      │
│  docs/user-guide/videos/*.mp4 (videos)           │
│  .outline-media-map.json (for outline-publish)   │
└──────────────────────────────────────────────────┘
```

---

## Manifest Format

A manifest is a JSON file describing what to capture. The skill can auto-generate one from a request, or the user can provide one.

```json
{
  "site": "https://accbuilddev.mvpstorm.com",
  "auth": {
    "method": "login",
    "user": "administrator",
    "password": "from_env"
  },
  "viewport": { "width": 1280, "height": 720 },
  "output_dir": "docs/user-guide",
  "captures": [
    {
      "id": "bid-list",
      "type": "screenshot",
      "title": "Bid List View",
      "steps": [
        { "action": "goto", "url": "/app/bid" },
        { "action": "wait", "selector": ".list-row", "timeout": 10000 }
      ],
      "output": "images/02-bidding/bid-list.png"
    },
    {
      "id": "bid-form-tabs",
      "type": "screenshot",
      "title": "Bid Form — Estimation Tab",
      "steps": [
        { "action": "goto", "url": "/app/bid/BID-00001" },
        { "action": "wait", "selector": ".form-page" },
        { "action": "click", "selector": "[data-fieldname='estimation_tab']" },
        { "action": "wait", "ms": 1000 }
      ],
      "highlight": "[data-fieldname='bid_items']",
      "output": "images/02-bidding/bid-form-estimation.png"
    },
    {
      "id": "create-bid-workflow",
      "type": "video",
      "title": "How to Create a Bid",
      "captions": true,
      "steps": [
        { "action": "goto", "url": "/app/bid", "caption": "Open the Bid list" },
        { "action": "wait", "ms": 2000 },
        { "action": "click", "selector": ".btn-primary-dark", "caption": "Click New Bid" },
        { "action": "wait", "selector": ".form-page" },
        { "action": "wait", "ms": 1500, "caption": "The new Bid form opens" },
        { "action": "fill", "selector": "[data-fieldname='bid_name'] input", "value": "Demo Bid", "caption": "Enter the bid name" },
        { "action": "fill", "selector": "[data-fieldname='client_name'] input", "value": "Acme Corp", "caption": "Enter the client name" },
        { "action": "wait", "ms": 2000 },
        { "action": "click", "selector": ".btn-primary-dark", "caption": "Click Save" },
        { "action": "wait", "ms": 3000, "caption": "Your bid is saved" }
      ],
      "output": "videos/02-bidding/create-bid.mp4"
    }
  ]
}
```

### Step Actions

| Action | Parameters | Description |
|---|---|---|
| `goto` | `url` (relative or absolute) | Navigate to URL |
| `wait` | `selector` and/or `ms`, `timeout` | Wait for element or time |
| `click` | `selector` | Click an element |
| `fill` | `selector`, `value` | Type text into input |
| `scroll` | `selector` or `y` | Scroll to element or Y offset |
| `hover` | `selector` | Hover over element |
| `select` | `selector`, `value` | Select dropdown option |
| `press` | `key` | Press keyboard key |
| `highlight` | `selector`, `color` | Add CSS highlight border |
| `clear_highlight` | — | Remove all highlights |

### Caption Rules
- Each step can have an optional `caption` string
- Captions are burned into the video at the bottom (white text, dark background)
- Generated as `.srt` file, then merged via FFmpeg `subtitles` filter
- Keep captions short: 5-10 words per step

---

## Execution Pipeline

### For Screenshots

1. Launch headless Chromium via Playwright
2. Login to Frappe site (cookie auth)
3. For each screenshot capture:
   a. Execute steps (navigate, click, wait)
   b. If `highlight` specified: inject CSS border via `page.addStyleTag()`
   c. `await page.screenshot({ path, fullPage: false })`
   d. Log: `Captured: {title} → {output}`

### For Videos

1. Launch headless Chromium with `recordVideo: { dir: tempDir, size: viewport }`
2. Login to Frappe site
3. For each video capture:
   a. Execute steps with timing (each step adds pause for viewer comprehension)
   b. Track timestamps for each captioned step
   c. Close context → WebM saved to temp dir
   d. Generate `.srt` from caption timestamps
   e. Convert WebM → MP4: `ffmpeg -i input.webm -c:v libx264 -crf 23 output.mp4`
   f. If captions: `ffmpeg -i output.mp4 -vf "subtitles=captions.srt" final.mp4`
   g. Clean up temp files
   h. Log: `Recorded: {title} → {output}`

### For Manifest

1. Read manifest JSON file
2. Process all captures in order (screenshots first, then videos)
3. Output summary table of all captured media

---

## Auto-Generate Manifest from Wiki

When the skill is invoked without a manifest, it can scan existing wiki markdown for placeholders:

```markdown
<!-- SCREENSHOT: Bid list view showing all bids -->
<!-- VIDEO: How to create a new bid step by step -->
```

For each placeholder:
- `SCREENSHOT`: generates a screenshot capture entry (infers URL from context)
- `VIDEO`: generates a video capture entry (infers workflow steps from the surrounding markdown steps)

After capture, replaces placeholders with actual image/video references:
```markdown
![Bid list view](images/02-bidding/bid-list.png)
```

---

## Frappe Login Method

```js
// Cookie-based login — works with all Frappe sites
await page.goto(`${siteUrl}/api/method/login`, {
  method: 'POST' // actually we navigate, then use API
});

// Better: use API call to get cookie, then set it
const response = await page.request.post(`${siteUrl}/api/method/login`, {
  data: { usr: user, pwd: password }
});
// Cookie is auto-set in the browser context

// Or with API key (simpler):
await page.setExtraHTTPHeaders({
  'Authorization': `token ${apiKey}:${apiSecret}`
});
await page.goto(`${siteUrl}/app`);
```

---

## Output Summary

After execution, print a summary:

```
Wiki Media Capture Complete
━━━━━━━━━━━━━━━━━━━━━━━━━━

Screenshots (4):
  ✓ bid-list          → images/02-bidding/bid-list.png (142 KB)
  ✓ bid-form          → images/02-bidding/bid-form.png (198 KB)
  ✓ estimation-grid   → images/02-bidding/estimation-grid.png (245 KB)
  ✓ contract-form     → images/03-contracts/contract-form.png (167 KB)

Videos (2):
  ✓ create-bid        → videos/02-bidding/create-bid.mp4 (2.1 MB, 0:24)
  ✓ build-estimate    → videos/02-bidding/build-estimate.mp4 (3.4 MB, 0:38)

Total: 6 files, 6.2 MB
```

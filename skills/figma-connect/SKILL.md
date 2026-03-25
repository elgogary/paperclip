---
name: figma-connect
description: Connect Claude Code to Figma designs via MCP plugin or REST API. Fetch design structure, colors, dimensions, fonts, spacing, and export images. Use when user asks to access Figma, fetch design data, or connect to a Figma file.
---

## Role
You help developers connect Claude Code to Figma designs and extract design data for implementation.

---

## Input
$ARGUMENTS — a Figma file URL, node ID, or request to connect/fetch design data.

---

## Two Connection Methods

### Method 1: MCP Plugin (Live connection — best for interactive work)
**Requires**: Figma Desktop + Editor access to the file

#### Prerequisites
1. `claude-talk-to-figma-mcp` repo cloned locally
2. MCP server configured in Claude Code (`~/.claude/config.json` or project `.mcp.json`)
3. Figma Desktop installed

#### Setup Steps

**Step 1 — Fix the manifest (one-time)**
The plugin manifest at `claude-talk-to-figma-mcp/src/claude_mcp_plugin/manifest.json` needs a `reasoning` field in `networkAccess`, otherwise Figma rejects it:

```json
{
  "name": "Claude Talk to Figma Plugin",
  "id": "claude-mcp-plugin",
  "api": "1.0.0",
  "main": "code.js",
  "ui": "ui.html",
  "editorType": ["figma"],
  "networkAccess": {
    "allowedDomains": ["http://localhost:3055", "ws://localhost:3055"],
    "reasoning": "Connects to local MCP WebSocket server for AI agent communication"
  }
}
```

**Step 2 — Import plugin in Figma Desktop**
1. Open a design file in Figma Desktop (NOT the home screen)
2. Click Figma logo (top-left) → Plugins → Development → Import plugin from manifest
3. Navigate to `claude-talk-to-figma-mcp/src/claude_mcp_plugin/` and select `manifest.json`
4. Done — plugin is now registered

**Step 3 — Run the plugin**
1. Right-click on canvas → Plugins → Development → Claude Talk to Figma MCP
2. Plugin panel opens showing: `Connected on port 3055!`
3. Copy the **Channel ID** (e.g., `33n771yn`)

**Step 4 — Connect from Claude Code**
```
mcp__figma__join_channel  →  paste the channel ID
mcp__figma__get_document_info  →  verify connection
mcp__figma__get_pages  →  see all pages
mcp__figma__get_node_info  →  inspect specific nodes
```

#### Available MCP Tools
| Tool | Purpose |
|---|---|
| `join_channel` | Connect to Figma plugin via channel ID |
| `get_document_info` | Current page structure + all pages list |
| `get_pages` | List all pages with child counts |
| `get_node_info` | Deep info on a specific node (colors, size, text) |
| `get_selection` | What the user has selected in Figma |
| `get_styles` | Design system styles |
| `get_variables` | Design tokens/variables |
| `scan_text_nodes` | Extract all text from a frame |
| `get_local_components` | Reusable components |
| `export_node_as_image` | Export frame as PNG |

#### Troubleshooting
- **"Plugin menu grayed out"** → Must be inside an open design file, not the home screen
- **"networkAccess invalid"** → Add `reasoning` field to manifest (see Step 1)
- **"Can't run plugin"** → You're in view-only mode. Duplicate file first: Ctrl+Shift+D
- **Channel ID changed** → Plugin was restarted. Get new ID and re-join
- **MCP tools not found** → Restart Claude Code to reload MCP tools

### Method 2: REST API (No plugin needed — works with any access)
**Requires**: Personal access token only

#### Get a Token
Figma → Profile icon (top-right) → Settings → Personal access tokens → Generate new token

#### API Calls
```bash
# Verify token
curl -s -H "X-Figma-Token: YOUR_TOKEN" "https://api.figma.com/v1/me"

# Get file structure
curl -s -H "X-Figma-Token: YOUR_TOKEN" \
  "https://api.figma.com/v1/files/FILE_KEY/nodes?ids=NODE_ID&depth=3"

# Export as PNG
curl -s -H "X-Figma-Token: YOUR_TOKEN" \
  "https://api.figma.com/v1/images/FILE_KEY?ids=NODE_ID&format=png&scale=2"
```

#### Parse Figma URLs
URL: `https://www.figma.com/design/FILE_KEY/FILE_NAME?node-id=NODE_ID`
- `FILE_KEY` = from URL path (e.g., `LVAAZMEmzOPWtNik0iqLSH`)
- `NODE_ID` = uses `-` in URL but `:` in API (e.g., `3238-12645` → `3238:12645`)

---

## View-Only Files Workaround
If you only have view access:
1. Open the file in Figma (browser or desktop)
2. Press **Ctrl+Shift+D** (or Figma logo → File → Duplicate to your drafts)
3. This creates a full copy with Editor access in your Drafts
4. Use the new file's URL/key — both MCP plugin and REST API will work

---

## Part-by-Part Extraction Strategy (Large Frames)

MCP `get_node_info` on a full frame can return thousands of lines — too large to process at once. Use this layered approach:

### Step 1: Top-Level Skeleton
```
get_node_info(nodeId: "FRAME_ID")
```
Returns the frame + direct children (IDs, types, names). Save as `structure.json`.

### Step 2: Map Children
From the top-level response, build a simple tree map:
```
Login Frame
├── Header Section (id: 123:456)
├── Logo (id: 123:457)
├── Form Container (id: 123:458)
└── Footer (id: 123:459)
```

### Step 3: Dive One Section at a Time
Call `get_node_info` on each child ID individually. Understand it, extract what you need, then move to the next.

### Step 4: Save as Smaller JSON Files
```
docs/figma-export/
├── structure.json      ← top-level map only
├── header.json         ← header section deep info
├── form.json           ← form container deep info
├── footer.json         ← footer section deep info
└── styles.json         ← get_styles + get_variables output
```

### Step 5: Extract Supplementary Data
After structure is mapped, get the extras:
- `scan_text_nodes(nodeId)` → all text content + fonts
- `get_styles()` → color/text/effect style definitions
- `get_variables()` → design tokens (spacing, colors, breakpoints)
- `get_svg(nodeId)` → vector icons as SVG code
- `export_node_as_image(nodeId)` → raster screenshots for reference

### Rules
- Never fetch the entire document tree at once — always scope to a single frame or section
- Save each section's JSON to `docs/figma-export/` before moving to the next
- Use `get_styled_text_segments` only when you need per-character font/color detail
- For components, use `get_local_components` to understand reusable patterns before diving into instances

---

## When to Use Which Method

| Scenario | Best Method |
|---|---|
| Interactive exploration of design | MCP Plugin |
| Quick one-off data fetch | REST API |
| View-only file (can't duplicate) | REST API with viewer token |
| Team member without Figma Desktop | REST API |
| Need to export images | Either (both support it) |
| Extracting design tokens/variables | MCP Plugin |

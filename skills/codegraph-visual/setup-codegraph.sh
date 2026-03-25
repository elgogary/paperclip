#!/bin/bash
# Post-pull setup for Codegraph Visual
# Run after git pull to ensure DB + graph data exist for Claude Code
#
# Usage: bash setup-codegraph.sh [project-path]
# Or add to Makefile: make codegraph

set -e
PROJECT="${1:-.}"
SKILL_DIR="$HOME/.claude/skills/codegraph-visual"
NODE_PATH="$HOME/.npm-global/lib/node_modules/@colbymchenry/codegraph/node_modules"

echo "=== Codegraph Setup ==="

# 1. Check prerequisites
if ! command -v codegraph &>/dev/null; then
  echo "[INSTALL] Codegraph not found — installing..."
  npm install -g @colbymchenry/codegraph
fi

# 2. Init if needed
if [ ! -d "$PROJECT/.codegraph" ]; then
  echo "[INIT] Initializing Codegraph..."
  codegraph init "$PROJECT"
fi

# 3. Index (or sync if already indexed)
if [ -f "$PROJECT/.codegraph/codegraph.db" ]; then
  echo "[SYNC] Updating index..."
  codegraph sync "$PROJECT" 2>/dev/null || codegraph index "$PROJECT"
else
  echo "[INDEX] Building full index..."
  codegraph index "$PROJECT"
fi

# 4. Extract graph data
echo "[EXTRACT] Generating codegraph-data.json..."
DOCS_DIR="$PROJECT/docs"
mkdir -p "$DOCS_DIR"

if [ -f "$SKILL_DIR/extract_graph.js" ]; then
  NODE_PATH="$NODE_PATH" node "$SKILL_DIR/extract_graph.js" \
    "$PROJECT/.codegraph/codegraph.db" \
    > "$DOCS_DIR/codegraph-data.json"
else
  echo "[WARN] extract_graph.js not found at $SKILL_DIR — skipping extraction"
fi

# 5. Auto-add ERPNext layer if Frappe app
if find "$PROJECT" -maxdepth 3 -name "hooks.py" -print -quit 2>/dev/null | grep -q .; then
  echo "[ERPNEXT] Frappe app detected — adding ERPNext layer..."
  if [ -f "$SKILL_DIR/add_erpnext_layer.py" ]; then
    python3 "$SKILL_DIR/add_erpnext_layer.py" "$DOCS_DIR/codegraph-data.json" "$PROJECT"
  fi
fi

# 6. Copy HTML viewer if missing
if [ ! -f "$DOCS_DIR/codegraph-visual.html" ] && [ -f "$SKILL_DIR/codegraph-visual.html" ]; then
  echo "[HTML] Copying viewer template..."
  cp "$SKILL_DIR/codegraph-visual.html" "$DOCS_DIR/"
fi

# 7. Status
codegraph status "$PROJECT"
echo ""
echo "=== Done ==="
echo "View: cd $DOCS_DIR && python3 -m http.server 8888"
echo "Open: http://localhost:8888/codegraph-visual.html"

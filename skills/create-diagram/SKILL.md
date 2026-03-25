---
name: create-diagram
description: Create diagrams using draw.io MCP server. Use when user asks to create architecture diagrams, flowcharts, ERD, sequence diagrams, data flow diagrams, or any visual documentation. Preferred over HTML for all diagramming work.
---

# Create Diagram with draw.io MCP

Use the draw.io MCP server tools to create diagrams programmatically. This is the **default method for all diagrams** — faster and more portable than HTML prototypes.

## When to Use

- Architecture diagrams (system design, module maps)
- Flowcharts (business processes, workflows)
- ERD / DocType relationship diagrams
- Data flow diagrams
- Sequence diagrams
- Network / infrastructure diagrams
- Any visual documentation that would otherwise be Mermaid or HTML

## MCP Tools Available

### Inspection
- `get-selected-cell` — get currently selected cell
- `get-shape-categories` — list available shape categories
- `get-shapes-in-category` — shapes in a category
- `get-shape-by-name` — find specific shape
- `list-paged-model` — paginated view of all cells (vertices + edges)

### Creation & Modification
- `add-rectangle` — create rectangle (x, y, width, height, text, style)
- `add-edge` — connect two cells (source_id, target_id, text, style)
- `add-cell-of-shape` — add cell of specific shape type from library
- `edit-cell` — update existing cell (text, position, size, style)
- `edit-edge` — update existing edge (text, source, target, style)
- `set-cell-shape` — apply library shape style to existing cell
- `set-cell-data` — set custom attribute on a cell
- `delete-cell-by-id` — remove a cell

### Layers
- `list-layers` — list all layers
- `get-active-layer` — current active layer
- `set-active-layer` — switch active layer
- `create-layer` — create new layer
- `move-cell-to-layer` — move cell between layers

## Workflow

1. **Plan the diagram** — identify nodes, edges, layout direction
2. **Create shapes** — use `add-rectangle` or `add-cell-of-shape` for each node
   - Use grid-based positioning (x, y increments of ~200 for spacing)
   - Set meaningful text labels
3. **Connect shapes** — use `add-edge` with source/target IDs from step 2
4. **Style** — apply colors, fonts via draw.io style syntax
5. **Organize** — use layers for complex diagrams with multiple concerns

## Style Syntax Examples

```
# Rectangle styles
fillColor=#dae8fc;strokeColor=#6c8ebf;rounded=1;           # Blue rounded
fillColor=#d5e8d4;strokeColor=#82b366;rounded=1;           # Green rounded
fillColor=#fff2cc;strokeColor=#d6b656;rounded=1;           # Yellow rounded
fillColor=#f8cecc;strokeColor=#b85450;rounded=1;           # Red rounded
fillColor=#e1d5e7;strokeColor=#9673a6;rounded=1;           # Purple rounded

# Edge styles
edgeStyle=orthogonalEdgeStyle;curved=1;                    # Orthogonal curved
edgeStyle=entityRelationEdgeStyle;                          # ER diagram style
dashed=1;                                                   # Dashed line

# Text
fontSize=14;fontStyle=1;                                    # Bold 14px
fontColor=#333333;                                          # Dark text
```

## Layout Tips

- **Top-down flow**: increment Y by 100-120 per row
- **Left-right flow**: increment X by 200-250 per column
- **Group related nodes**: use same Y for peers, offset X
- **Standard sizes**: 160x60 for process boxes, 120x60 for small, 200x80 for large
- **Spacing**: min 40px gap between shapes

## Output

Diagrams are saved as `.drawio` files which can be:
- Opened in draw.io desktop app
- Opened in VS Code with draw.io extension
- Opened at onlinediagrams.net
- Exported to PNG/SVG/PDF from any of these

## Rules

- Default to draw.io for ALL diagramming — do not use HTML unless the user specifically asks for an interactive prototype
- For Mermaid in markdown docs, Mermaid is still fine — draw.io is for standalone diagram files
- Save diagrams to `docs/diagrams/` folder (create if needed)
- Name files descriptively: `architecture-overview.drawio`, `bid-workflow.drawio`
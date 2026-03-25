---
name: create-prototype
description: Create standalone HTML prototypes for UI work (dialogs, pages, child table overrides, pickers, forms). MANDATORY before implementing any Frappe UI. Uses AccuBuild design system (--ab-* tokens). Pure Vanilla JS + CSS, no build tools.
argument-hint: "component_type description target_doctype complexity"
user-invokable: true
---

## Input
Target: $ARGUMENTS

**Required**:
- **Component type**: dialog, page, child-table-override, picker, form-section, flow-diagram, dashboard, wizard
- **Description**: What the UI should do

**Optional**:
- **Target DocType**: Which DocType/form this is for
- **Complexity**: simple | medium | complex
- **Reference prototype**: Path to existing prototype to extend

**Fallback**:
- Component type unclear → ask
- Default complexity: medium

---

## Why Prototype First (NON-NEGOTIABLE)

**Rule: NEVER implement a new dialog, page, or child table override directly in Frappe. Always prototype first.**

Prototypes let you iterate on UX/layout without touching Frappe code. They validate design, catch edge cases early, and serve as implementation spec.

---

## Preflight Rules (HARD GATES)

### Gate 1 — Check Existing Prototypes (MANDATORY)
1) Search `docs/prototypes/` for similar prototypes
2) If found: "Extend existing or create new?"
3) Check project wiki for UI conventions

### Gate 2 — Context Discovery (MANDATORY)
1) Identify target DocType/form/page
2) Read existing form JS or page JS (if redesigning)
3) Note field layout, child tables, workflow states

### Gate 3 — Clarifying Questions (MANDATORY)
Ask only what affects design:
- Primary user role?
- Before/after comparison needed?
- Multi-state display? (empty, loading, populated, error)
- DevExtreme integration? (tree/grid)

### Gate 4 — Plan Before Creating (MANDATORY)
```
Component: [type]
File: docs/prototypes/[name]_prototype.html
Complexity: [simple/medium/complex]
States: [list]
DevExtreme: [yes/no]
Before/after: [yes/no]
```
Ask approval before creating.

---

## Technology Rules

- **Single HTML file** — self-contained, opens in any browser
- **Pure Vanilla JS** — no React, no Vue, no jQuery, no npm
- **Inline CSS in `<style>`** — uses `--ab-*` design tokens below
- **CDN allowed**: Font Awesome 4.7 only (unless DevExtreme needed)
- **Location**: `docs/prototypes/[snake_case]_prototype.html`

---

## AccuBuild Design System Reference

### Boilerplate (ALWAYS START WITH THIS)

```html
<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>[Feature] — [Type] Prototype</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">
<style>
:root {
  --ab-primary: #2490ef; --ab-primary-light: #e8f4fd; --ab-primary-text: #fff;
  --ab-card-bg: #fff; --ab-control-bg: #f7f8fa; --ab-hover-bg: #f0f4f8;
  --ab-selected-bg: #e8f4fd; --ab-block-border: #d1d8dd;
  --ab-block-border-light: #e2e6ea; --ab-block-border-subtle: #eef0f2;
  --ab-heading-color: #1a1a2e; --ab-text-color: #333; --ab-text-muted: #8d99a6;
  --ab-info-bg: #e8f4fd; --ab-info-border: #2490ef; --ab-info-text: #1a6fb5;
  --ab-warning-bg: #fff3cd; --ab-warning-text: #856404;
  --ab-success-bg: #d4edda; --ab-success-text: #155724;
  --ab-danger-bg: #f8d7da; --ab-danger-text: #842029;
  --ab-gray-bg: #f0f0f0; --ab-gray-text: #6c757d;
  --ab-purple-bg: #f3e8ff; --ab-purple-text: #7c3aed;
}
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
       background: #e9ecef; padding: 20px; color: var(--ab-text-color); }
.hidden { display: none !important; }
.prototype-label { display: inline-block; background: #dc3545; color: #fff;
                   padding: 3px 10px; border-radius: 4px; font-size: 11px;
                   font-weight: 700; text-transform: uppercase; margin-bottom: 10px; }
.section-label { font-size: 12px; color: var(--ab-text-muted); text-transform: uppercase;
                 letter-spacing: 0.5px; margin-bottom: 8px; font-weight: 600; }
</style>
</head>
<body>
<span class="prototype-label">Prototype</span>
```

### Dialog Shell (4-part structure — header, step-bar, body, footer)

```css
.dialog-overlay { background: rgba(0,0,0,0.4); border-radius: 10px; padding: 0; margin-bottom: 30px; }
.dialog { background: var(--ab-card-bg); border-radius: 10px; max-width: 1100px;
          margin: 0 auto; box-shadow: 0 8px 32px rgba(0,0,0,0.2); overflow: hidden; }
.dialog-header { padding: 14px 20px; border-bottom: 1px solid var(--ab-block-border);
                 display: flex; justify-content: space-between; align-items: center; }
.dialog-header h3 { font-size: 16px; font-weight: 700; color: var(--ab-heading-color);
                    display: flex; align-items: center; gap: 8px; }
.dialog-close { font-size: 18px; color: var(--ab-text-muted); cursor: pointer;
                border: none; background: none; }
.dialog-body { padding: 16px 20px; }
.dialog-footer { padding: 12px 20px; border-top: 1px solid var(--ab-block-border);
                 display: flex; justify-content: space-between; align-items: center; }
```

```html
<div class="dialog-overlay">
<div class="dialog">
  <div class="dialog-header">
    <h3><i class="fa fa-[icon]" style="color:var(--ab-primary)"></i> Title</h3>
    <button class="dialog-close">&times;</button>
  </div>
  <div class="dialog-body">
    <!-- content -->
  </div>
  <div class="dialog-footer">
    <div class="footer-left"></div>
    <div class="footer-right">
      <button class="btn btn-default">Cancel</button>
      <button class="btn btn-primary">Action <i class="fa fa-arrow-right"></i></button>
    </div>
  </div>
</div>
</div>
```

### Button System (3 sizes, 4 variants)

```css
.btn { padding: 8px 20px; border-radius: 6px; font-size: 13px; font-weight: 600;
       cursor: pointer; border: 1px solid var(--ab-block-border);
       display: inline-flex; align-items: center; gap: 6px; transition: all 0.15s; }
.btn-sm { padding: 5px 12px; font-size: 12px; }
.btn-default { background: var(--ab-card-bg); color: var(--ab-text-color); }
.btn-default:hover { background: var(--ab-hover-bg); }
.btn-primary { background: var(--ab-primary); color: #fff; border-color: var(--ab-primary); }
.btn-primary:hover { background: #1a7fd4; }
.btn-primary:disabled { opacity: 0.45; cursor: not-allowed; }
.btn-success { background: #28a745; color: #fff; border-color: #28a745; }
.btn-danger { background: var(--ab-danger-bg); color: var(--ab-danger-text); }
```

### Banners (info, warning, success)

```css
.banner { display: flex; align-items: flex-start; gap: 10px;
          padding: 10px 14px; border-radius: 4px; font-size: 12px;
          margin-bottom: 14px; line-height: 1.5; }
.banner.info { background: var(--ab-info-bg); border: 1px solid var(--ab-info-border);
               color: var(--ab-info-text); }
.banner.warning { background: var(--ab-warning-bg); border: 1px solid #ffc107;
                  color: var(--ab-warning-text); }
.banner.success { background: var(--ab-success-bg); border: 1px solid #28a745;
                  color: var(--ab-success-text); }
```

```html
<div class="banner info"><i class="fa fa-info-circle"></i><span>Context message here</span></div>
```

### Badges & Chips

```css
/* Status badges */
.badge { display: inline-flex; align-items: center; gap: 4px;
         border-radius: 10px; padding: 2px 9px; font-size: 11px; font-weight: 600; }
.badge.pending { background: var(--ab-warning-bg); color: var(--ab-warning-text); }
.badge.success { background: var(--ab-success-bg); color: var(--ab-success-text); }
.badge.danger { background: var(--ab-danger-bg); color: var(--ab-danger-text); }

/* Filter chips with counts */
.chip { padding: 5px 14px; border-radius: 20px; font-size: 12px; font-weight: 600;
        cursor: pointer; border: 1px solid var(--ab-block-border);
        background: var(--ab-card-bg); color: var(--ab-text-muted); transition: all 0.15s;
        display: inline-flex; align-items: center; gap: 5px; }
.chip.active { background: var(--ab-primary); color: #fff; border-color: var(--ab-primary); }
.chip .chip-count { font-size: 10px; background: rgba(255,255,255,0.25);
                    padding: 1px 6px; border-radius: 10px; }
```

### Table Pattern

```css
.grid-table { width: 100%; border-collapse: collapse; }
.grid-table th { background: var(--ab-control-bg); padding: 8px 12px; text-align: left;
                 font-size: 11px; font-weight: 600; color: var(--ab-text-muted);
                 text-transform: uppercase; letter-spacing: 0.5px;
                 border-bottom: 2px solid var(--ab-block-border); }
.grid-table td { padding: 10px 12px; border-bottom: 1px solid var(--ab-block-border-light); }
.grid-table tbody tr:hover { background: var(--ab-hover-bg); }
```

### Form Controls

```css
.form-control { width: 100%; padding: 7px 10px; border: 1px solid var(--ab-block-border);
                border-radius: 4px; font-size: 13px; color: var(--ab-text-color); }
.form-control:focus { outline: none; border-color: var(--ab-primary);
                      box-shadow: 0 0 0 3px rgba(36,144,239,.15); }
.form-label { display: block; font-size: 12px; font-weight: 600;
              color: var(--ab-heading-color); margin-bottom: 5px; }
.form-label .reqd { color: #e53e3e; margin-left: 2px; }
```

### Card Selection

```css
.card-selectable { background: var(--ab-card-bg); border: 2px solid var(--ab-block-border);
                   border-radius: 8px; padding: 14px; cursor: pointer; transition: all 0.15s; }
.card-selectable:hover { border-color: var(--ab-primary);
                         box-shadow: 0 2px 8px rgba(36,144,239,0.12); }
.card-selectable.selected { border-color: var(--ab-primary); background: var(--ab-selected-bg); }
```

### Two-Column Split Panel (master-detail)

```css
.split-panel { display: flex; gap: 0; border: 1px solid var(--ab-block-border);
               border-radius: 6px; overflow: hidden; min-height: 420px; }
.split-left { width: 320px; flex-shrink: 0; display: flex; flex-direction: column;
              background: var(--ab-card-bg); border-right: 1px solid var(--ab-block-border); }
.split-right { flex: 1; display: flex; flex-direction: column;
               background: var(--ab-control-bg); min-width: 0; }
```

### Multi-Step Bar

```css
.step-bar { padding: 10px 20px; background: var(--ab-control-bg);
            border-bottom: 1px solid var(--ab-block-border-light);
            display: flex; align-items: center; gap: 6px; font-size: 12px; }
.step-pill { display: inline-flex; align-items: center; gap: 5px;
             padding: 3px 10px; border-radius: 4px; font-size: 11px; font-weight: 700;
             border: 1.5px solid var(--ab-block-border); color: var(--ab-text-muted);
             background: var(--ab-card-bg); }
.step-pill.active { border-color: var(--ab-primary); color: var(--ab-primary);
                    background: var(--ab-primary-light); }
.step-pill.done { border-color: #28a745; color: #28a745; background: var(--ab-success-bg); }
.step-sep { color: var(--ab-block-border); font-size: 14px; }
```

```html
<div class="step-bar">
  <span class="step-pill done"><i class="fa fa-check" style="font-size:9px"></i> 1 Setup</span>
  <span class="step-sep">›</span>
  <span class="step-pill active"><i class="fa fa-circle" style="font-size:8px"></i> 2 Configure</span>
  <span class="step-sep">›</span>
  <span class="step-pill">3 Confirm</span>
</div>
```

### Mode Card Grid (radio-select)

```css
.mode-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 18px; }
.mode-card { border: 2px solid var(--ab-block-border); border-radius: 4px; padding: 12px 14px;
             cursor: pointer; transition: border-color .15s, background .15s; position: relative; }
.mode-card:hover { border-color: var(--ab-primary); background: var(--ab-hover-bg); }
.mode-card.selected { border-color: var(--ab-primary); background: var(--ab-primary-light); }
.mode-card-icon { width: 32px; height: 32px; border-radius: 4px; margin-bottom: 8px;
                  display: flex; align-items: center; justify-content: center; font-size: 15px; }
```

### Tree Preview (indented nodes)

```css
.tree-container { border: 1px solid var(--ab-block-border-light);
                  border-radius: 4px; overflow: hidden; }
.tree-node { display: flex; align-items: center; padding: 6px 14px; font-size: 12px;
             border-bottom: 1px solid var(--ab-block-border-subtle); cursor: pointer; }
.tree-node.l1 { padding-left: 14px; }
.tree-node.l2 { padding-left: 32px; }
.tree-node.l3 { padding-left: 50px; }
.tree-node.l4 { padding-left: 68px; }
.tree-node-dot { width: 8px; height: 8px; border-radius: 50%; margin-right: 8px; }
.tree-toggle { width: 16px; height: 16px; display: flex; align-items: center;
               justify-content: center; font-size: 10px; margin-right: 6px; }
```

### Full Page Layout (sidebar + main)

```css
.layout { display: flex; min-height: 100vh; }
.sidebar { width: 220px; background: #fff; border-right: 1px solid var(--ab-block-border);
           display: flex; flex-direction: column; padding: 16px 0; flex-shrink: 0; }
.main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.topbar { background: #fff; border-bottom: 1px solid var(--ab-block-border);
          padding: 10px 24px; display: flex; align-items: center; gap: 12px; }
.content { padding: 20px 24px; overflow-y: auto; flex: 1; }
.nav-item { display: flex; align-items: center; gap: 10px; padding: 8px 16px;
            cursor: pointer; color: var(--ab-text-muted); font-weight: 500; }
.nav-item:hover { background: var(--ab-primary-light); color: var(--ab-primary); }
.nav-item.active { background: var(--ab-primary-light); color: var(--ab-primary);
                   border-right: 3px solid var(--ab-primary); }
```

### Before/After Comparison

```css
.compare-label { font-size: 11px; font-weight: 700; text-transform: uppercase;
                 padding: 4px 10px; border-radius: 4px; display: inline-block; margin-bottom: 8px; }
.compare-label.before { background: #f8d7da; color: #721c24; }
.compare-label.after { background: #d4edda; color: #155724; }
.part-divider { margin: 40px 0 20px; padding: 14px 0; border-top: 3px solid var(--ab-primary); }
.problem-box { background: #fff5f5; border: 1px solid #feb2b2; border-radius: 6px;
               padding: 12px 14px; margin: 14px 0; font-size: 12px; color: #c53030; }
```

---

## JS State Management Patterns

### Tab/Panel Switching
```javascript
function switchPanel(mode) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`.tab[data-mode="${mode}"]`).classList.add('active');
  document.querySelectorAll('.panel').forEach(p => p.classList.add('hidden'));
  document.getElementById(mode).classList.remove('hidden');
}
```

### Single-Select List Row
```javascript
function selectRow(el) {
  document.querySelectorAll('.list-row').forEach(r => r.classList.remove('active'));
  el.classList.add('active');
}
```

### Card Selection (scoped to container)
```javascript
function selectCard(el) {
  el.closest('.card-grid').querySelectorAll('.card-selectable')
    .forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
}
```

### Mode Card Radio
```javascript
const modeHints = { a: 'Description A', b: 'Description B' };
function selectMode(m) {
  Object.keys(modeHints).forEach(x => {
    document.getElementById('card-'+x).classList.toggle('selected', x===m);
  });
  document.getElementById('mode-hint').innerHTML =
    '<i class="fa fa-lightbulb-o"></i>&nbsp;' + modeHints[m];
}
```

### Role Switcher with Data Object
```javascript
const views = {
  role_a: { counts: [14, 5, 3], sections: ["sec-1","sec-2"] },
  role_b: { counts: [6, 0, 4],  sections: ["sec-2","sec-3"] }
};
function switchRole(btn, role) {
  document.querySelectorAll(".role-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  const v = views[role];
  // Update counts, show/hide sections
}
```

### Collapse/Expand Tree
```javascript
function toggle(id) { document.getElementById(id)?.classList.toggle('hidden'); }
function expandAll() { document.querySelectorAll('.collapsible').forEach(e => e.classList.remove('hidden')); }
function collapseAll() { document.querySelectorAll('.collapsible').forEach(e => e.classList.add('hidden')); }
```

### Native HTML5 Drag-and-Drop (reorder rows)
```javascript
let dragRow = null;
document.querySelectorAll('[draggable]').forEach(handle => {
  handle.addEventListener('dragstart', (e) => {
    dragRow = handle.closest('tr');
    dragRow.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  });
});
tableBody.addEventListener('dragover', (e) => {
  e.preventDefault();
  const after = getDragAfterElement(e.clientY);
  if (after) tableBody.insertBefore(dragRow, after);
});
tableBody.addEventListener('dragend', () => {
  if (dragRow) { dragRow.classList.remove('dragging'); dragRow = null; }
});
```

---

## Component Templates

### Dialog → use: dialog shell + buttons + banners
### Multi-step wizard → use: dialog shell + step-bar + panel switching
### Child table override → use: dialog shell (as form section) + table + inline editing
### Picker → use: dialog shell + split-panel or card-grid + selection JS
### Full page → use: page layout (sidebar + main + topbar) + summary cards + tables
### Flow diagram → use: grid layout + step nodes + gate markers
### Form section → use: card + form controls + banners

---

## State Coverage by Complexity

**Simple**: Default state only
**Medium**: Default + empty + 1 alternate state (rendered vertically, scroll to see each)
**Complex**: Default + empty + loading + error + before/after comparison + multiple workflow states

**Technique**: Render ALL states as separate blocks stacked vertically, each with a scenario label. No JS needed to switch — scroll to see each state.

---

## What to Do

1) Run Gates 1-4
2) Create HTML file at `docs/prototypes/[name]_prototype.html`
3) Start with boilerplate (design tokens, reset, prototype-label)
4) Pick component CSS blocks from the reference above (only what's needed)
5) Build HTML structure using the component templates
6) Add JS for interactivity (use patterns above)
7) Add implementation annotations as HTML comments
8) Test file opens in browser standalone
9) Output implementation roadmap (how to translate to real Frappe code)

---

## Output Format

### A) Preflight
```
Existing prototypes: [list or "none"]
Target: [DocType/page]
```

### B) Plan
```
Component: [type]
File: docs/prototypes/[name]_prototype.html
States: [list]
CSS blocks used: [dialog, buttons, table, etc.]
```

### C) Created
```
File: [path]
~[N] lines
States: [list]
```

### D) Implementation Roadmap
```
To convert to real Frappe:
1. [e.g., Create client script with frappe.ui.Dialog]
2. [e.g., Add whitelisted API for data]
3. [e.g., Wire dialog body from prototype HTML]
```

---

## Checklist

- [ ] Existing prototypes checked
- [ ] Boilerplate with --ab-* tokens
- [ ] Red prototype-label badge at top
- [ ] Component CSS blocks (only needed ones)
- [ ] All required states rendered
- [ ] Implementation annotations added
- [ ] Before/after shown (if redesigning)
- [ ] Self-contained (opens in browser)
- [ ] Implementation roadmap provided

---

**Last Updated**: 2026-02-28
**Version**: 2.0
**Based on**: 28+ AccuBuild prototypes (dialogs, pages, pickers, flows, editors)

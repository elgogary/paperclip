---
name: implement-prototype
description: Convert an approved HTML prototype into real Frappe code. Audits the prototype, extracts every component (dialogs, tables, cards, trees), maps each to Frappe equivalents, generates production code, then audits output against ERPNext standards. The bridge between /create-prototype and shipping.
argument-hint: "prototype_path target_app target_module mode"
user-invokable: true
---

## Input
Target: $ARGUMENTS

**Required**:
- **prototype_path**: Path to the HTML prototype file (e.g., `docs/prototypes/estimation_picker_prototype.html`)

**Optional**:
- **target_app**: Which Frappe app to write code in (default: detect from cwd)
- **target_module**: Which module (e.g., `accubuild_bidding`, `ai_integration`)
- **target_doctype**: Which DocType this UI is for (if form-level)
- **mode**: `fast` (generate code, basic audit) or `deep` (full audit + tests + clean-code)

**Fallback**:
- No prototype path → ask for it, or search `docs/prototypes/` and list available
- Target app unclear → detect from current working directory
- Mode default: `fast`

---

## Pipeline (This skill is a 5-stage pipeline)

```
Stage 1: AUDIT PROTOTYPE     → Read HTML, extract every component
Stage 2: MAP TO FRAPPE        → Map each component to Frappe equivalent
Stage 3: GENERATE CODE        → Write real Frappe files
Stage 4: AUDIT OUTPUT         → Run ERPNext standards check on generated code
Stage 5: APPROVAL             → Show diff summary, ask to proceed
```

---

## Stage 1 — Audit Prototype (MANDATORY)

### What to Extract

Read the prototype HTML file and extract ALL of these:

**1) Layout Type**
- Dialog (`.dialog-overlay` + `.dialog`) → `frappe.ui.Dialog`
- Full page (`.layout` + `.sidebar` + `.main`) → Frappe Page
- Form section (embedded in a form) → Client Script with DOM injection
- Child table override → Client Script grid customization

**2) CSS Components Used**

| Prototype CSS | Frappe Equivalent |
|---|---|
| `.dialog-overlay` + `.dialog` | `frappe.ui.Dialog` |
| `.dialog-header h3` | Dialog title |
| `.dialog-body` | Dialog body (fields or custom HTML) |
| `.dialog-footer .btn-primary` | Dialog primary action |
| `.step-bar` + `.step-pill` | Multi-step dialog (custom or `frappe.ui.Dialog` with page switching) |
| `.btn-primary` / `.btn-default` | `frappe.ui.Dialog` actions / `frm.add_custom_button()` |
| `.banner.info` | `frm.set_intro()` or `frm.dashboard.set_headline()` |
| `.banner.warning` | `frappe.show_alert({message, indicator: 'orange'})` |
| `.badge` | `frm.page.set_indicator()` or HTML badge |
| `.chip` / `.chip.active` | Custom filter pills (DOM injection) |
| `.grid-table` | Frappe child table or `frappe.ui.Dialog` with HTML field |
| `.form-control` / `.form-label` | Dialog fields (`{fieldtype: 'Data', ...}`) |
| `.card-selectable` | Custom HTML in dialog body or `frappe.ui.Dialog` Link field |
| `.split-panel` | Two-column layout in dialog or page |
| `.mode-grid` + `.mode-card` | Radio fieldtype or custom HTML selector |
| `.tree-container` + `.tree-node` | `frappe.ui.Tree` or DevExtreme TreeList |
| `.nav-item` | Page sidebar items |
| `.summary-bar` | Page header with stat cards |

**3) JS Interactions**

| Prototype JS Pattern | Frappe Equivalent |
|---|---|
| `switchPanel(mode)` — tab switching | Dialog multi-page or `frm.set_df_property('section', 'hidden')` |
| `selectRow(el)` — list selection | `frappe.ui.Dialog` Link field or custom HTML + `frappe.call` |
| `selectCard(el)` — card radio | Custom HTML field in dialog + state tracking |
| `selectMode(m)` — mode picker | Radio field or custom HTML |
| `switchRole(btn, role)` — data-driven view | Page JS with `frappe.call` to fetch role-specific data |
| `toggle(id)` — tree expand/collapse | `frappe.ui.Tree` or DevExtreme TreeList API |
| Drag-and-drop reorder | DevExtreme `allowReordering: true` or SortableJS |
| `fetch`/`XMLHttpRequest` | `frappe.call({method: ..., args: ...})` |
| `localStorage` | `frappe.boot` or user settings |

**4) Data Sources**
- Static HTML data → needs `frappe.call` API endpoint
- Hardcoded lists → needs DocType query or whitelisted method
- Computed values → needs server-side calculation

**5) States Shown**
- Default state → normal render
- Empty state → conditional "no data" message
- Loading state → `frappe.show_progress` or skeleton
- Error state → `frappe.throw()` / `frappe.show_alert`

### Output of Stage 1

```
PROTOTYPE AUDIT
===============
File: [path] (~N lines)
Layout: [dialog/page/form-section/child-table-override]

Components extracted:
  1. [component] → maps to [frappe equivalent]
  2. [component] → maps to [frappe equivalent]
  ...

JS interactions:
  1. [pattern] → maps to [frappe equivalent]
  2. [pattern] → maps to [frappe equivalent]
  ...

Data sources needed:
  1. [what data] → [API method or DocType query]
  ...

States: [default, empty, error, ...]
```

---

## Stage 2 — Map to Frappe (MANDATORY)

### Decision Tree: What Frappe Pattern to Use

```
Is it a DIALOG?
├── Simple (1 panel, no tabs) → frappe.ui.Dialog with fields array
├── Multi-step (step-bar) → frappe.ui.Dialog with custom HTML + page switching
├── Complex (split panel, tree, cards) → frappe.ui.Dialog with {fieldtype: 'HTML'} body
└── Confirm action → frappe.confirm()

Is it a FULL PAGE?
├── Has sidebar → frappe.ui.Page with custom layout
├── Dashboard with cards → frappe.ui.Page + frappe.Chart + HTML template
└── List with actions → frappe.ui.Page + server-side data + client render

Is it a FORM SECTION?
├── Replaces child table → Client Script with grid override
├── Adds section to form → Client Script with frm.fields_dict injection
├── Adds buttons → frm.add_custom_button()
└── Adds banner/status → frm.set_intro() / frm.dashboard

Is it a CHILD TABLE OVERRIDE?
├── Simple column changes → Client Script grid config
├── Inline editing → Client Script + grid events
├── Full tree replacement → DevExtreme TreeList in HTML field
└── Custom toolbar → Client Script grid toolbar override
```

### File Planning

For each component, determine what files to create/modify:

| Component | Files |
|---|---|
| Dialog | `[module]/utils/[feature]_dialog.js` (or inline in client script) |
| Page | `[module]/page/[page_name]/[page_name].js` + `.py` + `.json` + `.css` |
| Client Script | `[module]/doctype/[doctype]/[doctype].js` |
| API endpoint | `[module]/utils/[feature].py` or `[module]/api.py` |
| CSS | `[app]/public/css/[feature].css` (+ add to hooks.py if global) |
| Controller logic | `[module]/doctype/[doctype]/[doctype].py` |

### Output of Stage 2

```
IMPLEMENTATION MAP
==================
Files to create:
  1. [path] — [purpose]
  2. [path] — [purpose]

Files to modify:
  1. [path] — [what changes]

API endpoints needed:
  1. [method_name] — [what it returns]

hooks.py changes:
  - [add CSS/JS to includes, or none]
```

---

## Stage 3 — Generate Code (MANDATORY)

### Rules for Code Generation

**Dialog code** — Use `frappe.ui.Dialog`:
```javascript
// Simple dialog
let d = new frappe.ui.Dialog({
    title: '[from prototype .dialog-header h3]',
    size: 'large',  // if prototype has max-width > 800px
    fields: [
        // Map .form-label + .form-control to fields
        {fieldtype: 'Data', fieldname: 'name', label: 'Name', reqd: 1},
        {fieldtype: 'HTML', fieldname: 'custom_html'},  // for complex layouts
        {fieldtype: 'Section Break'},
    ],
    primary_action_label: '[from prototype .btn-primary text]',
    primary_action(values) {
        frappe.call({
            method: '[whitelisted method]',
            args: values,
            callback: (r) => { d.hide(); }
        });
    }
});
d.show();

// For complex HTML body (cards, trees, split panels):
d.fields_dict.custom_html.$wrapper.html(`[translated prototype HTML]`);
```

**Page code** — Use Frappe Page pattern:
```javascript
frappe.pages['page-name'].on_page_load = function(wrapper) {
    let page = frappe.ui.make_app_page({
        parent: wrapper,
        title: '[from prototype .topbar title]',
        single_column: false  // true if no sidebar
    });
    // Render HTML from prototype, swap static data with frappe.call
};
```

**Client Script code** — Use form events:
```javascript
frappe.ui.form.on('[DocType]', {
    refresh(frm) {
        // Add custom buttons from prototype .btn
        frm.add_custom_button(__('[Button Text]'), () => {
            // Open dialog or perform action
        }, __('[Group]'));

        // Add banner from prototype .banner
        frm.set_intro(__('[message]'), '[blue/orange/red/green]');
    }
});
```

### CSS Translation Rules

| Prototype CSS | Production CSS |
|---|---|
| `--ab-primary: #2490ef` | Use `var(--primary)` (Frappe's own) |
| `--ab-card-bg: #fff` | Use `var(--fg-color)` or `var(--card-bg)` |
| `--ab-text-muted: #8d99a6` | Use `var(--text-muted)` |
| `--ab-block-border: #d1d8dd` | Use `var(--border-color)` or `var(--dark-border-color)` |
| `--ab-control-bg: #f7f8fa` | Use `var(--control-bg)` |
| `--ab-hover-bg: #f0f4f8` | Use `var(--fg-hover-color)` |
| Custom prototype colors | Keep as-is in feature CSS file |
| `.dialog-overlay` | Remove (Frappe handles modal overlay) |
| `.dialog` shell | Remove (Frappe handles dialog container) |
| Inner component CSS | Keep, prefix with feature namespace |

### JS Translation Rules

| Prototype JS | Frappe JS |
|---|---|
| `document.querySelector(...)` | `dialog.fields_dict.html.$wrapper.find(...)` or `$(wrapper).find(...)` |
| `el.classList.add/remove` | Same (or use jQuery `.addClass()/.removeClass()`) |
| `fetch('/api/...')` | `frappe.call({method: '...', args: {...}})` |
| `localStorage` | `frappe.boot.user_settings` or `frappe.ui.toolbar.get_values()` |
| `console.log` | Remove (or `frappe.log` for debug) |
| `alert()` / `confirm()` | `frappe.msgprint()` / `frappe.confirm()` |
| Inline event handlers (`onclick`) | `frappe.ui.Dialog` events or jQuery `.on()` |

### ERPNext Standards to Follow (from erpnext-syntax-* skills)

- `frm.set_value()` — never `frm.doc.field = value`
- `frappe.call()` — never raw `fetch` for Frappe endpoints
- `frappe.throw()` — never `alert()` or raw `throw`
- `frappe.show_alert()` — never `console.log` for user feedback
- `@frappe.whitelist()` — on every server method called from client
- `frappe.has_permission()` — before write operations
- Parameterized queries — never string concatenation in SQL
- `frm.refresh_field()` — after programmatic field changes

---

## Stage 4 — Audit Output (MANDATORY)

After generating code, audit against these checklists:

### Visual Fidelity Audit
- [ ] Every prototype component has a Frappe equivalent in the code
- [ ] Layout matches prototype (spacing, alignment, responsive behavior)
- [ ] Colors use Frappe CSS variables where possible
- [ ] Custom colors preserved in feature CSS
- [ ] States handled (empty, loading, error)
- [ ] Icons match (Font Awesome classes preserved)

### ERPNext Standards Audit (from erpnext-code-validator)
- [ ] No `frm.doc.field = value` — use `frm.set_value()`
- [ ] No raw `fetch` — use `frappe.call()`
- [ ] No `alert()`/`confirm()` — use `frappe.msgprint()`/`frappe.confirm()`
- [ ] All server methods have `@frappe.whitelist()`
- [ ] Permission checks on write operations
- [ ] No `frappe.db.commit()` in controllers
- [ ] Parameterized SQL queries
- [ ] `frm.refresh_field()` after field changes

### Code Quality Audit (from clean-code)
- [ ] Functions ≤ 40 lines
- [ ] Files ≤ 500 lines (split if larger)
- [ ] No duplicated logic
- [ ] Nesting ≤ 3 levels
- [ ] Intent-revealing names

### Security Audit
- [ ] No XSS (user input sanitized before HTML injection)
- [ ] No SQL injection
- [ ] Permission-gated API methods
- [ ] No sensitive data in client-side code

### Audit Output
```
AUDIT RESULTS
=============
Visual fidelity:  [X/Y checks passed]
ERPNext standards: [X/Y checks passed]
Code quality:      [X/Y checks passed]
Security:          [X/Y checks passed]

Issues found:
  1. [MUST-FIX] [description]
  2. [SHOULD-FIX] [description]
  3. [OPTIONAL] [description]
```

If MUST-FIX issues found → fix them before proceeding to Stage 5.

---

## Stage 5 — Approval (MANDATORY)

### Output Summary

```
IMPLEMENTATION SUMMARY
======================
Prototype: [path]
Layout type: [dialog/page/form-section]

Files created:
  1. [path] — [purpose] (~N lines)
  2. [path] — [purpose] (~N lines)

Files modified:
  1. [path] — [what changed]

API endpoints:
  1. [method] — [description]

hooks.py changes:
  - [changes or "none"]

Audit: [all passed / N issues fixed]

CSS variables: [N Frappe native / N custom preserved]
States handled: [list]
```

**Ask**: "Implementation ready. Review the files and approve to finalize?"

---

## What to Do (Step-by-Step)

1) **Read** the prototype file completely
2) **Stage 1**: Extract every component, JS pattern, data source, state
3) **Stage 2**: Map each to Frappe equivalent, plan files
4) **Ask approval** on the implementation map before writing code
5) **Stage 3**: Generate all files
6) **Stage 4**: Audit output (visual + ERPNext + quality + security)
7) **Fix** any MUST-FIX issues from audit
8) **Stage 5**: Show summary, ask final approval

---

## Deep Mode Extras

When `mode=deep`:
- Run `/clean-code` on all generated files
- Run `/create-test` for API endpoints
- Generate implementation annotations in code (comments linking back to prototype sections)
- Create a migration checklist (if DocType schema changes needed)

---

## Examples

### Example 1: Dialog prototype → frappe.ui.Dialog
```
/implement-prototype docs/prototypes/estimation_template_picker_prototype.html target_module=accubuild_bidding
```
Generates:
- `accubuild_bidding/doctype/bid_item/bid_item.js` — `frm.add_custom_button` + dialog
- `accubuild_bidding/utils/estimation_picker.py` — `@frappe.whitelist()` data methods
- `accubuild_core/public/css/estimation_picker.css` — component styles

### Example 2: Full page prototype → Frappe Page
```
/implement-prototype docs/prototypes/action_center_prototype.html target_module=accubuild_project mode=deep
```
Generates:
- `accubuild_project/page/action_center/action_center.js` + `.py` + `.json` + `.css`
- `accubuild_project/utils/action_center_api.py` — data endpoints
- `accubuild_project/tests/test_action_center.py` — API tests (deep mode)
- hooks.py update (add page CSS)

### Example 3: Child table override → Client Script
```
/implement-prototype docs/prototypes/terms_editor_prototype.html target_doctype="Bid"
```
Generates:
- Additions to `accubuild_bidding/doctype/bid/bid.js` — grid override + editor dialog
- `accubuild_core/public/css/terms_editor.css` — grid styles
- `accubuild_bidding/utils/terms_api.py` — template fetch/save methods

---

## Checklist

- [ ] Prototype fully read and audited
- [ ] Every component mapped to Frappe equivalent
- [ ] Implementation map approved before writing code
- [ ] All files generated with ERPNext standards
- [ ] Visual fidelity audit passed
- [ ] ERPNext standards audit passed
- [ ] Code quality audit passed
- [ ] Security audit passed
- [ ] MUST-FIX issues resolved
- [ ] Summary shown and approved

---

**Last Updated**: 2026-02-28
**Version**: 1.0
**Dependencies**: create-prototype (upstream), clean-code + create-test (deep mode)
**Integrates with**: erpnext-syntax-clientscripts, erpnext-syntax-controllers, erpnext-code-validator, clean-code

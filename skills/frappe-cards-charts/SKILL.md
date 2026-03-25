---
name: frappe-cards-charts
description: Wrap native Frappe charts in modern card containers using Frappe's own CSS variables—respecting native components while improving layout consistency.
---

## Role
You're a senior full-stack teammate specializing in UI that respects Frappe's design system.

## Input
Request: $ARGUMENTS

Helpful inputs:
- Target: Frappe UI page, Desk dashboard, Doctype form, or Web template
- Page/route/doctype/report name
- Screenshots or DOM selectors (if available)

## Non-negotiable UI policy
- **Cards:** Use Frappe CSS variables and existing frappeui components when available
- **Charts:** Keep native Frappe chart styling (colors, fonts, behavior)
  - Only adjust container, spacing, header placement
  - Never override chart colors unless explicitly requested
- **No duplication:** Reuse existing frappeui components first

## Global Rules
- Evidence > guesses: locate the real render path first
- Use Frappe CSS variables (not hard-coded colors)
- Check for existing components before creating new ones
- Do not implement until user approves the plan

---

# Gates (Phase 1: Plan only)

## Gate 0 — Intake & Target Surface
Do:
- Identify the target surface:
  A) Frappe UI (Vue 3 + Tailwind) custom page
  B) Desk dashboard / workspace / report page
  C) Doctype form (client script / form dashboard)
  D) Web template (Jinja)
- Identify exact location: route/page name/doctype/report/widget

Done when:
- Target surface + entry point is named.

Output:
```
Target: [surface type]
Location: [page/route/doctype]
Entry Point: [file path]
Gate: PASS
```

---

## Gate 0.5 — Frappe Design System Check (NEW)
Do:
- Read config.md for project-specific design patterns
- Check for existing frappeui components:
  - `frappeui/src/components/Card.vue` (if using frappeui)
  - `frappe/public/js/lib/frappe/ui/Card.vue` (legacy)
  - Search: `grep -r "Card" src/**/*.vue` or `grep -r "card" *.vue`
- Check Frappe version for available components:
  - v15+: `frappeui` has `Card`, `CardHeader`, `CardContent`
  - v14: May need custom implementation
- Identify existing card patterns in project

Done when:
- You know whether to reuse existing components or create new ones

Output:
```
Frappe Version: [v14/v15/v16]
Existing Card Component: [yes/no + path]
Project Card Patterns: [list found]
Recommended Approach: [reuse/create]
Gate: PASS
```

---

## Gate 1 — Framework Grounding
Do:
- Confirm the safe customization point:
  - Frappe UI: Use frappeui Card components or Vue wrappers
  - Desk: scoped CSS with Frappe variables
  - Doctype form: HTML field wrapper
  - Web: template include with Frappe classes
- Confirm chart type:
  - Frappe Charts (SVG) / dashboard chart / report chart / custom

Done when:
- You can point to the correct place to implement wrappers

Output:
```
Customization Point: [file/component]
Chart Type: [type]
Framework: [Vue/Desk/Jinja]
Gate: PASS
```

---

## Gate 2 — Home Search (project conventions)
Do:
- Search repo for:
  - `tailwind.config.js` or `tailwind.config.ts`
  - `package.json` for `frappeui` or `@frappeui` dependency
  - Existing card patterns: `grep -r "rounded-lg border" src/`
  - Existing chart wrappers: `grep -r "chart-container" src/`
  - CSS inclusion points: `hooks.py` app_include_css
- Check for design tokens/CSS variables usage

Done when:
- You have a shortlist of relevant files and existing patterns

Output:
```
Tailwind: [yes/no + path]
FrappeUI: [version/installed]
Existing Cards: [list paths]
Existing Chart Wrappers: [list paths]
CSS Variables Used: [yes/no + examples]
Gate: PASS
```

---

## Gate 3 — Choose Approach

### Approach A (Preferred): Reuse frappeui Card Component
**When:** Frappe UI v15+ with frappeui installed

```vue
<script setup>
import { Card, CardHeader, CardContent, CardTitle } from 'frappeui'
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle>{{ title }}</CardTitle>
    </CardHeader>
    <CardContent>
      <div ref="chartContainer"></div>
    </CardContent>
  </Card>
</template>
```

**Pros:**
- Native component, consistent updates
- Already styled with Frapse variables
- Accessible by default

**Cons:**
- Requires frappeui dependency

### Approach B: Vue + Tailwind with Frappe Variables
**When:** Frappe UI without frappeui Card component

```vue
<template>
  <div class="frappe-card">
    <div class="frappe-card-header">
      <h3 class="frappe-card-title">{{ title }}</h3>
    </div>
    <div class="frappe-card-content">
      <div ref="chartContainer"></div>
    </div>
  </div>
</template>

<style scoped>
.frappe-card {
  border: 1px solid var(--border-color);
  border-radius: var(--modal-radius);
  background: var(--bg-color);
  box-shadow: var(--shadow-sm);
}
.frappe-card-header {
  padding: var(--margin-md);
  padding-bottom: 0;
}
.frappe-card-title {
  font-size: var(--text-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--text-color);
}
.frappe-card-content {
  padding: var(--margin-md);
}
</style>
```

### Approach C: Desk/Non-Vue (Scoped CSS)
**When:** Legacy Desk, dashboards, client scripts

```html
<div class="my-dashboard">
  <div class="frappe-card">
    <div class="frappe-card-header">
      <h3 class="frappe-card-title">Chart Title</h3>
    </div>
    <div class="frappe-card-content">
      <!-- Chart renders here -->
    </div>
  </div>
</div>

<style>
/* Scoped to your container only */
.my-dashboard .frappe-card {
  border: 1px solid var(--border-color);
  border-radius: var(--modal-radius);
  background: var(--bg-color);
}
.my-dashboard .frappe-card-header {
  padding: 1rem;
  padding-bottom: 0;
}
.my-dashboard .frappe-card-title {
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--text-color);
  margin: 0;
}
.my-dashboard .frappe-card-content {
  padding: 1rem;
}
</style>
```

Done when:
- Approach selected with clear reasons

Output:
```
Recommended Approach: [A/B/C]
Reasoning: [why]
Risk Level: [low/medium/high]
Gate: PASS
```

---

## Gate 4 — Frappe CSS Variables Reference
**Always use Frappe variables, not hard-coded values:**

```css
/* Frappe Design Tokens (CSS Variables) */
/* Spacing */
--margin-sm: 0.5rem;
--margin-md: 1rem;
--margin-lg: 1.5rem;

/* Colors (Light Mode) */
--bg-color: #fff;
--fg-color: #1f2937;
--border-color: #e5e7eb;
--text-color: #1f2937;
--text-muted: #6b7280;

/* Colors (Dark Mode - when applicable) */
--bg-color: #1f2937;
--fg-color: #f9fafb;
--border-color: #374151;
--text-color: #f9fafb;

/* Shapes */
--modal-radius: 0.5rem;
--btn-radius: 0.375rem;

/* Shadows */
--shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
--shadow-md: 0 4px 6px rgba(0,0,0,0.1);

/* Typography */
--text-sm: 0.875rem;
--text-base: 1rem;
--text-lg: 1.125rem;
--text-xl: 1.25rem;
--font-weight-normal: 400;
--font-weight-medium: 500;
--font-weight-semibold: 600;
```

**Usage Example:**
```css
/* ❌ Wrong - hard-coded */
.my-card {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 16px;
}

/* ✅ Correct - Frappe variables */
.my-card {
  background: var(--bg-color);
  border: 1px solid var(--border-color);
  border-radius: var(--modal-radius);
  padding: var(--margin-md);
}
```

Done when:
- Card spec uses Frappe variables only

Output:
```
CSS Variables: [list used]
Dark Mode Support: [yes/no]
Gate: PASS
```

---

## Gate 5 — Chart-in-Card Rules
Do:
- Confirm chart rendering and decide minimal tweaks:
  - Keep chart's default styles intact (colors, fonts)
  - If chart has built-in title:
    - Option 1: Hide chart title, use card header
    - Option 2: Keep both if design requires
- Ensure responsive:
  - Chart container width 100%
  - Height via CSS variable or aspect ratio

**Chart Title Handling (Scoped Only):**
```css
/* Hide chart title within card only */
.frappe-card .chart-container .chart-title,
.frappe-card .chart-container .title {
  display: none;
}
```

Done when:
- Chart stays native, card controls layout

Output:
```
Chart Title Handling: [hide/keep/both]
Responsive Strategy: [description]
Gate: PASS
```

---

## Gate 6 — Files to Change + Build Notes
Do:
- List exact file paths and change summary
- Include build commands if Tailwind changes needed
- Include rollback steps

Done when:
- Implementation is clear and reversible

Output:
```
Files:
- [path] → [change summary]

Build Commands:
- [if applicable]

Rollback:
- [steps]
Gate: PASS
```

---

## Gate 7 — Test & Verification Plan
Do:
- Provide concrete checklist:
  - Visual: spacing, alignment, hover, empty state
  - Responsive: mobile/tablet/desktop
  - Theme: light/dark mode (if applicable)
  - Performance: no layout shift, fast render

Done when:
- Tests are actionable

Output:
```
Verification:
- [ ] Visual inspection
- [ ] Responsive test
- [ ] Theme test
- [ ] Performance check
Gate: PASS
```

---

# Output Format (Phase 1)

```
## Gate Results

Gate 0 — Target Surface: PASS
- Target: [surface]
- Location: [path]

Gate 0.5 — Design System: PASS
- Frappe Version: [v15+]
- Existing Components: [yes/no]
- Recommendation: [reuse/create]

Gate 1 — Framework: PASS
- Customization Point: [path]
- Chart Type: [type]

Gate 2 — Home Search: PASS
- Tailwind: [yes/no]
- Existing Patterns: [list]

Gate 3 — Approach: PASS
- Selected: [A/B/C]
- Reasoning: [why]

Gate 4 — CSS Variables: PASS
- Variables Used: [list]

Gate 5 — Chart Rules: PASS
- Title Handling: [hide/keep]

Gate 6 — Files: PASS
- [file paths]

Gate 7 — Tests: PASS
- [checklist]

## Implementation Plan
[Summary of changes]

## Risk Register
| Risk | Likelihood | Impact | Mitigation |
|------|------------|-------|-----------|

## Rollback Plan
[Steps]

## Approval
Reply 'approve' to implement.
```

---

# Phase 2 — Implement (only after approval)

1. Implement approved plan
2. Use Frappe CSS variables only
3. Keep chart styles native
4. Run `/clean-code <touched files>`
5. Output summary with verification steps

---

# Snippet Library (Frappe-Native)

## Vue Component (with Frappe variables)
```vue
<template>
  <div class="chart-card">
    <div class="chart-card-header" v-if="title || $slots.actions">
      <div class="chart-card-title-row">
        <h3 class="chart-card-title">{{ title }}</h3>
        <div class="chart-card-actions">
          <slot name="actions"></slot>
        </div>
      </div>
      <p v-if="description" class="chart-card-description">{{ description }}</p>
    </div>
    <div class="chart-card-content">
      <slot></slot>
    </div>
  </div>
</template>

<script setup>
defineProps({
  title: String,
  description: String
})
</script>

<style scoped>
.chart-card {
  border: 1px solid var(--border-color);
  border-radius: var(--modal-radius);
  background: var(--bg-color);
  box-shadow: var(--shadow-sm);
}

.chart-card-header {
  padding: var(--margin-md);
  padding-bottom: 0;
  display: flex;
  flex-direction: column;
  gap: var(--margin-sm);
}

.chart-card-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--margin-md);
}

.chart-card-title {
  font-size: var(--text-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--text-color);
  margin: 0;
}

.chart-card-description {
  font-size: var(--text-sm);
  color: var(--text-muted);
  margin: 0;
}

.chart-card-actions {
  display: flex;
  gap: var(--margin-sm);
}

.chart-card-content {
  padding: var(--margin-md);
}

/* Empty state */
.chart-card-content:empty::before {
  content: "No data";
  color: var(--text-muted);
}
</style>
```

## Tailwind Classes (with Frappe colors)
```html
<!-- Use Frappe color palette from CSS variables -->
<div class="rounded-lg border bg-white dark:bg-gray-900 shadow-sm"
     style="border-color: var(--border-color);">
  <div class="flex flex-col space-y-1.5 p-6">
    <h3 class="text-lg font-semibold leading-none tracking-tight"
        style="color: var(--text-color);">
      {{ title }}
    </h3>
  </div>
  <div class="p-6 pt-0">
    <!-- Chart here -->
  </div>
</div>
```

## Scoped CSS (Desk-safe)
```css
/* Use within your container only */
.my-page .chart-card {
  border: 1px solid var(--border-color);
  border-radius: var(--modal-radius);
  background: var(--bg-color);
  box-shadow: var(--shadow-sm);
}

.my-page .chart-card-header {
  padding: var(--margin-md);
  padding-bottom: 0;
}

.my-page .chart-card-title {
  font-size: var(--text-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--text-color);
  margin: 0;
}

.my-page .chart-card-content {
  padding: var(--margin-md);
}

/* Hide native chart title if using card header */
.my-page .chart-card .frappe-chart .title {
  display: none;
}
```

## Button Styles (Frappe native)
```css
/* Primary button */
.chart-card .btn-primary {
  background: var(--primary-color);
  color: var(--primary-fg-color);
  border: none;
  border-radius: var(--btn-radius);
  padding: var(--margin-sm) var(--margin-md);
}

/* Secondary button */
.chart-card .btn-secondary {
  background: transparent;
  color: var(--text-color);
  border: 1px solid var(--border-color);
  border-radius: var(--btn-radius);
  padding: var(--margin-sm) var(--margin-md);
}

/* Hover states */
.chart-card .btn-primary:hover {
  background: var(--primary-color-hover);
}

.chart-card .btn-secondary:hover {
  background: var(--bg-color-hover);
}
```

---

**Last Updated**: 2026-01-23
**Version**: 2.0 (Frappe-native with CSS variables)

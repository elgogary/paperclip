# Slide Design Reference

Rules the generator MUST follow when producing HTML slides. Read this before generating any presentation.

## Anti-AI-Slop Rules (MANDATORY)

NEVER use:
- Inter, Roboto, Arial, system fonts — these scream "AI generated"
- Purple gradients on white backgrounds
- Predictable symmetric layouts
- Cookie-cutter card grids with identical spacing
- Flat solid-color backgrounds

ALWAYS use:
- Distinctive fonts: Outfit, Space Grotesk, Bricolage Grotesque, Playfair Display, JetBrains Mono
- CSS custom properties for all colors
- Atmospheric backgrounds: radial glows, dot grids, diagonal lines, gradient meshes
- Staggered animations with animation-delay
- Asymmetric layouts, overlap, diagonal flow

## Slide Engine

Slides use scroll-snap in a viewport-height container:
```html
<div class="deck">
  <section class="slide slide--title">...</section>
  <section class="slide slide--content">...</section>
</div>
```
```css
.deck { height: 100dvh; overflow-y: auto; scroll-snap-type: y mandatory; }
.slide { height: 100dvh; scroll-snap-align: start; display: flex; flex-direction: column; }
```

## Typography Scale (Slides are 2-3x larger than pages)

| Element | Size | Weight |
|---------|------|--------|
| Display (title slide) | clamp(48px, 10vw, 120px) | 800 |
| Heading (section) | clamp(32px, 6vw, 64px) | 700 |
| Subheading | clamp(20px, 3vw, 32px) | 600 |
| Body | clamp(16px, 2vw, 22px) | 400 |
| Caption/label | clamp(11px, 1.2vw, 14px) | 500 |

## Color System

Define module colors as CSS variables:
```css
:root {
  --primary: #2490ef;
  --c-bid: #2490ef;      --c-bid-bg: #edf5ff;
  --c-contract: #0891b2; --c-contract-bg: #ecfeff;
  --c-wbs: #7c3aed;      --c-wbs-bg: #f5f0ff;
  --c-finance: #059669;  --c-finance-bg: #ecfdf5;
  --c-procurement: #db2777; --c-procurement-bg: #fdf2f8;
  --c-change: #ea580c;   --c-change-bg: #fff7ed;
}
```

## Background Atmosphere

```css
/* Radial glow */
background-image: radial-gradient(ellipse at 50% 0%, var(--accent-dim) 0%, transparent 60%);

/* Dot grid */
background-image: radial-gradient(circle, var(--border) 1px, transparent 1px);
background-size: 24px 24px;

/* Noise texture */
background-image: url("data:image/svg+xml,..."); /* inline SVG noise */
```

## Slide Types

### 1. Title Slide
- Full-bleed dark gradient background
- Display-size text, centered or left-heavy
- Metadata row with icons (date, company, confidential)
- Subtle accent glow behind title

### 2. Section Divider
- Gradient background using module color
- Large icon circle (80px, Font Awesome)
- Section name + one-line description
- Minimal — no bullets, no tables

### 3. Content (Steps)
- Colored header bar (module color)
- Numbered step circles with descriptions
- Auto/gate/block badges for process annotations
- Max 6 steps per slide

### 4. Content (Cards)
- 2 or 3-column grid
- Each card: colored top border, icon, title, description
- Cards should NOT be identical in size — vary content density

### 5. Table Slide
- Colored header row matching module
- Alternating row backgrounds
- Keep to 5-7 rows max per slide

### 6. Stats/KPI Slide
- 3-4 large number boxes
- Big number + small label below
- Each stat uses different module color

### 7. Flow Diagram
- Horizontal flow boxes with arrows
- Each box colored by its module
- Icon + label + optional sub-label
- Keep to 5-7 boxes max

### 8. Closing Slide
- Dark gradient (match title slide)
- "Ready to get started?" or CTA
- Contact details with icons

## Compositional Variety (MANDATORY)

Consecutive slides MUST vary layout:
- Centered → Left-heavy → Split → Right-heavy → Full-bleed
- Never 3 identical layouts in a row
- Alternate dense slides with spacious ones

## Badges

```css
.badge-gate { background: #fef3c7; color: #92400e; border: 1px solid #fbbf24; }
.badge-auto { background: #dcfce7; color: #166534; border: 1px solid #86efac; }
.badge-block { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }
```

## Font Loading

```html
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
```

## Icons

Use Font Awesome 6 via CDN:
```html
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
```

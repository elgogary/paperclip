"""HTML Presentation Generator — produces beautiful slide decks as self-contained HTML.

Uses the AccuBuild design system: CSS variables, Font Awesome icons, color-coded modules,
card grids, flow arrows, badges, stat boxes, atmospheric backgrounds.

The HTML can be:
- Opened directly in a browser (scroll-snap slide navigation)
- Printed to PDF (Chrome: File > Print > Save as PDF)
- Converted to PPTX via LibreOffice
"""

import json
from pathlib import Path
from textwrap import dedent

# ── Theme presets ──────────────────────────────────────────────────────

THEMES = {
    "accubuild": {
        "name": "AccuBuild",
        "font_display": "Outfit",
        "font_body": "Outfit",
        "font_mono": "Space Mono",
        "primary": "#2490ef",
        "heading": "#1e293b",
        "text": "#334155",
        "muted": "#94a3b8",
        "page_bg": "#f0f4f8",
        "card_bg": "#ffffff",
        "border": "#e2e8f0",
        "title_gradient": "linear-gradient(135deg, #1e293b 0%, #0f172a 50%, #1e3a5f 100%)",
        "modules": {
            "bid": {"color": "#2490ef", "bg": "#edf5ff", "icon": "fa-gavel"},
            "contract": {"color": "#0891b2", "bg": "#ecfeff", "icon": "fa-file-signature"},
            "wbs": {"color": "#7c3aed", "bg": "#f5f0ff", "icon": "fa-sitemap"},
            "finance": {"color": "#059669", "bg": "#ecfdf5", "icon": "fa-money-bill-wave"},
            "procurement": {"color": "#db2777", "bg": "#fdf2f8", "icon": "fa-cart-shopping"},
            "change": {"color": "#ea580c", "bg": "#fff7ed", "icon": "fa-rotate"},
            "inventory": {"color": "#0d9488", "bg": "#f0fdfa", "icon": "fa-warehouse"},
            "item": {"color": "#6366f1", "bg": "#eef2ff", "icon": "fa-cubes"},
        },
    },
    "midnight": {
        "name": "Midnight Galaxy",
        "font_display": "Bricolage Grotesque",
        "font_body": "Outfit",
        "font_mono": "JetBrains Mono",
        "primary": "#a78bfa",
        "heading": "#f1f5f9",
        "text": "#cbd5e1",
        "muted": "#64748b",
        "page_bg": "#0f172a",
        "card_bg": "#1e293b",
        "border": "rgba(255,255,255,0.08)",
        "title_gradient": "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)",
        "modules": {
            "bid": {"color": "#818cf8", "bg": "rgba(129,140,248,0.1)", "icon": "fa-gavel"},
            "contract": {"color": "#22d3ee", "bg": "rgba(34,211,238,0.1)", "icon": "fa-file-signature"},
            "wbs": {"color": "#c084fc", "bg": "rgba(192,132,252,0.1)", "icon": "fa-sitemap"},
            "finance": {"color": "#34d399", "bg": "rgba(52,211,153,0.1)", "icon": "fa-money-bill-wave"},
            "procurement": {"color": "#fb7185", "bg": "rgba(251,113,133,0.1)", "icon": "fa-cart-shopping"},
            "change": {"color": "#fb923c", "bg": "rgba(251,146,60,0.1)", "icon": "fa-rotate"},
            "inventory": {"color": "#2dd4bf", "bg": "rgba(45,212,191,0.1)", "icon": "fa-warehouse"},
            "item": {"color": "#a78bfa", "bg": "rgba(167,139,250,0.1)", "icon": "fa-cubes"},
        },
    },
    "steel": {
        "name": "Steel Engineering",
        "font_display": "Space Grotesk",
        "font_body": "Outfit",
        "font_mono": "JetBrains Mono",
        "primary": "#0284c7",
        "heading": "#0f172a",
        "text": "#334155",
        "muted": "#64748b",
        "page_bg": "#f8fafc",
        "card_bg": "#ffffff",
        "border": "#e2e8f0",
        "title_gradient": "linear-gradient(135deg, #0c4a6e 0%, #0f172a 50%, #164e63 100%)",
        "modules": {
            "bid": {"color": "#0284c7", "bg": "#e0f2fe", "icon": "fa-gavel"},
            "contract": {"color": "#0891b2", "bg": "#ecfeff", "icon": "fa-file-signature"},
            "wbs": {"color": "#4f46e5", "bg": "#eef2ff", "icon": "fa-sitemap"},
            "finance": {"color": "#059669", "bg": "#ecfdf5", "icon": "fa-money-bill-wave"},
            "procurement": {"color": "#be185d", "bg": "#fce7f3", "icon": "fa-cart-shopping"},
            "change": {"color": "#c2410c", "bg": "#fff7ed", "icon": "fa-rotate"},
            "inventory": {"color": "#0d9488", "bg": "#f0fdfa", "icon": "fa-warehouse"},
            "item": {"color": "#4338ca", "bg": "#e0e7ff", "icon": "fa-cubes"},
        },
    },
}


def _css_vars(theme: dict) -> str:
    """Generate CSS custom properties from theme."""
    lines = []
    for key in ("primary", "heading", "text", "muted", "page_bg", "card_bg", "border"):
        css_name = key.replace("_", "-")
        lines.append(f"  --{css_name}: {theme[key]};")
    for mod_name, mod in theme.get("modules", {}).items():
        lines.append(f"  --c-{mod_name}: {mod['color']};")
        lines.append(f"  --c-{mod_name}-bg: {mod['bg']};")
    return "\n".join(lines)


def _render_slide_title(slide: dict, theme: dict) -> str:
    title = slide.get("title", "")
    subtitle = slide.get("subtitle", "")
    meta_items = slide.get("meta", [])
    meta_html = ""
    if meta_items:
        items = "".join(f'<span><i class="fas {m.get("icon","fa-circle")}"></i> {m.get("text","")}</span>' for m in meta_items)
        meta_html = f'<div class="meta">{items}</div>'
    brand = slide.get("brand_line", "")
    return f'''<section class="slide slide--title" style="background:{theme["title_gradient"]}">
  <h1 class="slide__display">{title}</h1>
  <div class="slide__subtitle">{subtitle}</div>
  {meta_html}
  <div class="slide__brand">{brand}</div>
</section>'''


def _render_slide_section(slide: dict, theme: dict) -> str:
    title = slide.get("title", "")
    desc = slide.get("description", "")
    module = slide.get("module", "bid")
    mod = theme.get("modules", {}).get(module, {"color": "#2490ef", "bg": "#edf5ff", "icon": "fa-circle"})
    return f'''<section class="slide slide--section" style="background:linear-gradient(135deg, {mod["bg"]} 0%, #fff 100%)">
  <div class="icon-circle" style="background:{mod["color"]};color:white"><i class="fas {mod["icon"]}"></i></div>
  <h2>{title}</h2>
  <p>{desc}</p>
</section>'''


def _render_slide_steps(slide: dict, theme: dict) -> str:
    title = slide.get("title", "")
    module = slide.get("module", "bid")
    mod = theme.get("modules", {}).get(module, {"color": "#2490ef", "bg": "#edf5ff"})
    tag = slide.get("tag", module.title())
    steps = slide.get("steps", [])
    steps_html = ""
    for i, step in enumerate(steps, 1):
        badge = ""
        if step.get("badge"):
            b = step["badge"]
            badge = f' <span class="badge badge-{b}">{b}</span>'
        steps_html += f'''<div class="step-row">
  <div class="step-num" style="background:{mod["color"]}">{i}</div>
  <div class="step-body"><h4>{step.get("title","")}</h4><p>{step.get("desc","")}{badge}</p></div>
</div>\n'''
    return f'''<section class="slide slide--content">
  <div class="slide-header">
    <span class="tag" style="background:{mod["bg"]};color:{mod["color"]}">{tag}</span>
    <h3>{title}</h3>
  </div>
  <div class="slide-body"><div class="steps">{steps_html}</div></div>
  <div class="slide-footer"><span>{theme["name"]}</span><span></span></div>
</section>'''


def _render_slide_cards(slide: dict, theme: dict) -> str:
    title = slide.get("title", "")
    module = slide.get("module", "bid")
    mod = theme.get("modules", {}).get(module, {"color": "#2490ef", "bg": "#edf5ff"})
    tag = slide.get("tag", module.title())
    cards = slide.get("cards", [])
    cols = slide.get("columns", 3)
    cards_html = ""
    for card in cards:
        c_mod = theme.get("modules", {}).get(card.get("module", module), mod)
        cards_html += f'''<div class="card" style="border-top:3px solid {c_mod["color"]}">
  <div class="card-icon" style="background:{c_mod["bg"]};color:{c_mod["color"]}"><i class="fas {card.get("icon", c_mod.get("icon","fa-circle"))}"></i></div>
  <h4>{card.get("title","")}</h4>
  <p>{card.get("desc","")}</p>
</div>\n'''
    return f'''<section class="slide slide--content">
  <div class="slide-header">
    <span class="tag" style="background:{mod["bg"]};color:{mod["color"]}">{tag}</span>
    <h3>{title}</h3>
  </div>
  <div class="slide-body"><div class="cards" style="grid-template-columns:repeat({cols},1fr)">{cards_html}</div></div>
  <div class="slide-footer"><span>{theme["name"]}</span><span></span></div>
</section>'''


def _render_slide_table(slide: dict, theme: dict) -> str:
    title = slide.get("title", "")
    module = slide.get("module", "bid")
    mod = theme.get("modules", {}).get(module, {"color": "#2490ef", "bg": "#edf5ff"})
    tag = slide.get("tag", module.title())
    headers = slide.get("headers", [])
    rows = slide.get("rows", [])
    th_html = "".join(f"<th>{h}</th>" for h in headers)
    rows_html = ""
    for row in rows:
        cells = "".join(f"<td>{c}</td>" for c in row)
        rows_html += f"<tr>{cells}</tr>\n"
    return f'''<section class="slide slide--content">
  <div class="slide-header">
    <span class="tag" style="background:{mod["bg"]};color:{mod["color"]}">{tag}</span>
    <h3>{title}</h3>
  </div>
  <div class="slide-body">
    <table class="styled-table"><thead><tr style="background:{mod["color"]}">{th_html}</tr></thead><tbody>{rows_html}</tbody></table>
  </div>
  <div class="slide-footer"><span>{theme["name"]}</span><span></span></div>
</section>'''


def _render_slide_flow(slide: dict, theme: dict) -> str:
    title = slide.get("title", "")
    module = slide.get("module", "bid")
    mod = theme.get("modules", {}).get(module, {"color": "#2490ef", "bg": "#edf5ff"})
    tag = slide.get("tag", module.title())
    boxes = slide.get("boxes", [])
    flow_html = ""
    for i, box in enumerate(boxes):
        b_mod = theme.get("modules", {}).get(box.get("module", module), mod)
        flow_html += f'''<div class="flow-box" style="background:{b_mod["bg"]};color:{b_mod["color"]}">
  <i class="fas {box.get("icon", b_mod.get("icon","fa-circle"))}"></i><br>
  <strong>{box.get("label","")}</strong>
  {f'<br><span class="flow-sub">{box["sub"]}</span>' if box.get("sub") else ""}
</div>'''
        if i < len(boxes) - 1:
            flow_html += '<span class="flow-arrow"><i class="fas fa-arrow-right"></i></span>'
    extra = slide.get("extra_html", "")
    return f'''<section class="slide slide--content">
  <div class="slide-header">
    <span class="tag" style="background:{mod["bg"]};color:{mod["color"]}">{tag}</span>
    <h3>{title}</h3>
  </div>
  <div class="slide-body">
    <div class="flow">{flow_html}</div>
    {extra}
  </div>
  <div class="slide-footer"><span>{theme["name"]}</span><span></span></div>
</section>'''


def _render_slide_stats(slide: dict, theme: dict) -> str:
    title = slide.get("title", "")
    module = slide.get("module", "bid")
    mod = theme.get("modules", {}).get(module, {"color": "#2490ef", "bg": "#edf5ff"})
    tag = slide.get("tag", module.title())
    stats = slide.get("stats", [])
    stats_html = ""
    for stat in stats:
        s_mod = theme.get("modules", {}).get(stat.get("module", module), mod)
        stats_html += f'''<div class="stat">
  <span class="num" style="color:{s_mod["color"]}">{stat.get("value","0")}</span>
  <span class="label">{stat.get("label","")}</span>
</div>\n'''
    extra = slide.get("extra_html", "")
    return f'''<section class="slide slide--content">
  <div class="slide-header">
    <span class="tag" style="background:{mod["bg"]};color:{mod["color"]}">{tag}</span>
    <h3>{title}</h3>
  </div>
  <div class="slide-body">
    <div class="stats">{stats_html}</div>
    {extra}
  </div>
  <div class="slide-footer"><span>{theme["name"]}</span><span></span></div>
</section>'''


def _render_slide_closing(slide: dict, theme: dict) -> str:
    title = slide.get("title", "Ready to Get Started?")
    subtitle = slide.get("subtitle", "")
    meta_items = slide.get("meta", [])
    meta_html = ""
    if meta_items:
        items = "".join(f'<span><i class="fas {m.get("icon","fa-circle")}"></i> {m.get("text","")}</span>' for m in meta_items)
        meta_html = f'<div class="meta" style="margin-top:40px">{items}</div>'
    brand = slide.get("brand_line", "")
    return f'''<section class="slide slide--title" style="background:{theme["title_gradient"]}">
  <h1 style="font-size:clamp(32px,6vw,56px)">{title}</h1>
  <div class="slide__subtitle">{subtitle}</div>
  {meta_html}
  <div class="slide__brand">{brand}</div>
</section>'''


RENDERERS = {
    "title": _render_slide_title,
    "section": _render_slide_section,
    "steps": _render_slide_steps,
    "cards": _render_slide_cards,
    "table": _render_slide_table,
    "flow": _render_slide_flow,
    "stats": _render_slide_stats,
    "closing": _render_slide_closing,
}


def generate_html_presentation(data: dict, output_path: Path) -> dict:
    """Generate a beautiful HTML slide deck from structured JSON data.

    Args:
        data: {
            "theme": "accubuild" | "midnight" | "steel" | {custom theme dict},
            "slides": [ { "type": "title|section|steps|cards|table|flow|stats|closing", ...} ]
        }
        output_path: Where to save the HTML file.

    Returns dict with metadata.
    """
    theme_key = data.get("theme", "accubuild")
    if isinstance(theme_key, dict):
        theme = theme_key
    else:
        theme = THEMES.get(theme_key, THEMES["accubuild"])

    slides = data.get("slides", [])
    slides_html = ""
    for i, slide in enumerate(slides):
        slide_type = slide.get("type", "steps")
        renderer = RENDERERS.get(slide_type, _render_slide_steps)
        slides_html += renderer(slide, theme) + "\n"

    font_display = theme.get("font_display", "Outfit")
    font_body = theme.get("font_body", "Outfit")
    font_mono = theme.get("font_mono", "Space Mono")
    fonts_url = f"https://fonts.googleapis.com/css2?family={font_display.replace(' ','+')}:wght@400;500;600;700;800&family={font_body.replace(' ','+')}:wght@400;500;600;700&family={font_mono.replace(' ','+')}:wght@400;700&display=swap"

    html = f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{data.get("title", "Presentation")}</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
<link href="{fonts_url}" rel="stylesheet">
<style>
:root {{
  --font-display: '{font_display}', system-ui, sans-serif;
  --font-body: '{font_body}', system-ui, sans-serif;
  --font-mono: '{font_mono}', 'SF Mono', monospace;
{_css_vars(theme)}
}}

* {{ box-sizing: border-box; margin: 0; padding: 0; }}
body {{ font-family: var(--font-body); background: var(--page-bg); color: var(--text); }}

/* ── Slide Engine ── */
.deck {{ height: 100dvh; overflow-y: auto; scroll-snap-type: y mandatory; scroll-behavior: smooth; }}
.slide {{ height: 100dvh; scroll-snap-align: start; overflow: hidden; position: relative; display: flex; flex-direction: column; }}

/* ── Title Slide ── */
.slide--title {{ justify-content: center; align-items: center; text-align: center; padding: 80px; color: white; }}
.slide__display {{ font-family: var(--font-display); font-size: clamp(48px, 8vw, 96px); font-weight: 800; letter-spacing: -2px; line-height: 0.95; margin-bottom: 16px; }}
.slide__subtitle {{ font-size: clamp(16px, 2.5vw, 24px); color: rgba(255,255,255,0.6); max-width: 600px; }}
.meta {{ display: flex; gap: 32px; justify-content: center; font-size: 13px; color: rgba(255,255,255,0.4); margin-top: 32px; }}
.meta span {{ display: flex; align-items: center; gap: 8px; }}
.slide__brand {{ position: absolute; bottom: 40px; left: 0; right: 0; text-align: center; font-size: 12px; color: rgba(255,255,255,0.3); }}

/* ── Section Divider ── */
.slide--section {{ justify-content: center; align-items: center; text-align: center; padding: 80px; }}
.icon-circle {{ width: 80px; height: 80px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 32px; margin-bottom: 24px; }}
.slide--section h2 {{ font-family: var(--font-display); font-size: clamp(32px, 6vw, 52px); font-weight: 800; color: var(--heading); margin-bottom: 12px; }}
.slide--section p {{ font-size: 18px; color: var(--muted); max-width: 600px; }}

/* ── Content Slide ── */
.slide--content {{ padding: 0; }}
.slide-header {{ padding: 24px 48px; border-bottom: 2px solid var(--border); display: flex; align-items: center; gap: 16px; }}
.tag {{ font-size: 11px; font-weight: 700; padding: 4px 14px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px; }}
.slide-header h3 {{ font-family: var(--font-display); font-size: 24px; font-weight: 700; color: var(--heading); }}
.slide-body {{ padding: 32px 48px; flex: 1; overflow-y: auto; }}
.slide-footer {{ padding: 12px 48px; border-top: 1px solid var(--border); display: flex; justify-content: space-between; font-size: 11px; color: var(--muted); }}

/* ── Steps ── */
.steps {{ display: flex; flex-direction: column; gap: 14px; }}
.step-row {{ display: flex; gap: 16px; align-items: flex-start; }}
.step-num {{ width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700; color: white; flex-shrink: 0; }}
.step-body h4 {{ font-size: 15px; font-weight: 600; color: var(--heading); }}
.step-body p {{ font-size: 13px; color: var(--muted); margin-top: 2px; }}

/* ── Cards ── */
.cards {{ display: grid; gap: 16px; }}
.card {{ background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px; padding: 20px; }}
.card-icon {{ width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 18px; margin-bottom: 10px; }}
.card h4 {{ font-size: 14px; font-weight: 700; color: var(--heading); margin-bottom: 6px; }}
.card p {{ font-size: 12px; color: var(--muted); line-height: 1.5; }}

/* ── Flow ── */
.flow {{ display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 0; padding: 20px 0; }}
.flow-box {{ padding: 14px 20px; border-radius: 12px; font-size: 13px; font-weight: 600; text-align: center; min-width: 110px; }}
.flow-box i {{ font-size: 18px; display: block; margin-bottom: 6px; }}
.flow-sub {{ font-size: 10px; font-weight: 400; opacity: 0.7; }}
.flow-arrow {{ font-size: 18px; color: var(--muted); margin: 0 6px; }}

/* ── Table ── */
.styled-table {{ width: 100%; border-collapse: separate; border-spacing: 0; border-radius: 10px; overflow: hidden; border: 1px solid var(--border); font-size: 13px; }}
.styled-table thead th {{ padding: 12px 16px; text-align: left; font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: white; }}
.styled-table tbody td {{ padding: 10px 16px; border-top: 1px solid var(--border); }}
.styled-table tbody tr:nth-child(even) {{ background: rgba(0,0,0,0.02); }}

/* ── Stats ── */
.stats {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 16px; }}
.stat {{ text-align: center; padding: 24px; background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px; }}
.stat .num {{ font-family: var(--font-display); font-size: 42px; font-weight: 800; display: block; }}
.stat .label {{ font-size: 12px; color: var(--muted); margin-top: 4px; display: block; }}

/* ── Badges ── */
.badge {{ display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; border-radius: 6px; font-size: 10px; font-weight: 600; }}
.badge-gate {{ background: #fef3c7; color: #92400e; border: 1px solid #fbbf24; }}
.badge-auto {{ background: #dcfce7; color: #166534; border: 1px solid #86efac; }}
.badge-block {{ background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }}

/* ── Print ── */
@media print {{
  .deck {{ height: auto; overflow: visible; scroll-snap-type: none; }}
  .slide {{ page-break-after: always; height: 100vh; }}
}}

/* ── Atmospheric background ── */
.slide--content::before {{
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background-image: radial-gradient(ellipse at 30% 0%, rgba(36,144,239,0.03) 0%, transparent 50%);
  pointer-events: none;
  z-index: -1;
}}
</style>
</head>
<body>
<div class="deck">
{slides_html}
</div>
<script>
// Keyboard navigation
document.addEventListener('keydown', e => {{
  const deck = document.querySelector('.deck');
  const h = window.innerHeight;
  if (e.key === 'ArrowDown' || e.key === ' ' || e.key === 'PageDown') {{ e.preventDefault(); deck.scrollBy(0, h); }}
  if (e.key === 'ArrowUp' || e.key === 'PageUp') {{ e.preventDefault(); deck.scrollBy(0, -h); }}
  if (e.key === 'Home') {{ e.preventDefault(); deck.scrollTo(0, 0); }}
  if (e.key === 'End') {{ e.preventDefault(); deck.scrollTo(0, deck.scrollHeight); }}
}});
</script>
</body>
</html>'''

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(html, encoding="utf-8")

    return {
        "slides": len(slides),
        "theme": theme.get("name", "custom"),
        "size": len(html),
    }

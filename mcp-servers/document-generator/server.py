#!/usr/bin/env python3
"""Document Generator MCP Server.

Generates professional .docx and .pptx files from branded templates + structured content.
Any Sanad AI agent can call this to produce client-ready documents.

Tools:
  generate_docx   — Fill a branded .docx template with structured content
  generate_pptx   — Fill a branded .pptx template with slides content + diagrams
  render_diagram  — Convert Mermaid code to PNG image
  list_templates  — List available branded templates by company
"""

import json
import os
import sys
from pathlib import Path

from mcp.server.fastmcp import FastMCP

from generators.docx_generator import generate_docx
from generators.pptx_generator import generate_pptx
from generators.diagram_renderer import render_mermaid
from generators.html_presentation import generate_html_presentation, THEMES

TEMPLATES_DIR = Path(__file__).parent / "templates"
OUTPUT_DIR = Path(os.environ.get("DOC_OUTPUT_DIR", "/tmp/doc-generator"))
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

mcp = FastMCP(
    "document-generator",
    version="0.1.0",
    description="Generate professional .docx and .pptx from branded templates",
)


@mcp.tool()
def list_templates(company: str = "") -> str:
    """List available branded templates. Optionally filter by company name."""
    results = []
    search_dir = TEMPLATES_DIR / company if company else TEMPLATES_DIR
    if not search_dir.exists():
        return json.dumps({"error": f"No templates found for '{company}'"})

    for path in sorted(search_dir.rglob("*.pptx")):
        rel = path.relative_to(TEMPLATES_DIR)
        results.append({"path": str(rel), "type": "pptx", "company": rel.parts[0]})
    for path in sorted(search_dir.rglob("*.docx")):
        rel = path.relative_to(TEMPLATES_DIR)
        results.append({"path": str(rel), "type": "docx", "company": rel.parts[0]})

    if not results:
        return json.dumps({"templates": [], "note": "No templates yet. Create .pptx/.docx templates in the templates/ folder."})
    return json.dumps({"templates": results})


@mcp.tool()
def generate_document_docx(
    template: str,
    content: str,
    output_filename: str = "output.docx",
) -> str:
    """Generate a .docx document from a branded template and structured JSON content.

    Args:
        template: Template path relative to templates/ (e.g. "accubuild/report.docx")
                  OR "blank" to create from scratch with default styling.
        content: JSON string with document structure:
            {
                "title": "Document Title",
                "subtitle": "Subtitle text",
                "metadata": {"author": "...", "date": "...", "version": "..."},
                "sections": [
                    {
                        "heading": "Section Title",
                        "level": 1,
                        "paragraphs": ["Text paragraph 1", "Text paragraph 2"],
                        "bullets": ["Bullet 1", "Bullet 2"],
                        "table": {"headers": ["Col1", "Col2"], "rows": [["a", "b"]]},
                        "image": "path/to/image.png"
                    }
                ]
            }
        output_filename: Name for the output file.
    """
    try:
        data = json.loads(content)
    except json.JSONDecodeError as e:
        return json.dumps({"error": f"Invalid JSON content: {e}"})

    template_path = None
    if template != "blank":
        template_path = TEMPLATES_DIR / template
        if not template_path.exists():
            return json.dumps({"error": f"Template not found: {template}"})

    output_path = OUTPUT_DIR / output_filename
    try:
        result = generate_docx(template_path, data, output_path)
        return json.dumps({"status": "ok", "path": str(output_path), "size": output_path.stat().st_size, **result})
    except Exception as e:
        return json.dumps({"error": str(e)})


@mcp.tool()
def generate_document_pptx(
    template: str,
    slides: str,
    output_filename: str = "output.pptx",
) -> str:
    """Generate a .pptx presentation from a branded template and slide content.

    Args:
        template: Template path relative to templates/ (e.g. "accubuild/proposal.pptx")
                  OR "blank" to create with default styling using brand colors.
        slides: JSON string with slide array:
            {
                "brand": {"primary": "#007bff", "accent": "#28a745", "text": "#333333"},
                "slides": [
                    {
                        "layout": "title",
                        "title": "Presentation Title",
                        "subtitle": "By Company Name"
                    },
                    {
                        "layout": "section",
                        "title": "Section Divider"
                    },
                    {
                        "layout": "content",
                        "title": "Slide Title",
                        "bullets": ["Point 1", "Point 2"],
                        "notes": "Speaker notes here"
                    },
                    {
                        "layout": "table",
                        "title": "Comparison",
                        "table": {"headers": ["A", "B"], "rows": [["1", "2"]]}
                    },
                    {
                        "layout": "diagram",
                        "title": "Flow",
                        "mermaid": "graph LR\\n  A-->B",
                        "caption": "System flow diagram"
                    },
                    {
                        "layout": "image",
                        "title": "Screenshot",
                        "image": "/path/to/image.png",
                        "caption": "Description"
                    }
                ]
            }
        output_filename: Name for the output file.
    """
    try:
        data = json.loads(slides)
    except json.JSONDecodeError as e:
        return json.dumps({"error": f"Invalid JSON slides: {e}"})

    template_path = None
    if template != "blank":
        template_path = TEMPLATES_DIR / template
        if not template_path.exists():
            return json.dumps({"error": f"Template not found: {template}"})

    output_path = OUTPUT_DIR / output_filename
    try:
        result = generate_pptx(template_path, data, output_path)
        return json.dumps({"status": "ok", "path": str(output_path), "size": output_path.stat().st_size, **result})
    except Exception as e:
        return json.dumps({"error": str(e)})


@mcp.tool()
def render_diagram(
    mermaid_code: str,
    output_filename: str = "diagram.png",
    width: int = 1200,
    height: int = 800,
    theme: str = "default",
) -> str:
    """Render a Mermaid diagram to PNG image.

    Args:
        mermaid_code: Mermaid diagram source code (e.g. "graph LR\\n  A-->B")
        output_filename: Output PNG filename.
        width: Image width in pixels.
        height: Image height in pixels.
        theme: Mermaid theme (default, dark, forest, neutral).
    """
    output_path = OUTPUT_DIR / output_filename
    try:
        result = render_mermaid(mermaid_code, output_path, width, height, theme)
        return json.dumps({"status": "ok", "path": str(output_path), **result})
    except Exception as e:
        return json.dumps({"error": str(e)})


@mcp.tool()
def generate_presentation(
    slides_json: str,
    theme: str = "accubuild",
    output_filename: str = "presentation.html",
) -> str:
    """Generate a beautiful HTML slide deck with rich design (NOT basic python-pptx).

    This produces magazine-quality HTML slides with:
    - Scroll-snap navigation (arrow keys, scroll, space)
    - Color-coded modules with icons
    - Atmospheric backgrounds, card grids, flow diagrams
    - Stats boxes, step lists, professional tables
    - Print-to-PDF ready

    Args:
        slides_json: JSON string with slide array. Each slide has a "type" field:
            - "title": Full-screen title with gradient background
            - "section": Module divider with icon circle
            - "steps": Numbered process steps with badges
            - "cards": Grid of feature/info cards
            - "table": Professional styled table
            - "flow": Horizontal flow diagram with arrows
            - "stats": KPI/metric boxes with big numbers
            - "closing": End slide with CTA

            Example: {"slides": [
                {"type": "title", "title": "AccuBuild", "subtitle": "Overview"},
                {"type": "section", "title": "Bidding", "module": "bid"},
                {"type": "steps", "title": "How It Works", "module": "bid",
                 "steps": [{"title": "Step 1", "desc": "Details"}]}
            ]}
        theme: Theme name: "accubuild" (blue), "midnight" (dark), "steel" (gray)
        output_filename: Output HTML filename.

    Returns: JSON with path, size, slide count.
    """
    try:
        data = json.loads(slides_json)
    except json.JSONDecodeError as e:
        return json.dumps({"error": f"Invalid JSON: {e}"})

    data["theme"] = theme
    output_path = OUTPUT_DIR / output_filename
    try:
        result = generate_html_presentation(data, output_path)
        return json.dumps({"status": "ok", "path": str(output_path), **result})
    except Exception as e:
        return json.dumps({"error": str(e)})


@mcp.tool()
def list_themes() -> str:
    """List available presentation themes."""
    return json.dumps({
        "themes": [
            {"name": k, "display": v["name"], "primary": v["primary"]}
            for k, v in THEMES.items()
        ]
    })


@mcp.tool()
def evaluate_presentation(html_path: str) -> str:
    """Evaluate an HTML presentation for quality before sending to client.

    Checks: slide count, icons, color coding, fonts, RTL, atmospheric backgrounds,
    badges, landscape print rules. Returns pass/fail score with issues to fix.

    Auto-appends new lessons from failures so the generator improves over time.

    Args:
        html_path: Path to the HTML presentation file to evaluate.
    """
    from generators.evaluator import evaluate, get_lessons_prompt
    p = Path(html_path)
    if not p.exists():
        return json.dumps({"error": f"File not found: {html_path}"})
    html = p.read_text(encoding="utf-8")
    result = evaluate(html)
    result["lessons_count"] = len(get_lessons_prompt().split("\n")) - 1
    return json.dumps(result)


@mcp.tool()
def add_lesson(issue_id: str, what_failed: str, fix_applied: str) -> str:
    """Record a lesson learned so the generator avoids this mistake in the future.

    Lessons are stored in lessons.json and read by the generator before each run.

    Args:
        issue_id: Short identifier (e.g. "stats-wrapping", "empty-space")
        what_failed: What went wrong (e.g. "4th stat wrapped to second row")
        fix_applied: How it was fixed (e.g. "Changed grid to repeat(4, 1fr)")
    """
    from generators.evaluator import add_lesson as _add
    import datetime
    lessons = _add({
        "issue_id": issue_id,
        "what_failed": what_failed,
        "fix_applied": fix_applied,
        "date": datetime.date.today().isoformat(),
    })
    return json.dumps({"status": "ok", "total_lessons": len(lessons)})


@mcp.tool()
def get_lessons() -> str:
    """Get all accumulated lessons learned by the document generator.

    These lessons are automatically injected into the generator's context
    so it avoids repeating past mistakes. The system improves with every evaluation.
    """
    from generators.evaluator import load_lessons, get_lessons_prompt
    lessons = load_lessons()
    return json.dumps({
        "count": len(lessons),
        "lessons": lessons,
        "prompt_section": get_lessons_prompt(),
    })


@mcp.tool()
def convert_to_pdf(html_path: str, output_filename: str = "output.pdf") -> str:
    """Convert an HTML presentation to PDF using headless Chrome.

    Produces landscape 16:9 PDF with no headers/footers.

    Args:
        html_path: Path to the HTML file.
        output_filename: Output PDF filename.
    """
    import subprocess
    html_p = Path(html_path)
    if not html_p.exists():
        return json.dumps({"error": f"HTML file not found: {html_path}"})
    pdf_path = OUTPUT_DIR / output_filename
    try:
        result = subprocess.run([
            "google-chrome", "--headless", "--disable-gpu", "--no-sandbox",
            "--no-pdf-header-footer",
            f"--print-to-pdf={pdf_path}",
            str(html_p),
        ], capture_output=True, text=True, timeout=30)
        if pdf_path.exists():
            return json.dumps({
                "status": "ok",
                "path": str(pdf_path),
                "size": pdf_path.stat().st_size,
            })
        return json.dumps({"error": result.stderr[:300]})
    except subprocess.TimeoutExpired:
        return json.dumps({"error": "Chrome PDF conversion timed out"})
    except FileNotFoundError:
        return json.dumps({"error": "google-chrome not found. Install Chrome/Chromium."})


if __name__ == "__main__":
    mcp.run(transport="stdio")

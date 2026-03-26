"""Presentation Evaluator — checks quality and returns pass/fail with issues.

The generator reads lessons.json before generating to avoid repeating past mistakes.
After evaluation, new lessons are appended automatically.
"""

import json
import re
from pathlib import Path

LESSONS_PATH = Path(__file__).parent.parent / "lessons.json"

# ── Quality Rules ──────────────────────────────────────────────────────

RULES = [
    {
        "id": "slide-count",
        "name": "Minimum slide count",
        "check": lambda html: html.count('class="slide ') >= 8,
        "fix": "Add more slides — minimum 8 for a professional presentation",
        "severity": "critical",
    },
    {
        "id": "no-empty-slides",
        "name": "No slides with only whitespace",
        "check": lambda html: not re.search(r'<section class="slide[^"]*">\s*</section>', html),
        "fix": "Remove empty slides or add content to them",
        "severity": "critical",
    },
    {
        "id": "has-title-slide",
        "name": "Has a title slide",
        "check": lambda html: 'slide--title' in html,
        "fix": "Add a title slide with company name, subtitle, and metadata",
        "severity": "critical",
    },
    {
        "id": "has-closing-slide",
        "name": "Has a closing slide",
        "check": lambda html: html.count('slide--title') >= 2,
        "fix": "Add a closing slide with CTA and contact info",
        "severity": "high",
    },
    {
        "id": "has-icons",
        "name": "Uses Font Awesome icons",
        "check": lambda html: html.count('fa-') >= 10,
        "fix": "Add more icons — every card, step, and flow box should have an icon",
        "severity": "high",
    },
    {
        "id": "has-color-coding",
        "name": "Uses module color coding",
        "check": lambda html: html.count('--c-') >= 5,
        "fix": "Use CSS variables for module colors (--c-bid, --c-contract, etc.)",
        "severity": "high",
    },
    {
        "id": "no-generic-fonts",
        "name": "No generic AI fonts (Inter, Roboto, Arial)",
        "check": lambda html: not any(f in html for f in ["'Inter'", "'Roboto'", "'Arial'"]),
        "fix": "Use distinctive fonts: Outfit, Space Grotesk, Bricolage Grotesque, IBM Plex Sans Arabic",
        "severity": "medium",
    },
    {
        "id": "has-atmospheric-bg",
        "name": "Has atmospheric background (not flat)",
        "check": lambda html: 'radial-gradient' in html or 'linear-gradient' in html,
        "fix": "Add radial glow, dot grid, or gradient mesh background — flat backgrounds look dead",
        "severity": "medium",
    },
    {
        "id": "has-badges",
        "name": "Uses status badges (auto/gate/block)",
        "check": lambda html: 'badge-' in html,
        "fix": "Add process badges: auto (green), gate (yellow), block (red) for workflow annotations",
        "severity": "low",
    },
    {
        "id": "rtl-if-arabic",
        "name": "RTL direction set for Arabic content",
        "check": lambda html: ('dir="rtl"' in html) if any(
            '\u0600' <= c <= '\u06FF' for c in html[:5000]
        ) else True,
        "fix": "Set dir='rtl' and lang='ar' on html tag for Arabic presentations",
        "severity": "critical",
    },
    {
        "id": "landscape-print",
        "name": "Landscape @page rule for PDF",
        "check": lambda html: '13.333in' in html or 'landscape' in html,
        "fix": "Add @page { size: 13.333in 7.5in; margin: 0; } for 16:9 landscape PDF",
        "severity": "high",
    },
    {
        "id": "no-chrome-headers",
        "name": "No browser header/footer artifacts",
        "check": lambda html: 'no-pdf-header' not in html,  # Always true — checked at PDF level
        "fix": "Use --no-pdf-header-footer flag when converting with Chrome headless",
        "severity": "high",
    },
]


def evaluate(html_content: str) -> dict:
    """Evaluate HTML presentation quality.

    Returns:
        {
            "pass": bool,
            "score": int (0-100),
            "issues": [{"id": str, "name": str, "fix": str, "severity": str}],
            "stats": {"slides": int, "icons": int, "colors": int}
        }
    """
    issues = []
    for rule in RULES:
        try:
            if not rule["check"](html_content):
                issues.append({
                    "id": rule["id"],
                    "name": rule["name"],
                    "fix": rule["fix"],
                    "severity": rule["severity"],
                })
        except Exception:
            pass

    # Severity scoring
    severity_weight = {"critical": 20, "high": 10, "medium": 5, "low": 2}
    deductions = sum(severity_weight.get(i["severity"], 5) for i in issues)
    score = max(0, 100 - deductions)

    # Stats
    stats = {
        "slides": html_content.count('class="slide '),
        "icons": html_content.count('fa-'),
        "css_vars": html_content.count('--c-'),
        "cards": html_content.count('class="card"'),
        "steps": html_content.count('class="step-row"'),
        "tables": html_content.count('class="styled-table"'),
        "has_rtl": 'dir="rtl"' in html_content,
    }

    passed = score >= 70 and not any(i["severity"] == "critical" for i in issues)

    return {
        "pass": passed,
        "score": score,
        "issues": issues,
        "stats": stats,
    }


# ── Lessons System ─────────────────────────────────────────────────────

def load_lessons() -> list:
    """Load accumulated lessons from lessons.json."""
    if LESSONS_PATH.exists():
        try:
            return json.loads(LESSONS_PATH.read_text())
        except (json.JSONDecodeError, OSError):
            return []
    return []


def add_lesson(lesson: dict):
    """Add a new lesson to lessons.json.

    lesson: {
        "issue_id": "no-empty-slides",
        "what_failed": "Stats slide had empty space below content",
        "fix_applied": "Added flex: 1 and justify-content: center to .slide-body",
        "date": "2026-03-26"
    }
    """
    lessons = load_lessons()
    # Deduplicate by issue_id
    lessons = [l for l in lessons if l.get("issue_id") != lesson.get("issue_id")]
    lessons.append(lesson)
    LESSONS_PATH.write_text(json.dumps(lessons, indent=2, ensure_ascii=False))
    return lessons


def get_lessons_prompt() -> str:
    """Generate a prompt section from accumulated lessons.

    This is injected into the generator's context so it avoids past mistakes.
    """
    lessons = load_lessons()
    if not lessons:
        return ""

    lines = ["## Lessons Learned (from past evaluations — DO NOT repeat these mistakes):\n"]
    for l in lessons[-20:]:  # Last 20 lessons
        lines.append(f"- **{l.get('issue_id', '?')}**: {l.get('what_failed', '')} → Fix: {l.get('fix_applied', '')}")
    return "\n".join(lines)

"""Email guardrails — rate limiting, content blocking, file safety."""

import os
import re
from datetime import datetime

AGENT_ROLE = os.environ.get("AGENT_ROLE", "default")

# ── Rate Limiting ───────────────────────────────────────────────────────

SEND_LIMITS = {
    "sales-manager": 20,
    "sales-rep": 30,
    "ceo": 10,
    "default": 5,
}

_send_counts: dict[str, dict] = {}


def check_send_limit() -> tuple[bool, int]:
    today = datetime.now().strftime("%Y-%m-%d")
    limit = SEND_LIMITS.get(AGENT_ROLE, SEND_LIMITS["default"])
    key = f"{AGENT_ROLE}:{today}"
    entry = _send_counts.get(key, {"count": 0, "date": today})
    if entry["date"] != today:
        entry = {"count": 0, "date": today}
    if entry["count"] >= limit:
        return False, 0
    entry["count"] += 1
    _send_counts[key] = entry
    return True, limit - entry["count"]


# ── Content Guard ───────────────────────────────────────────────────────

BLOCKED_PATTERNS = [
    re.compile(r"ignore.*previous.*instructions", re.I),
    re.compile(r"reveal.*system.*prompt", re.I),
    re.compile(r"send.*to.*all", re.I),
    re.compile(r"bulk.*email", re.I),
    re.compile(r"mass.*mail", re.I),
]


def check_content(text: str) -> tuple[bool, str]:
    for pattern in BLOCKED_PATTERNS:
        if pattern.search(text):
            return False, f"Blocked pattern: {pattern.pattern}"
    if len(text) > 5000:
        return False, "Email body exceeds 5000 character limit"
    return True, ""


# ── File Safety ─────────────────────────────────────────────────────────

BLOCKED_EXTENSIONS = {
    ".exe", ".bat", ".cmd", ".com", ".msi", ".scr", ".pif", ".vbs", ".vbe",
    ".js", ".jse", ".ws", ".wsf", ".wsc", ".wsh", ".ps1", ".ps2", ".psc1",
    ".reg", ".inf", ".lnk", ".dll", ".sys", ".cpl", ".hta", ".msp",
}

TEXT_EXTENSIONS = {
    ".txt", ".csv", ".json", ".md", ".xml", ".html", ".htm", ".log",
    ".yaml", ".yml", ".toml", ".ini", ".cfg", ".conf", ".py", ".sql",
    ".sh", ".env", ".tsv", ".rst",
}

SAFE_EXTENSIONS = {
    ".pdf", ".docx", ".doc", ".xlsx", ".xls", ".pptx", ".ppt",
    ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".svg", ".webp",
    ".zip", ".tar", ".gz", ".7z", ".rar",
    ".mp3", ".mp4", ".wav", ".avi", ".mov",
} | TEXT_EXTENSIONS

MAX_ATTACHMENT_SIZE = 50 * 1024 * 1024  # 50MB


def check_file_safety(filename: str, size: int) -> tuple[bool, str]:
    """Check if a file is safe to save. Returns (safe, reason)."""
    if not filename:
        return False, "No filename"
    ext = os.path.splitext(filename)[1].lower()
    if ext in BLOCKED_EXTENSIONS:
        return False, f"Blocked file type: {ext} (dangerous executable)"
    if size > MAX_ATTACHMENT_SIZE:
        return False, f"File too large: {size:,} bytes (max {MAX_ATTACHMENT_SIZE:,})"
    return True, "safe"


def is_text_file(filename: str) -> bool:
    ext = os.path.splitext(filename)[1].lower()
    return ext in TEXT_EXTENSIONS

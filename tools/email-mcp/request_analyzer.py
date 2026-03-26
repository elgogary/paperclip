"""Request analyzer — AI-powered classification and gap detection.

Two-pass analysis:
  1. classify_email() — fast qwen2.5-0.5b: category + priority + language
  2. analyze_deliverable() — glm-4.5-air: gaps + skills + deliverable type

The second pass runs only for "deliverable" type requests (SDD, reports,
documents, designs) to keep costs low for simple inquiries.
"""

import json
import logging
import urllib.request
import urllib.error

log = logging.getLogger("email-watcher.analyzer")

# ── Category Classification (fast, cheap) ─────────────────────────────────

_CATEGORY_PROMPT = """Classify this email. Reply with ONLY one JSON object, no extra text.

From: {from_name} <{from_addr}>
Subject: {subject}
Body: {body_short}

JSON:
{{"type": "deliverable|inquiry|spam", "category": "technical|sales|product|ceo|devops", "priority": "high|medium|low", "language": "en|ar|mixed"}}

Rules:
- type=deliverable if asking for a document, SDD, report, design, analysis, or any produced artifact
- type=inquiry if a question or support request
- type=spam if promotional or irrelevant
- priority=high if urgent/critical keywords present"""

PRIORITY_KEYWORDS_HIGH = ["urgent", "asap", "critical", "complaint", "مستعجل", "شكوى", "عاجل"]
PRIORITY_KEYWORDS_LOW = ["fyi", "newsletter", "update", "unsubscribe"]

DEFAULT_CLASSIFICATION = {
    "type": "inquiry",
    "category": "sales",
    "priority": "medium",
    "language": "en",
}


def classify_email(em: dict, litellm_url: str, litellm_key: str) -> dict:
    """Fast classification: type, category, priority, language."""
    result = dict(DEFAULT_CLASSIFICATION)

    # Keyword priority override (no LLM needed)
    text_lower = (em["subject"] + " " + em["body"][:200]).lower()
    if any(kw in text_lower for kw in PRIORITY_KEYWORDS_HIGH):
        result["priority"] = "high"
    elif any(kw in text_lower for kw in PRIORITY_KEYWORDS_LOW):
        result["priority"] = "low"

    # Language heuristic
    arabic_chars = sum(1 for c in em["subject"] + em["body"][:200] if "\u0600" <= c <= "\u06FF")
    total_alpha = sum(1 for c in em["subject"] + em["body"][:200] if c.isalpha())
    if total_alpha > 0 and arabic_chars / total_alpha > 0.3:
        result["language"] = "ar"
    elif arabic_chars > 0:
        result["language"] = "mixed"

    # LLM for type + category
    try:
        prompt = _CATEGORY_PROMPT.format(
            from_name=em.get("from_name", ""),
            from_addr=em.get("from_addr", ""),
            subject=em.get("subject", ""),
            body_short=em.get("body", "")[:400],
        )
        raw = _llm_call(prompt, litellm_url, litellm_key, model="qwen2.5-0.5b", max_tokens=60)
        parsed = _parse_json(raw)
        if parsed:
            result.update({k: parsed[k] for k in ("type", "category") if k in parsed})
            if "language" in parsed and result["language"] == "en":
                result["language"] = parsed["language"]
        log.info(f"Classified: {em['subject'][:50]!r} → type={result['type']} cat={result['category']}")
    except Exception as e:
        log.warning(f"Classification LLM failed: {e}. Using keyword defaults.")

    return result


# ── Deliverable Gap Analysis (thorough, smarter model) ────────────────────

_ANALYSIS_PROMPT = """You are an expert project analyst. Analyze this deliverable request and identify missing information.

From: {from_name} <{from_addr}>
Subject: {subject}
Body:
{body}

Attachments provided: {attachments}

Reply ONLY with a JSON object (no markdown):
{{
  "gaps": ["list specific missing items, empty array if request is complete"],
  "summary": "one-sentence summary of what is requested",
  "deliverable": "what the sender expects to receive back (e.g. SDD document, technical report)",
  "skills_needed": ["relevant skills from: sdd-writer, data-analysis, code-review, proposal-writer, technical-writer"],
  "modules_mentioned": ["list of system modules or features mentioned"]
}}

Be specific about gaps. Examples of good gap items:
- "Deadline or expected delivery date not specified"
- "Module depth level unclear (high-level overview vs detailed spec)"
- "Target audience for the document not stated"
- "Version or environment of the system not specified"
"""

DEFAULT_ANALYSIS = {
    "gaps": [],
    "summary": "",
    "deliverable": "",
    "skills_needed": [],
    "modules_mentioned": [],
}


def analyze_deliverable(em: dict, litellm_url: str, litellm_key: str) -> dict:
    """Deep analysis for deliverable requests: gaps + skills + summary."""
    result = dict(DEFAULT_ANALYSIS)
    result["summary"] = f"{em.get('from_addr', '')} requests: {em.get('subject', '')}"

    attachments_str = ", ".join(em.get("attachment_names", [])) or "none"

    prompt = _ANALYSIS_PROMPT.format(
        from_name=em.get("from_name", ""),
        from_addr=em.get("from_addr", ""),
        subject=em.get("subject", ""),
        body=em.get("body", "")[:1200],
        attachments=attachments_str,
    )

    try:
        raw = _llm_call(prompt, litellm_url, litellm_key, model="glm-4.5-air", max_tokens=400)
        parsed = _parse_json(raw)
        if parsed:
            for key in DEFAULT_ANALYSIS:
                if key in parsed:
                    result[key] = parsed[key]
            log.info(f"Analysis done: {len(result['gaps'])} gaps found, skills={result['skills_needed']}")
        else:
            log.warning("Analysis LLM returned unparseable JSON, using defaults")
    except Exception as e:
        log.warning(f"Analysis LLM failed: {e}. No gaps detected.")

    return result


# ── LLM helpers ───────────────────────────────────────────────────────────

def _llm_call(prompt: str, litellm_url: str, litellm_key: str, model: str, max_tokens: int) -> str:
    payload = json.dumps({
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": max_tokens,
        "temperature": 0.1,
    }).encode()

    headers = {"Content-Type": "application/json"}
    if litellm_key:
        headers["Authorization"] = f"Bearer {litellm_key}"

    req = urllib.request.Request(
        f"{litellm_url}/chat/completions",
        data=payload, headers=headers, method="POST",
    )
    resp = urllib.request.urlopen(req, timeout=20)
    data = json.loads(resp.read())
    return data["choices"][0]["message"]["content"].strip()


def _parse_json(raw: str) -> dict | None:
    """Parse JSON from LLM response, stripping markdown fences if present."""
    text = raw.strip()
    if text.startswith("```"):
        parts = text.split("```")
        text = parts[1] if len(parts) > 1 else parts[0]
        if text.startswith("json"):
            text = text[4:]
    try:
        result = json.loads(text.strip())
        return result if isinstance(result, dict) else None
    except json.JSONDecodeError:
        # Try to find first { ... } block
        start = text.find("{")
        end = text.rfind("}") + 1
        if start >= 0 and end > start:
            try:
                return json.loads(text[start:end])
            except json.JSONDecodeError:
                pass
    return None

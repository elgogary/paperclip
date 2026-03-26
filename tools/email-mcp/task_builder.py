"""Paperclip task builder — creates rich task descriptions for email requests.

Handles three cases:
  - Deliverable request (SDD, report, etc.): rich description with skills + delivery instructions
  - Pending update: updates existing blocked task with new info from sender reply
  - Simple inquiry: standard task description
"""

import json
import logging
import urllib.error
import urllib.request

log = logging.getLogger("email-watcher.task-builder")

# Agent IDs in Paperclip
AGENT_IDS = {
    "sales":     "bc8af951-f733-4056-8cad-d7a3eaf7d2b1",
    "sales-rep": "c29b9eb8-b9fd-43e2-8cc4-3a92b1474e69",
    "technical": "ef98862e-95d8-42a7-b64a-8e198ebe2804",
    "ceo":       "cd67cd5c-aad7-4f0f-bf71-b87b21ae4c4e",
    "product":   "20454545-e38f-405a-8cca-28bc1ef06aa6",
    "devops":    "42b81baa-ea93-482d-821a-c6a87468eba8",
}

CATEGORY_TO_AGENT = {
    "technical": "technical",
    "product":   "product",
    "sales":     "sales",
    "ceo":       "ceo",
    "devops":    "devops",
}

DEFAULT_AGENT = "sales"
PRIORITY_MAP = {"high": "urgent", "medium": "high", "low": "medium"}

# ── Task Description Templates ────────────────────────────────────────────

_DELIVERABLE_TEMPLATE = """\
## Email Request — {deliverable}

**From:** {from_name} <{from_addr}>
**Subject:** {subject}
**Date:** {date}
**Language:** {language}
**IMAP ID:** {imap_id}

---

### Request Summary

{summary}

---

### Original Email

```
{body}
```

---

### Attachments Provided

{attachments_section}

---

### Skills to Use

{skills_section}

---

### Delivery Instructions

1. Read the full email using `read_email` tool (IMAP ID: `{imap_id}`)
2. Read any text attachments using `read_attachment_text` tool
3. Produce the requested {deliverable}
4. When complete, email the deliverable back to: **{from_addr}**
   - Use `send_email` tool with subject: `Re: {subject}`
   - Attach or include the deliverable content in the email body
5. Comment on this task when done
"""

_INQUIRY_TEMPLATE = """\
## Incoming Email — {category}

**From:** {from_name} <{from_addr}>
**Subject:** {subject}
**Date:** {date}
**Language:** {language}
**IMAP ID:** {imap_id}

---

### Email Body

```
{body}
```

---

### Instructions

1. Read the email using `read_email` tool (IMAP ID: `{imap_id}`)
2. Respond following Company Law principles (Ihsan, Sidq)
3. Reply in the sender's language ({language})
4. Delegate via subtask if needed
5. Comment on this task when done
"""

_PENDING_UPDATE_TEMPLATE = """\
## Clarification Received — {deliverable}

**From:** {from_name} <{from_addr}>
**Original Subject:** {original_subject}
**Clarification Date:** {date}
**Language:** {language}
**IMAP ID:** {imap_id}

---

### Clarification Provided

```
{body}
```

---

### Original Request Summary

{original_summary}

---

### Skills to Use

{skills_section}

---

### Delivery Instructions

1. Combine original request with this clarification
2. Read attachments if any using `read_attachment_text`
3. Produce the requested {deliverable}
4. Email deliverable back to: **{from_addr}**
5. Comment on this task when done
"""


# ── Public API ────────────────────────────────────────────────────────────

def build_deliverable_description(em: dict, classification: dict, analysis: dict) -> str:
    attachments_section = _format_attachments(em.get("attachment_names", []))
    skills_section = _format_skills(analysis.get("skills_needed", []))
    return _DELIVERABLE_TEMPLATE.format(
        deliverable=analysis.get("deliverable") or "document",
        from_name=em.get("from_name", ""),
        from_addr=em.get("from_addr", ""),
        subject=em.get("subject", ""),
        date=em.get("date", ""),
        language=classification.get("language", "en"),
        imap_id=em.get("imap_id", ""),
        summary=analysis.get("summary", em.get("subject", "")),
        body=em.get("body", "")[:2000],
        attachments_section=attachments_section,
        skills_section=skills_section,
    )


def build_inquiry_description(em: dict, classification: dict) -> str:
    return _INQUIRY_TEMPLATE.format(
        category=classification.get("category", "general"),
        from_name=em.get("from_name", ""),
        from_addr=em.get("from_addr", ""),
        subject=em.get("subject", ""),
        date=em.get("date", ""),
        language=classification.get("language", "en"),
        imap_id=em.get("imap_id", ""),
        body=em.get("body", "")[:2000],
    )


def build_pending_update_description(em: dict, pending: dict, analysis: dict) -> str:
    skills_section = _format_skills(analysis.get("skills_needed", pending.get("skills_needed", [])))
    return _PENDING_UPDATE_TEMPLATE.format(
        deliverable=pending.get("deliverable") or analysis.get("deliverable") or "document",
        from_name=em.get("from_name", ""),
        from_addr=em.get("from_addr", ""),
        original_subject=pending.get("original_subject", ""),
        date=em.get("date", ""),
        language=pending.get("language", "en"),
        imap_id=em.get("imap_id", ""),
        body=em.get("body", "")[:2000],
        original_summary=pending.get("summary", ""),
        skills_section=skills_section,
    )


def create_task(
    paperclip_url: str,
    company_id: str,
    title: str,
    description: str,
    agent_key: str,
    priority: str,
    project_id: str | None = None,
) -> str | None:
    """Create a Paperclip issue. Returns issue ID or None on failure."""
    agent_id = AGENT_IDS.get(agent_key, AGENT_IDS[DEFAULT_AGENT])
    body: dict = {
        "title": title,
        "description": description,
        "assigneeAgentId": agent_id,
        "priority": PRIORITY_MAP.get(priority, "high"),
        "status": "todo",
    }
    if project_id:
        body["projectId"] = project_id

    result = _api_post(paperclip_url, f"/companies/{company_id}/issues", body)
    issue_id = result.get("id")
    if not issue_id:
        log.error(f"Failed to create task: {result}")
        return None

    log.info(f"Created task {result.get('identifier', issue_id)}: {title[:60]}")
    return issue_id


def update_task_unblock(paperclip_url: str, task_id: str, comment: str) -> bool:
    """Unblock a pending task with a comment when clarification arrives."""
    result = _api_patch(paperclip_url, f"/issues/{task_id}", {
        "status": "todo",
        "comment": comment,
    })
    return "id" in result


# ── Internal helpers ──────────────────────────────────────────────────────

def _format_attachments(names: list[str]) -> str:
    if not names:
        return "_None provided_"
    return "\n".join(f"- `{name}`" for name in names)


def _format_skills(skills: list[str]) -> str:
    if not skills:
        return "_No specific skills required_"
    lines = []
    for skill in skills:
        lines.append(f"- `/{skill}` — use this skill to produce the deliverable")
    return "\n".join(lines)


def _api_post(base_url: str, path: str, body: dict) -> dict:
    return _api_call("POST", base_url, path, body)


def _api_patch(base_url: str, path: str, body: dict) -> dict:
    return _api_call("PATCH", base_url, path, body)


def _api_call(method: str, base_url: str, path: str, body: dict | None) -> dict:
    url = f"{base_url}/api{path}"
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(
        url, data=data,
        headers={"Content-Type": "application/json"} if data else {},
        method=method,
    )
    try:
        resp = urllib.request.urlopen(req, timeout=15)
        return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        err = e.read().decode() if e.fp else ""
        log.error(f"Paperclip {method} {path}: {e.code} {err[:200]}")
        return {"error": err}
    except Exception as e:
        log.error(f"Paperclip API error: {e}")
        return {"error": str(e)}

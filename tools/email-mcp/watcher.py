"""Email Watcher v2 — full pipeline: acknowledge > classify > task > track > deliver.

Flow per email:
1. Fetch unseen emails from INBOX
2. Auto-acknowledge: send immediate "received, processing" reply
3. AI-classify: category, priority, language
4. Create Paperclip task with email body + attachment list
5. Send task-assigned notification to sender
6. Mark email as seen ONLY after task succeeds

Usage:
  MAIL_USER=... MAIL_PASSWORD=... PAPERCLIP_COMPANY_ID=... python watcher.py
"""

import os
import sys
import json
import time
import imaplib
import smtplib
import ssl
import email
import logging
import urllib.request
from email.header import decode_header
from email.utils import parseaddr, formatdate
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("email-watcher")

# ── Config ──────────────────────────────────────────────────────────────

MAIL_HOST = os.environ.get("MAIL_HOST", "mail.acsprosys.com")
MAIL_IMAP_PORT = int(os.environ.get("MAIL_IMAP_PORT", "993"))
MAIL_SMTP_PORT = int(os.environ.get("MAIL_SMTP_PORT", "465"))
MAIL_USER = os.environ.get("MAIL_USER", "")
MAIL_PASSWORD = os.environ.get("MAIL_PASSWORD", "")

PAPERCLIP_URL = os.environ.get("PAPERCLIP_URL", "http://100.109.59.30:3100")
if not PAPERCLIP_URL.startswith(("http://", "https://")):
    raise ValueError(f"PAPERCLIP_URL must start with http:// or https://")
PAPERCLIP_COMPANY_ID = os.environ.get("PAPERCLIP_COMPANY_ID", "")

CHECK_INTERVAL = int(os.environ.get("CHECK_INTERVAL", "300"))

LITELLM_URL = os.environ.get("LITELLM_URL", "http://localhost:4010")
LITELLM_KEY = os.environ.get("LITELLM_KEY", "")
PAPERCLIP_API_KEY = os.environ.get("PAPERCLIP_API_KEY", "")

AGENT_IDS = {
    "sales": "bc8af951-f733-4056-8cad-d7a3eaf7d2b1",
    "sales-rep": "c29b9eb8-b9fd-43e2-8cc4-3a92b1474e69",
    "technical": "ef98862e-95d8-42a7-b64a-8e198ebe2804",
    "ceo": "cd67cd5c-aad7-4f0f-bf71-b87b21ae4c4e",
    "product": "20454545-e38f-405a-8cca-28bc1ef06aa6",
    "devops": "42b81baa-ea93-482d-821a-c6a87468eba8",
}

AGENT_NAMES = {
    "sales": "Marcus (Sales Manager)",
    "technical": "Tariq (Tech Lead)",
    "ceo": "Khaled (CEO)",
    "product": "Nina (Product Manager)",
    "devops": "Sam (DevOps)",
}

DEFAULT_AGENT = "sales"
PRIORITY_KEYWORDS_HIGH = ["urgent", "asap", "critical", "complaint"]
PRIORITY_KEYWORDS_LOW = ["fyi", "newsletter", "update", "unsubscribe"]

# 5 key routing facts extracted from knowledge/resources/company-profile.md
COMPANY_CONTEXT = (
    "Company: Optiflow Systems — Egyptian ERP company for construction/services in MENA. "
    "Products: custom ERPNext services and AccuBuild (construction SaaS). "
    "Route sales/pricing/demo/AccuBuild-demo inquiries → sales. "
    "Route technical/integration/API/architecture questions → technical. "
    "Route AccuBuild feature requests or bug reports → product. "
    "Route server/hosting/deployment/infrastructure issues → devops. "
    "Route partnerships/investments/legal/contracts → ceo. "
    "Mark as spam: newsletters, job applications, unrelated offers, automated notifications."
)


# ── Helpers ─────────────────────────────────────────────────────────────

def _decode(raw: str) -> str:
    if not raw:
        return ""
    parts = decode_header(raw)
    return " ".join(
        d.decode(c or "utf-8", errors="replace") if isinstance(d, bytes) else d
        for d, c in parts
    )


def _get_imap():
    ctx = ssl.create_default_context()
    imap = imaplib.IMAP4_SSL(MAIL_HOST, MAIL_IMAP_PORT, ssl_context=ctx)
    imap.login(MAIL_USER, MAIL_PASSWORD)
    return imap


def _body(msg):
    if msg.is_multipart():
        for part in msg.walk():
            if part.get_content_type() == "text/plain":
                p = part.get_payload(decode=True)
                if p:
                    return p.decode(part.get_content_charset() or "utf-8", errors="replace")
    else:
        p = msg.get_payload(decode=True)
        if p:
            return p.decode(msg.get_content_charset() or "utf-8", errors="replace")
    return ""


def _attachments(msg):
    atts = []
    if not msg.is_multipart():
        return atts
    for part in msg.walk():
        fn = part.get_filename()
        if fn:
            data = part.get_payload(decode=True) or b""
            atts.append({"filename": _decode(fn), "content_type": part.get_content_type(), "size": len(data)})
    return atts


# ── SMTP Replies ────────────────────────────────────────────────────────

def _send_email(to: str, subject: str, body_text: str, in_reply_to: str = ""):
    msg = MIMEMultipart("alternative")
    msg["From"] = MAIL_USER
    msg["To"] = to
    msg["Subject"] = subject
    msg["Date"] = formatdate(localtime=True)
    if in_reply_to:
        msg["In-Reply-To"] = in_reply_to
        msg["References"] = in_reply_to

    msg.attach(MIMEText(body_text, "plain", "utf-8"))
    html = body_text.replace("\n", "<br>")
    msg.attach(MIMEText(
        f'<div style="font-family:sans-serif;font-size:14px;color:#333;line-height:1.6">'
        f'{html}<br><br>'
        f'<div style="border-top:1px solid #e0e0e0;padding-top:10px;font-size:11px;color:#999">'
        f'Sanad AI — Optiflow Systems</div></div>',
        "html", "utf-8",
    ))

    try:
        smtp = smtplib.SMTP_SSL(MAIL_HOST, MAIL_SMTP_PORT, timeout=15)
        smtp.login(MAIL_USER, MAIL_PASSWORD)
        smtp.send_message(msg)
        smtp.quit()
        log.info(f"Sent to {to}: {subject[:50]}")
        return True
    except Exception as e:
        log.error(f"SMTP failed {to}: {e}")
        return False


def send_ack(em):
    name = em["from_name"] or em["from_addr"].split("@")[0]
    _send_email(em["from_addr"], f"Re: {em['subject']}", f"""Hi {name},

Thank you for your email regarding "{em['subject']}".

We've received your request and our AI team is reviewing it now. Here's what happens next:

1. Your request is being analyzed and classified
2. It will be assigned to the appropriate team member
3. You'll receive a follow-up with your task reference number

Best regards,
Sanad AI Team — Optiflow Systems""", em.get("message_id", ""))


def send_assigned(em, task_ref, agent_name):
    name = em["from_name"] or em["from_addr"].split("@")[0]
    _send_email(em["from_addr"], f"Re: {em['subject']}", f"""Hi {name},

Your request has been assigned and is being worked on.

Task Reference: {task_ref}
Assigned To: {agent_name}

We'll notify you when the work is complete.

Best regards,
Sanad AI Team — Optiflow Systems""", em.get("message_id", ""))


# ── AI Classification ───────────────────────────────────────────────────

CLASSIFY_PROMPT = """Classify this email for Optiflow Systems. Reply with ONLY one word: sales, technical, product, devops, ceo, or spam.

Company context: {company_context}

From: {from_name} <{from_addr}>
Subject: {subject}
Attachments: {att}
Body: {body}

Category:"""


def _llm(prompt, max_tokens=10):
    payload = json.dumps({
        "model": "qwen2.5-0.5b",
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": max_tokens, "temperature": 0.0,
    }).encode()
    headers = {"Content-Type": "application/json"}
    if LITELLM_KEY:
        headers["Authorization"] = f"Bearer {LITELLM_KEY}"
    req = urllib.request.Request(f"{LITELLM_URL}/chat/completions", data=payload, headers=headers, method="POST")
    resp = urllib.request.urlopen(req, timeout=15)
    return json.loads(resp.read())["choices"][0]["message"]["content"].strip().lower()


def classify(em):
    valid = {"sales", "technical", "product", "devops", "ceo", "spam"}
    atts = em.get("attachments", [])
    att_str = ", ".join(f"{a['filename']} ({a['size']}B)" for a in atts) if atts else "none"

    try:
        raw = _llm(CLASSIFY_PROMPT.format(
            company_context=COMPANY_CONTEXT,
            from_name=em["from_name"], from_addr=em["from_addr"],
            subject=em["subject"], body=em["body"][:500], att=att_str,
        ))
        cat = DEFAULT_AGENT
        for w in raw.split():
            if w.strip(".,\"'") in valid:
                cat = w.strip(".,\"'")
                break
        log.info(f"Classified: {em['subject'][:40]} -> {cat}")
    except Exception as e:
        log.warning(f"LLM classify failed: {e}")
        cat = DEFAULT_AGENT

    text = (em["subject"] + " " + em["body"][:200]).lower()
    pri = "high" if any(k in text for k in PRIORITY_KEYWORDS_HIGH) else ("low" if any(k in text for k in PRIORITY_KEYWORDS_LOW) else "medium")

    ar = sum(1 for c in text if "\u0600" <= c <= "\u06FF")
    al = sum(1 for c in text if c.isalpha())
    lang = "ar" if al > 0 and ar / al > 0.3 else ("mixed" if ar > 0 else "en")

    return {"category": cat, "priority": pri, "language": lang, "attachments": att_str}


# ── Paperclip API ───────────────────────────────────────────────────────

def _api(method, path, body=None):
    url = f"{PAPERCLIP_URL}/api{path}"
    data = json.dumps(body).encode() if body else None
    headers = {"Content-Type": "application/json"} if data else {}
    if PAPERCLIP_API_KEY:
        headers["Authorization"] = f"Bearer {PAPERCLIP_API_KEY}"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        resp = urllib.request.urlopen(req, timeout=15)
        return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        log.error(f"API {method} {path}: {e.code}")
        return {"error": str(e.code)}
    except Exception as e:
        log.error(f"API error: {e}")
        return {"error": str(e)}


TASK_BODY = """## Incoming Email

**From:** {from_name} <{from_addr}>
**Subject:** {subject}
**Date:** {date}
**Category:** {category} | **Priority:** {priority} | **Language:** {language}

### Attachments
{att_section}

---

### Email Body

```
{body}
```

---

### Instructions

1. Read and understand the request
2. For document requests (SDD, SRS, proposal) use the `sdd-writer` skill
3. If unclear, draft a reply asking for clarification
4. Respond in sender's language ({language})
5. Comment on this task with progress

## Company Law Constraints

- **No prices**: Never quote prices — say "our team will prepare a custom quote"
- **No deadlines**: Do not promise delivery dates without a signed scope of work
- **Language match**: Reply in sender's language — Arabic if they wrote in Arabic
- **Low confidence**: If routing is uncertain, default to Sales and flag for human review
- **Legal/contracts**: Emails with legal threats, contracts, or financial terms → route to CEO, no substantive reply
"""


def create_task(em, cls):
    cat = cls["category"]
    if cat == "spam":
        log.info(f"Spam: {em['subject'][:40]}")
        return None

    agent_id = AGENT_IDS.get(cat, AGENT_IDS[DEFAULT_AGENT])
    atts = em.get("attachments", [])
    att_section = "\n".join(f"- **{a['filename']}** ({a['content_type']}, {a['size']:,} bytes)" for a in atts) if atts else "_No attachments_"

    body = TASK_BODY.format(
        from_name=em["from_name"], from_addr=em["from_addr"],
        subject=em["subject"], date=em["date"],
        category=cat, priority=cls["priority"], language=cls["language"],
        att_section=att_section, body=em["body"][:3000],
    )

    pri_map = {"high": "urgent", "medium": "high", "low": "medium"}
    result = _api("POST", f"/companies/{PAPERCLIP_COMPANY_ID}/issues", {
        "title": f"[Email] {em['subject'][:80]}",
        "body": body,
        "assigneeId": agent_id,
        "priority": pri_map.get(cls["priority"], "medium"),
        "labels": ["email", f"email-{cat}"],
    })

    issue_id = result.get("id")
    if not issue_id:
        log.error(f"Task creation failed: {result}")
        return None

    log.info(f"Task {issue_id[:8]} -> {cat}")
    _api("POST", f"/companies/{PAPERCLIP_COMPANY_ID}/agents/{agent_id}/wake", {
        "reason": f"Email from {em['from_addr']}: {em['subject'][:60]}",
        "issueId": issue_id,
    })

    # Create ephemeral chat session + send invite email
    _create_chat_invite(em, issue_id, agent_id, cat)

    return issue_id


AGENT_DISPLAY = {
    "sales": "Marcus (Sales Manager)",
    "sales-rep": "Wade (Sales Representative)",
    "technical": "Tariq (Tech Lead)",
    "ceo": "Khaled (CEO)",
    "product": "Nina (Product Manager)",
    "devops": "Sam (DevOps Engineer)",
}

CHAT_INVITE_BODY = """Hi {customer_name},

Thank you for your email. {agent_name} from Optiflow Systems is ready to assist you.

Instead of going back and forth over email, you can chat with {agent_first} in real-time:

  Chat now: {chat_url}

This link is valid for 60 minutes. After that, {agent_first} will follow up via email.

Best regards,
Sanad AI — Optiflow Systems
"""


def _create_chat_invite(em, issue_id, agent_id, category):
    """Create chat session and send invite email to customer."""
    try:
        chat = _api("POST", "/chat/sessions", {
            "companyId": PAPERCLIP_COMPANY_ID,
            "agentId": agent_id,
            "issueId": issue_id,
            "customerEmail": em["from_addr"],
            "customerName": em["from_name"],
            "ttlMinutes": 60,
        })
        token = chat.get("token")
        if not token:
            log.warning(f"Chat session creation failed: {chat}")
            return

        chat_url = f"{PAPERCLIP_URL}/chat/{token}"
        agent_name = AGENT_DISPLAY.get(category, "our team")
        agent_first = agent_name.split("(")[0].strip() if "(" in agent_name else agent_name

        # Send invite email
        import sys as _sys
        _sys.path.insert(0, os.path.dirname(__file__))
        from mail_client import get_smtp
        from email.mime.text import MIMEText
        from email.utils import formataddr

        body = CHAT_INVITE_BODY.format(
            customer_name=em["from_name"] or "there",
            agent_name=agent_name,
            agent_first=agent_first,
            chat_url=chat_url,
        )
        msg = MIMEText(body, "plain", "utf-8")
        msg["From"] = formataddr((agent_first, MAIL_USER))
        msg["To"] = em["from_addr"]
        msg["Subject"] = f"Re: {em['subject']}"
        if em.get("message_id"):
            msg["In-Reply-To"] = em["message_id"]
            msg["References"] = em["message_id"]

        smtp = get_smtp()
        smtp.sendmail(MAIL_USER, [em["from_addr"]], msg.as_string())
        smtp.quit()
        log.info(f"Chat invite sent to {em['from_addr']}: {chat_url}")
    except Exception as e:
        log.error(f"Chat invite failed: {e}")


def _mark_seen(mid):
    try:
        imap = _get_imap()
        imap.select("INBOX")
        imap.store(mid, "+FLAGS", "\\Seen")
        imap.logout()
    except Exception as e:
        log.warning(f"Mark seen failed: {e}")


# ── Fetch ───────────────────────────────────────────────────────────────

def fetch_unseen(folder="INBOX"):
    imap = _get_imap()
    try:
        imap.select(folder)
        _, data = imap.search(None, "UNSEEN")
        mids = data[0].split()
        if not mids:
            return []

        emails = []
        for mid in mids:
            _, msg_data = imap.fetch(mid, "(RFC822)")
            if not msg_data[0]:
                continue
            msg = email.message_from_bytes(msg_data[0][1])
            _, addr = parseaddr(msg.get("From", ""))
            if addr == MAIL_USER or "MAILER-DAEMON" in addr.upper():
                continue
            name, _ = parseaddr(msg.get("From", ""))
            emails.append({
                "imap_mid": mid,
                "from_name": _decode(name),
                "from_addr": addr,
                "subject": _decode(msg.get("Subject", "(no subject)")),
                "body": _body(msg)[:3000],
                "date": msg.get("Date", ""),
                "message_id": msg.get("Message-ID", ""),
                "attachments": _attachments(msg),
            })
        log.info(f"Fetched {len(emails)} unseen from {folder}")
        return emails
    finally:
        try:
            imap.logout()
        except Exception:
            pass


# ── Pipeline ────────────────────────────────────────────────────────────

def process_one(em):
    log.info(f"Processing: {em['from_addr']} — {em['subject'][:50]}")

    # 1. Auto-acknowledge
    send_ack(em)

    # 2. Classify
    cls = classify(em)
    if cls["category"] == "spam":
        _mark_seen(em["imap_mid"])
        return False

    # 3. Create task
    task_id = create_task(em, cls)
    if not task_id:
        return False

    # 4. Notify sender
    agent_name = AGENT_NAMES.get(cls["category"], "our team")
    send_assigned(em, task_id[:8], agent_name)

    # 5. Mark seen
    _mark_seen(em["imap_mid"])

    log.info(f"Done: {em['from_addr']} -> {task_id[:8]} ({cls['category']})")
    return True


def check_once():
    emails = fetch_unseen()
    if not emails:
        return 0
    n = 0
    for em in emails:
        try:
            if process_one(em):
                n += 1
        except Exception as e:
            log.error(f"Error on {em.get('from_addr','?')}: {e}", exc_info=True)
    return n


def main():
    if not MAIL_USER or not MAIL_PASSWORD:
        log.error("MAIL_USER and MAIL_PASSWORD required"); sys.exit(1)
    if not PAPERCLIP_COMPANY_ID:
        log.error("PAPERCLIP_COMPANY_ID required"); sys.exit(1)

    log.info(f"Watcher v2 started — {MAIL_USER} every {CHECK_INTERVAL}s")
    while True:
        try:
            n = check_once()
            if n:
                log.info(f"Processed {n} emails")
        except Exception as e:
            log.error(f"Cycle error: {e}", exc_info=True)
        time.sleep(CHECK_INTERVAL)


if __name__ == "__main__":
    if "--once" in sys.argv:
        check_once()
    else:
        main()

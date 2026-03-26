"""Auto-reply templates — acknowledgment + clarification request emails.

Two outbound email types:
  send_acknowledgment()       — sent immediately on receipt, any language
  send_clarification_request() — sent when gaps found, lists missing items
"""

import os
import logging
import smtplib
from email.mime.text import MIMEText
from email.utils import formataddr, parseaddr

from mail_client import MAIL_USER, get_smtp
from guardrails import check_send_limit, check_content

log = logging.getLogger("email-watcher.auto-reply")

AGENT_DISPLAY_NAME = os.environ.get("AGENT_DISPLAY_NAME", "Sanad AI — Optiflow Systems")

# ── Acknowledgment ────────────────────────────────────────────────────────

_ACK_EN = """\
Thank you for your message. We have received your request and our team \
is reviewing it. You will hear back from us shortly.

Request summary: {summary}

Best regards,
{agent_name}
"""

_ACK_AR = """\
شكراً لتواصلك معنا. لقد استلمنا طلبك وفريقنا يقوم بمراجعته الآن. \
سنرد عليك في أقرب وقت ممكن.

ملخص الطلب: {summary}

مع التحية،
{agent_name}
"""


def send_acknowledgment(em: dict, summary: str, language: str = "en") -> bool:
    """Send an immediate acknowledgment to the sender. Returns True on success."""
    allowed, _ = check_send_limit()
    if not allowed:
        log.warning("Acknowledgment blocked: daily send limit reached")
        return False

    template = _ACK_AR if language == "ar" else _ACK_EN
    body = template.format(summary=summary, agent_name=AGENT_DISPLAY_NAME)

    safe, reason = check_content(body)
    if not safe:
        log.warning(f"Acknowledgment content blocked: {reason}")
        return False

    to_addr = em["from_addr"]
    orig_subject = em.get("subject", "")
    subject = orig_subject if orig_subject.startswith("Re:") else f"Re: {orig_subject}"

    return _send(to_addr, subject, body, orig_message_id=em.get("message_id"))


# ── Clarification Request ─────────────────────────────────────────────────

_CLARIFY_EN = """\
Thank you for your request. To proceed, we need a few additional details:

{gaps_list}

Please reply to this email with the missing information so we can begin \
working on your request.

Best regards,
{agent_name}
"""

_CLARIFY_AR = """\
شكراً لطلبك. لمتابعة العمل، نحتاج إلى بعض التفاصيل الإضافية:

{gaps_list}

يُرجى الرد على هذا البريد الإلكتروني بالمعلومات المطلوبة حتى نتمكن \
من البدء في معالجة طلبك.

مع التحية،
{agent_name}
"""


def send_clarification_request(em: dict, gaps: list[str], language: str = "en") -> bool:
    """Send a clarification email listing the gaps found. Returns True on success."""
    if not gaps:
        return False

    allowed, _ = check_send_limit()
    if not allowed:
        log.warning("Clarification blocked: daily send limit reached")
        return False

    gaps_list = "\n".join(f"  {i+1}. {g}" for i, g in enumerate(gaps))
    template = _CLARIFY_AR if language == "ar" else _CLARIFY_EN
    body = template.format(gaps_list=gaps_list, agent_name=AGENT_DISPLAY_NAME)

    safe, reason = check_content(body)
    if not safe:
        log.warning(f"Clarification content blocked: {reason}")
        return False

    to_addr = em["from_addr"]
    orig_subject = em.get("subject", "")
    subject = orig_subject if orig_subject.startswith("Re:") else f"Re: {orig_subject}"

    return _send(to_addr, subject, body, orig_message_id=em.get("message_id"))


# ── Internal SMTP helper ──────────────────────────────────────────────────

def _send(to_addr: str, subject: str, body: str, orig_message_id: str = "") -> bool:
    msg = MIMEText(body, "plain", "utf-8")
    msg["From"] = formataddr((AGENT_DISPLAY_NAME, MAIL_USER))
    msg["To"] = to_addr
    msg["Subject"] = subject
    if orig_message_id:
        msg["In-Reply-To"] = orig_message_id
        msg["References"] = orig_message_id

    try:
        smtp = get_smtp()
        try:
            smtp.sendmail(MAIL_USER, [to_addr], msg.as_string())
        finally:
            smtp.quit()
        log.info(f"Sent reply to {to_addr}: {subject[:60]}")
        return True
    except smtplib.SMTPException as e:
        log.error(f"SMTP error sending to {to_addr}: {e}")
        return False
    except Exception as e:
        log.error(f"Failed to send reply to {to_addr}: {e}")
        return False

"""IMAP/SMTP client helpers for the email MCP server."""

import os
import imaplib
import smtplib
import ssl
import email
from email.header import decode_header
from email.utils import parseaddr

MAIL_HOST = os.environ.get("MAIL_HOST", "mail.acsprosys.com")
MAIL_IMAP_PORT = int(os.environ.get("MAIL_IMAP_PORT", "993"))
MAIL_SMTP_PORT = int(os.environ.get("MAIL_SMTP_PORT", "465"))
MAIL_USER = os.environ.get("MAIL_USER", "")
MAIL_PASSWORD = os.environ.get("MAIL_PASSWORD", "")


def decode_header_value(raw: str) -> str:
    if not raw:
        return ""
    parts = decode_header(raw)
    result = []
    for data, charset in parts:
        if isinstance(data, bytes):
            result.append(data.decode(charset or "utf-8", errors="replace"))
        else:
            result.append(data)
    return " ".join(result)


def get_imap():
    ctx = ssl.create_default_context()
    imap = imaplib.IMAP4_SSL(MAIL_HOST, MAIL_IMAP_PORT, ssl_context=ctx)
    imap.login(MAIL_USER, MAIL_PASSWORD)
    return imap


def get_smtp():
    smtp = smtplib.SMTP_SSL(MAIL_HOST, MAIL_SMTP_PORT, timeout=15)
    smtp.login(MAIL_USER, MAIL_PASSWORD)
    return smtp


def extract_body(msg: email.message.Message) -> str:
    if msg.is_multipart():
        for part in msg.walk():
            if part.get_content_type() == "text/plain":
                payload = part.get_payload(decode=True)
                if payload:
                    charset = part.get_content_charset() or "utf-8"
                    return payload.decode(charset, errors="replace")
        for part in msg.walk():
            if part.get_content_type() == "text/html":
                payload = part.get_payload(decode=True)
                if payload:
                    charset = part.get_content_charset() or "utf-8"
                    return f"[HTML]\n{payload.decode(charset, errors='replace')}"
    else:
        payload = msg.get_payload(decode=True)
        if payload:
            charset = msg.get_content_charset() or "utf-8"
            return payload.decode(charset, errors="replace")
    return ""


def fetch_message(msg_id: str, folder: str = "INBOX") -> email.message.Message | None:
    """Fetch a full email message by IMAP sequence number."""
    imap = get_imap()
    try:
        imap.select(folder, readonly=True)
        status, msg_data = imap.fetch(msg_id.encode(), "(RFC822)")
        if status != "OK" or not msg_data[0]:
            return None
        return email.message_from_bytes(msg_data[0][1])
    finally:
        try:
            imap.logout()
        except Exception:
            pass


def get_attachments(msg: email.message.Message) -> list[dict]:
    """Extract attachment metadata from a message."""
    attachments = []
    for part in msg.walk():
        filename = part.get_filename()
        if not filename:
            continue
        data = part.get_payload(decode=True)
        size = len(data) if data else 0
        attachments.append({
            "filename": decode_header_value(filename),
            "content_type": part.get_content_type(),
            "size": size,
            "disposition": part.get("Content-Disposition", ""),
        })
    return attachments


def find_attachment_part(msg: email.message.Message, target_name: str):
    """Find an attachment part by filename. Returns (part, decoded_filename) or (None, None)."""
    for part in msg.walk():
        filename = part.get_filename()
        if not filename:
            continue
        filename = decode_header_value(filename)
        if filename == target_name:
            return part, filename
    return None, None

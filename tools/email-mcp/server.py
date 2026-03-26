"""Email MCP Server — IMAP/SMTP for agent email access.

Thin MCP protocol hub. Business logic in:
  - mail_client.py — IMAP/SMTP connections, message parsing
  - guardrails.py  — rate limiting, content blocking, file safety

Usage:
  MAIL_HOST=mail.acsprosys.com MAIL_USER=x MAIL_PASSWORD=y python server.py
"""

import os
import sys
import json
import email
from email.mime.text import MIMEText
from email.utils import parseaddr, formataddr

from mail_client import (
    MAIL_USER, get_imap, get_smtp, decode_header_value,
    extract_body, fetch_message, get_attachments, find_attachment_part,
)
from guardrails import (
    check_send_limit, check_content, check_file_safety, is_text_file,
)

AGENT_NAME = os.environ.get("AGENT_NAME", "Sanad AI")


# ── MCP Protocol (JSON-RPC over stdio) ──────────────────────────────────

def _write_response(id_val, result=None, error=None):
    resp = {"jsonrpc": "2.0", "id": id_val}
    if error:
        resp["error"] = error
    else:
        resp["result"] = result
    out = json.dumps(resp)
    sys.stdout.write(f"Content-Length: {len(out)}\r\n\r\n{out}")
    sys.stdout.flush()


def handle_initialize(id_val, params):
    _write_response(id_val, {
        "protocolVersion": "2024-11-05",
        "capabilities": {"tools": {"listChanged": False}},
        "serverInfo": {"name": "email-mcp", "version": "0.2.0"},
    })


TOOL_DEFS = [
    {"name": "read_inbox", "description": "Read recent emails. Returns sender, subject, date.", "inputSchema": {
        "type": "object", "properties": {
            "max_results": {"type": "integer", "default": 10},
            "unread_only": {"type": "boolean", "default": False},
            "folder": {"type": "string", "default": "INBOX"},
        }}},
    {"name": "read_email", "description": "Read full email by sequence number.", "inputSchema": {
        "type": "object", "properties": {"msg_id": {"type": "string"}}, "required": ["msg_id"]}},
    {"name": "send_email", "description": "Send email. Rate-limited + content-guarded.", "inputSchema": {
        "type": "object", "properties": {
            "to": {"type": "string"}, "subject": {"type": "string"},
            "body": {"type": "string"}, "cc": {"type": "string"},
        }, "required": ["to", "subject", "body"]}},
    {"name": "reply_to_email", "description": "Reply to email. Maintains threading.", "inputSchema": {
        "type": "object", "properties": {
            "msg_id": {"type": "string"}, "body": {"type": "string"},
        }, "required": ["msg_id", "body"]}},
    {"name": "move_email", "description": "Move email to folder.", "inputSchema": {
        "type": "object", "properties": {
            "msg_id": {"type": "string"}, "folder": {"type": "string"},
        }, "required": ["msg_id", "folder"]}},
    {"name": "list_folders", "description": "List all mail folders.", "inputSchema": {
        "type": "object", "properties": {}}},
    {"name": "list_attachments", "description": "List attachments with safety status.", "inputSchema": {
        "type": "object", "properties": {
            "msg_id": {"type": "string"}, "folder": {"type": "string", "default": "INBOX"},
        }, "required": ["msg_id"]}},
    {"name": "save_attachment", "description": "Save attachment to disk. Blocks dangerous files.", "inputSchema": {
        "type": "object", "properties": {
            "msg_id": {"type": "string"}, "filename": {"type": "string"},
            "folder": {"type": "string", "default": "INBOX"},
            "save_dir": {"type": "string", "default": "/tmp/email-attachments"},
        }, "required": ["msg_id", "filename"]}},
    {"name": "read_attachment_text", "description": "Read text attachment inline (txt, csv, json, md, etc.).", "inputSchema": {
        "type": "object", "properties": {
            "msg_id": {"type": "string"}, "filename": {"type": "string"},
            "folder": {"type": "string", "default": "INBOX"},
        }, "required": ["msg_id", "filename"]}},
]


def handle_tools_list(id_val, params):
    _write_response(id_val, {"tools": TOOL_DEFS})


TOOL_HANDLERS = {}


def tool(name):
    def decorator(fn):
        TOOL_HANDLERS[name] = fn
        return fn
    return decorator


def handle_tool_call(id_val, params):
    name = params.get("name", "")
    args = params.get("arguments", {})
    handler = TOOL_HANDLERS.get(name)
    if not handler:
        _write_response(id_val, error={"code": -32601, "message": f"Unknown tool: {name}"})
        return
    try:
        result = handler(args)
        _write_response(id_val, {"content": [{"type": "text", "text": result}]})
    except Exception as e:
        _write_response(id_val, {"content": [{"type": "text", "text": f"ERROR: {type(e).__name__}: {e}"}], "isError": True})


import re as _re

_SAFE_FOLDER = _re.compile(r'^[a-zA-Z0-9_./ -]+$')

def _validate_folder(folder: str) -> str:
    """Sanitize IMAP folder name to prevent injection."""
    if not _SAFE_FOLDER.match(folder) or ".." in folder:
        raise ValueError(f"Invalid folder name: {folder}")
    return folder

# ── Tool Implementations ────────────────────────────────────────────────

@tool("read_inbox")
def tool_read_inbox(args: dict) -> str:
    max_results = args.get("max_results", 10)
    unread_only = args.get("unread_only", False)
    folder = _validate_folder(args.get("folder", "INBOX"))

    imap = get_imap()
    try:
        imap.select(folder, readonly=True)
        criteria = "UNSEEN" if unread_only else "ALL"
        status, data = imap.search(None, criteria)
        msg_ids = data[0].split()

        if not msg_ids:
            imap.logout()
            return "No messages found."

        recent_ids = msg_ids[-max_results:][::-1]
        lines = []
        for mid in recent_ids:
            status, msg_data = imap.fetch(mid, "(FLAGS BODY[HEADER.FIELDS (FROM SUBJECT DATE)])")
            raw_header = msg_data[0][1].decode("utf-8", errors="replace")
            msg = email.message_from_string(raw_header)
            flags = msg_data[0][0].decode() if msg_data[0][0] else ""
            is_read = "\\Seen" in flags
            from_addr = decode_header_value(msg.get("From", ""))
            subject = decode_header_value(msg.get("Subject", "(no subject)"))
            date = msg.get("Date", "")
            mark = "" if is_read else "[NEW] "
            lines.append(f"[{mid.decode()}] {mark}{date} | From: {from_addr} | Subject: {subject}")

        return "\n".join(lines)
    finally:
        imap.logout()


@tool("read_email")
def tool_read_email(args: dict) -> str:
    msg = fetch_message(args["msg_id"])
    if not msg:
        return f"Email {args['msg_id']} not found."

    body = extract_body(msg)
    attachments = get_attachments(msg)
    att_line = ""
    if attachments:
        att_names = [f"{a['filename']} ({a['size']:,}B)" for a in attachments if a['size'] > 0]
        if att_names:
            att_line = f"\nAttachments: {', '.join(att_names)}"

    return "\n".join([
        f"From: {decode_header_value(msg.get('From', ''))}",
        f"To: {decode_header_value(msg.get('To', ''))}",
        f"Date: {msg.get('Date', '')}",
        f"Subject: {decode_header_value(msg.get('Subject', ''))}",
        f"Message-ID: {msg.get('Message-ID', '')}",
        att_line,
        "---",
        body[:3000],
    ])


@tool("send_email")
def tool_send_email(args: dict) -> str:
    to, subject, body = args["to"], args["subject"], args["body"]
    cc = args.get("cc", "")

    allowed, remaining = check_send_limit()
    if not allowed:
        return "BLOCKED: Daily send limit reached. Try again tomorrow."
    for text in [body, subject]:
        safe, reason = check_content(text)
        if not safe:
            return f"BLOCKED: {reason}"

    msg = MIMEText(body, "plain", "utf-8")
    msg["From"] = formataddr((AGENT_NAME, MAIL_USER))
    msg["To"] = to
    msg["Subject"] = subject
    if cc:
        msg["Cc"] = cc

    smtp = get_smtp()
    recipients = [to] + ([r.strip() for r in cc.split(",")] if cc else [])
    smtp.sendmail(MAIL_USER, recipients, msg.as_string())
    smtp.quit()
    return f"Email sent to {to}. Subject: {subject}. Remaining sends today: {remaining}"


@tool("reply_to_email")
def tool_reply_to_email(args: dict) -> str:
    msg_id, reply_body = args["msg_id"], args["body"]

    allowed, remaining = check_send_limit()
    if not allowed:
        return "BLOCKED: Daily send limit reached."
    safe, reason = check_content(reply_body)
    if not safe:
        return f"BLOCKED: {reason}"

    orig = fetch_message(msg_id)
    if not orig:
        return f"Email {msg_id} not found."

    orig_subject = decode_header_value(orig.get("Subject", ""))
    subject = orig_subject if orig_subject.startswith("Re:") else f"Re: {orig_subject}"
    to = parseaddr(orig.get("From", ""))[1]
    orig_message_id = orig.get("Message-ID", "")

    msg = MIMEText(reply_body, "plain", "utf-8")
    msg["From"] = formataddr((AGENT_NAME, MAIL_USER))
    msg["To"] = to
    msg["Subject"] = subject
    if orig_message_id:
        msg["In-Reply-To"] = orig_message_id
        msg["References"] = orig_message_id

    smtp = get_smtp()
    smtp.sendmail(MAIL_USER, [to], msg.as_string())
    smtp.quit()
    return f"Reply sent to {to}. Subject: {subject}. Remaining: {remaining}"


@tool("move_email")
def tool_move_email(args: dict) -> str:
    msg_id, folder = args["msg_id"], _validate_folder(args["folder"])
    imap = get_imap()
    try:
        imap.select("INBOX")
        imap.copy(msg_id.encode(), folder)
        imap.store(msg_id.encode(), "+FLAGS", "\\Deleted")
        imap.expunge()
    finally:
        try:
            imap.logout()
        except Exception:
            pass
    return f"Email {msg_id} moved to {folder}."


@tool("list_folders")
def tool_list_folders(args: dict) -> str:
    imap = get_imap()
    status, folders = imap.list()
    imap.logout()
    lines = []
    for f in folders:
        parts = f.decode().split('"/"')
        name = parts[-1].strip().strip('"') if len(parts) > 1 else f.decode()
        lines.append(name)
    return "Mail folders:\n" + "\n".join(f"  - {f}" for f in lines)


@tool("list_attachments")
def tool_list_attachments(args: dict) -> str:
    folder = args.get("folder", "INBOX")
    msg = fetch_message(args["msg_id"], folder)
    if not msg:
        return f"Email {args['msg_id']} not found."

    attachments = get_attachments(msg)
    if not attachments:
        return "No attachments in this email."

    lines = []
    for a in attachments:
        safe, reason = check_file_safety(a["filename"], a["size"])
        status = "SAFE" if safe else f"BLOCKED ({reason})"
        text_flag = " [text-readable]" if is_text_file(a["filename"]) else ""
        lines.append(
            f"  {a['filename']} | {a['content_type']} | {a['size']:,} bytes | {status}{text_flag}"
        )
    return f"Attachments ({len(attachments)}):\n" + "\n".join(lines)


@tool("save_attachment")
def tool_save_attachment(args: dict) -> str:
    folder = args.get("folder", "INBOX")
    save_dir = args.get("save_dir", "/tmp/email-attachments")
    target_name = args["filename"]

    msg = fetch_message(args["msg_id"], folder)
    if not msg:
        return f"Email {args['msg_id']} not found."

    part, filename = find_attachment_part(msg, target_name)
    if not part:
        return f"Attachment '{target_name}' not found in email."

    data = part.get_payload(decode=True)
    if not data:
        return f"Attachment {filename} is empty."

    safe, reason = check_file_safety(filename, len(data))
    if not safe:
        return f"BLOCKED: {reason}"

    default_dir = os.environ.get("EMAIL_ATTACHMENT_DIR", "/tmp/email-attachments")
    os.makedirs(default_dir, exist_ok=True)
    clean_name = os.path.basename(filename).replace("..", "")
    path = os.path.realpath(os.path.join(default_dir, clean_name))
    if not path.startswith(os.path.realpath(default_dir)):
        return "BLOCKED: path traversal detected"
    with open(path, "wb") as f:
        f.write(data)
    return f"Saved: {path} ({len(data):,} bytes)"


@tool("read_attachment_text")
def tool_read_attachment_text(args: dict) -> str:
    folder = args.get("folder", "INBOX")
    target_name = args["filename"]

    msg = fetch_message(args["msg_id"], folder)
    if not msg:
        return f"Email {args['msg_id']} not found."

    if not is_text_file(target_name):
        return f"Cannot read '{target_name}' inline — not a text file. Use save_attachment instead."

    part, filename = find_attachment_part(msg, target_name)
    if not part:
        return f"Attachment '{target_name}' not found in email."

    data = part.get_payload(decode=True)
    if not data:
        return f"Attachment {filename} is empty."

    charset = part.get_content_charset() or "utf-8"
    text = data.decode(charset, errors="replace")
    if len(text) > 10000:
        text = text[:10000] + f"\n\n... [truncated, {len(data):,} bytes total]"
    return f"=== {filename} ===\n{text}"


# ── Main Loop ───────────────────────────────────────────────────────────

HANDLERS = {
    "initialize": handle_initialize,
    "notifications/initialized": lambda *_: None,
    "tools/list": handle_tools_list,
    "tools/call": handle_tool_call,
}


def main():
    if not MAIL_USER:
        sys.stderr.write("ERROR: MAIL_USER and MAIL_PASSWORD must be set\n")
        sys.exit(1)

    buf = b""
    while True:
        try:
            chunk = sys.stdin.buffer.read(1)
            if not chunk:
                break
            buf += chunk

            if b"\r\n\r\n" in buf:
                header, rest = buf.split(b"\r\n\r\n", 1)
                content_length = 0
                for line in header.decode().split("\r\n"):
                    if line.lower().startswith("content-length:"):
                        content_length = int(line.split(":")[1].strip())

                while len(rest) < content_length:
                    rest += sys.stdin.buffer.read(content_length - len(rest))

                body = rest[:content_length]
                buf = rest[content_length:]

                request = json.loads(body)
                method = request.get("method", "")
                handler = HANDLERS.get(method)
                if handler:
                    handler(request.get("id"), request.get("params", {}))

        except KeyboardInterrupt:
            break
        except Exception as e:
            sys.stderr.write(f"Error: {e}\n")


if __name__ == "__main__":
    main()

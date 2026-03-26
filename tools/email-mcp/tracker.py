"""Pending-clarification tracker — persists email threads awaiting reply.

JSON file at ~/.email-mcp/pending.json. One entry per email waiting for
the sender to supply missing info before a task can be created.
"""

import json
import logging
import os
from datetime import datetime

log = logging.getLogger("email-watcher.tracker")

_STORE_PATH = os.path.join(
    os.path.expanduser("~"), ".email-mcp", "pending.json"
)


def _load() -> dict:
    if not os.path.exists(_STORE_PATH):
        return {}
    try:
        with open(_STORE_PATH) as f:
            return json.load(f)
    except Exception as e:
        log.warning(f"Failed to load pending store: {e}")
        return {}


def _save(data: dict) -> None:
    os.makedirs(os.path.dirname(_STORE_PATH), exist_ok=True)
    tmp = _STORE_PATH + ".tmp"
    try:
        with open(tmp, "w") as f:
            json.dump(data, f, indent=2)
        os.replace(tmp, _STORE_PATH)
    except Exception as e:
        log.error(f"Failed to save pending store: {e}")


def save_pending(message_id: str, entry: dict) -> None:
    """Save a pending clarification request keyed by original Message-ID."""
    data = _load()
    data[message_id] = {**entry, "created_at": datetime.utcnow().isoformat()}
    _save(data)
    log.info(f"Saved pending: {message_id}")


def find_pending(em: dict) -> dict | None:
    """Return pending entry if this email is a reply to a tracked thread."""
    data = _load()
    if not data:
        return None

    # Check In-Reply-To and References headers
    in_reply_to = em.get("in_reply_to", "").strip()
    references = em.get("references", "").strip()

    for msg_id, entry in data.items():
        if msg_id and (msg_id in in_reply_to or msg_id in references):
            return {"message_id": msg_id, **entry}

    return None


def clear_pending(message_id: str) -> None:
    """Remove a pending entry once the full task has been created."""
    data = _load()
    if message_id in data:
        del data[message_id]
        _save(data)
        log.info(f"Cleared pending: {message_id}")


def list_pending() -> list[dict]:
    """Return all pending entries (for debug/monitoring)."""
    data = _load()
    return [{"message_id": k, **v} for k, v in data.items()]

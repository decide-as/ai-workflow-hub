#!/usr/bin/env python3
"""
outreach-email-checker.py

Polls an IMAP inbox for unseen messages and logs replies from known leads
into the cold-outreach SQLite database.

Required environment variables (read from .env in the project root):
  OUTREACH_IMAP_HOST   - IMAP server hostname (e.g. imap.gmail.com)
  OUTREACH_IMAP_PORT   - IMAP SSL port (default: 993)
  OUTREACH_IMAP_USER   - Email address / IMAP username
  OUTREACH_IMAP_PASS   - App password (never a plain account password)
  OUTREACH_IMAP_FOLDER - Mailbox to check (default: INBOX)
  OUTREACH_DB_PATH     - Absolute path to outreach.db
"""

import imaplib
import email
import email.header
import email.utils
import sqlite3
import os
import sys
import logging
from pathlib import Path

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger(__name__)

ENV_FILE = Path(__file__).parent.parent / ".env"


def load_env(path: Path) -> None:
    if not path.exists():
        return
    with path.open() as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, val = line.partition("=")
            val = val.strip().strip('"').strip("'")
            os.environ.setdefault(key.strip(), val)


def require_env(name: str) -> str:
    val = os.environ.get(name, "").strip()
    if not val:
        log.error("Missing required env var: %s", name)
        sys.exit(1)
    return val


def decode_header_value(raw: str | None) -> str:
    if not raw:
        return ""
    parts = email.header.decode_header(raw)
    decoded = []
    for part, charset in parts:
        if isinstance(part, bytes):
            decoded.append(part.decode(charset or "utf-8", errors="replace"))
        else:
            decoded.append(part)
    return " ".join(decoded)


def extract_from_address(msg: email.message.Message) -> str:
    raw = msg.get("From", "")
    addr = email.utils.parseaddr(raw)[1]
    return addr.lower().strip()


def already_logged(conn: sqlite3.Connection, lead_id: int, imap_uid: str) -> bool:
    marker = f"[imap_uid:{imap_uid}]"
    row = conn.execute(
        "SELECT 1 FROM interactions WHERE lead_id = ? AND notes LIKE ?",
        (lead_id, f"%{marker}%"),
    ).fetchone()
    return row is not None


def find_contacted_lead(conn: sqlite3.Connection, address: str) -> int | None:
    row = conn.execute(
        "SELECT id FROM leads WHERE LOWER(email) = ? AND status = 'contacted'",
        (address,),
    ).fetchone()
    return row[0] if row else None


def log_reply(
    conn: sqlite3.Connection, lead_id: int, subject: str, imap_uid: str
) -> None:
    notes = f"[imap_uid:{imap_uid}] Subject: {subject}"
    conn.execute(
        "INSERT INTO interactions (lead_id, type, notes) VALUES (?, 'reply', ?)",
        (lead_id, notes),
    )
    conn.execute(
        "UPDATE leads SET status = 'replied' WHERE id = ?",
        (lead_id,),
    )
    conn.commit()


def run() -> int:
    load_env(ENV_FILE)

    imap_host = require_env("OUTREACH_IMAP_HOST")
    imap_port = int(os.environ.get("OUTREACH_IMAP_PORT", "993"))
    imap_user = require_env("OUTREACH_IMAP_USER")
    imap_pass = require_env("OUTREACH_IMAP_PASS")
    imap_folder = os.environ.get("OUTREACH_IMAP_FOLDER", "INBOX")
    db_path = require_env("OUTREACH_DB_PATH")

    if not Path(db_path).exists():
        log.error("Database not found: %s", db_path)
        sys.exit(1)

    log.info("Connecting to %s:%d as %s", imap_host, imap_port, imap_user)
    try:
        imap = imaplib.IMAP4_SSL(imap_host, imap_port)
        imap.login(imap_user, imap_pass)
    except Exception as exc:
        log.error("IMAP connection failed: %s", exc)
        return 1

    try:
        typ, _ = imap.select(imap_folder)
        if typ != "OK":
            log.error(
                "Failed to select folder %r (server returned %s)", imap_folder, typ
            )
            return 1

        _, data = imap.search(None, "UNSEEN")
        uids = data[0].split() if data and data[0] else []
        log.info("Found %d unseen message(s) in %s", len(uids), imap_folder)

        conn = sqlite3.connect(db_path)
        logged = 0
        try:
            for raw_uid in uids:
                uid_str = raw_uid.decode()
                _, msg_data = imap.fetch(raw_uid, "(RFC822.HEADER)")
                if not msg_data or not msg_data[0]:
                    continue

                msg = email.message_from_bytes(msg_data[0][1])
                from_addr = extract_from_address(msg)
                subject = decode_header_value(msg.get("Subject", ""))

                lead_id = find_contacted_lead(conn, from_addr)
                if lead_id is None:
                    log.debug("No contacted lead for <%s> — skipping", from_addr)
                    imap.store(raw_uid, "+FLAGS", "\\Seen")
                    continue

                if already_logged(conn, lead_id, uid_str):
                    log.debug(
                        "UID %s already logged for lead %d — skipping", uid_str, lead_id
                    )
                    imap.store(raw_uid, "+FLAGS", "\\Seen")
                    continue

                log_reply(conn, lead_id, subject, uid_str)
                imap.store(raw_uid, "+FLAGS", "\\Seen")
                log.info(
                    "Logged reply from <%s> (lead_id=%d) — subject: %s",
                    from_addr,
                    lead_id,
                    subject,
                )
                logged += 1
        finally:
            conn.close()

        log.info("Done — %d new reply interaction(s) logged", logged)
        return 0

    finally:
        try:
            imap.logout()
        except Exception:
            pass


if __name__ == "__main__":
    sys.exit(run())

#!/usr/bin/env python3
"""Add a single URL to the reading-list SQLite database."""

import json
import sqlite3
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / "data" / "reading_list.db"


def init_db(conn: sqlite3.Connection) -> None:
    conn.execute("""
        CREATE TABLE IF NOT EXISTS reading_list (
            id TEXT PRIMARY KEY,
            url TEXT UNIQUE NOT NULL,
            title TEXT DEFAULT '',
            notes TEXT DEFAULT '',
            source TEXT NOT NULL,
            added_at TEXT,
            status TEXT DEFAULT 'unread'
        )
    """)
    conn.commit()


def main() -> None:
    if len(sys.argv) < 2 or not sys.argv[1].strip():
        print(json.dumps({"success": False, "error": "No URL provided"}))
        sys.exit(1)

    url = sys.argv[1].strip()
    if not url.startswith("http"):
        print(
            json.dumps(
                {"success": False, "error": "Invalid URL (must start with http)"}
            )
        )
        sys.exit(1)

    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    try:
        init_db(conn)
        entry_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        conn.execute(
            "INSERT INTO reading_list (id, url, source, added_at) VALUES (?, ?, ?, ?)",
            (entry_id, url, "manual", now),
        )
        conn.commit()
        print(json.dumps({"success": True, "id": entry_id}))
    except sqlite3.IntegrityError:
        print(json.dumps({"success": False, "error": "URL already in reading list"}))
        sys.exit(1)
    except Exception as exc:
        print(json.dumps({"success": False, "error": str(exc)}))
        sys.exit(1)
    finally:
        conn.close()


if __name__ == "__main__":
    main()

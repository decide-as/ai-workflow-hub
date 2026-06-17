#!/usr/bin/env python3
"""Return recent reading-list entries as JSON."""

import json
import sqlite3
import sys
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / "data" / "reading_list.db"


def main() -> None:
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else -1  # -1 = no limit

    if not DB_PATH.exists():
        print(json.dumps([]))
        return

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        query = (
            "SELECT id, url, title, notes, source, added_at, status "
            "FROM reading_list ORDER BY added_at DESC"
        )
        rows = (
            conn.execute(query).fetchall()
            if limit < 0
            else conn.execute(query + " LIMIT ?", (limit,)).fetchall()
        )
        print(json.dumps([dict(r) for r in rows]))
    except Exception as exc:
        print(json.dumps({"error": str(exc)}))
        sys.exit(1)
    finally:
        conn.close()


if __name__ == "__main__":
    main()

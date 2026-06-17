#!/usr/bin/env python3
"""Import reading-list URLs from the macOS Reminders app into the local SQLite database."""

import json
import sqlite3
import subprocess
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / "data" / "reading_list.db"
READING_LISTS = {"Leseliste", "Prioritert leseliste"}


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


def fetch_reminders() -> list[dict]:
    script = """
tell application "Reminders"
    set output to ""
    set allLists to every list
    repeat with aList in allLists
        set listName to name of aList
        set titleList to name of every reminder of aList
        set itemCount to count of titleList
        try
            set notesList to body of every reminder of aList
        on error
            set notesList to {}
            repeat itemCount times
                set end of notesList to ""
            end repeat
        end try
        try
            set urlList to url of every reminder of aList
        on error
            set urlList to {}
            repeat itemCount times
                set end of urlList to ""
            end repeat
        end try
        repeat with i from 1 to itemCount
            set rTitle to item i of titleList
            set rNotes to item i of notesList
            set rURL to item i of urlList
            if rNotes is missing value then set rNotes to ""
            if rURL is missing value then set rURL to ""
            set output to output & "|||" & listName & "|||" & rTitle & "|||" & rURL & "|||" & rNotes & "\n"
        end repeat
    end repeat
    return output
end tell
"""
    result = subprocess.run(
        ["osascript", "-e", script],
        capture_output=True,
        text=True,
        timeout=120,
    )
    if result.returncode != 0:
        raise RuntimeError(f"AppleScript error: {result.stderr.strip()}")

    entries = []
    for line in result.stdout.strip().split("\n"):
        if not line.strip():
            continue
        parts = line.split("|||")
        if len(parts) < 5:
            continue
        _, list_name, title, url, notes = (
            parts[0],
            parts[1],
            parts[2],
            parts[3],
            parts[4],
        )
        if list_name not in READING_LISTS:
            continue
        # URLs are pasted as the title on mobile; fall back to url field
        raw_url = title.strip() if title.strip().startswith("http") else url.strip()
        if not raw_url or not raw_url.startswith("http"):
            continue
        entries.append(
            {
                "url": raw_url,
                "notes": notes.strip(),
                "source": list_name,
            }
        )
    return entries


def import_entries(entries: list[dict], conn: sqlite3.Connection) -> tuple[int, int]:
    imported = 0
    duplicates = 0
    now = datetime.now(timezone.utc).isoformat()
    for entry in entries:
        try:
            conn.execute(
                "INSERT INTO reading_list (id, url, notes, source, added_at) VALUES (?, ?, ?, ?, ?)",
                (str(uuid.uuid4()), entry["url"], entry["notes"], entry["source"], now),
            )
            imported += 1
        except sqlite3.IntegrityError:
            duplicates += 1
    conn.commit()
    return imported, duplicates


def main() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    try:
        init_db(conn)
        entries = fetch_reminders()
        imported, duplicates = import_entries(entries, conn)
        print(
            json.dumps(
                {"success": True, "imported": imported, "duplicates": duplicates}
            )
        )
    except Exception as exc:
        print(json.dumps({"success": False, "error": str(exc)}))
        sys.exit(1)
    finally:
        conn.close()


if __name__ == "__main__":
    main()

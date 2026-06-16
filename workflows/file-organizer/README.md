# File Organizer

Sort a messy folder's top-level files into category subfolders by file type.
Unlike the other workflows in this hub, this one does **not** open a Claude
session — the **Run** button executes a local Python script against a folder you
pick.

## How it works

1. Click **Run ▶** on the card and choose a folder (e.g. `~/Downloads`).
2. The hub runs a **dry-run preview** — a plan of every move, nothing touched.
3. Review the plan, then click **Apply moves** to execute (or **Cancel**).

Organized files land in an `__ORGANIZED__` subfolder inside the chosen folder,
split into category folders (`Images`, `PDF`, `Spreadsheets`, …).

## Safety

- **Preview first** — nothing moves until you click *Apply moves*.
- **Never deletes files** — content duplicates are moved to `Duplicates/`, not
  removed. Only empty (or OS-junk-only) folders are deleted.
- **Date-prefixed** — files are renamed with a `YYYY-MM-DD_` prefix from their
  modification date (unless already prefixed). Directories are not renamed.
- **Logged + undoable** — each executed run writes `.file_organizer_log.txt`
  and `.file_organizer_report.json` (a full `source → destination` map) into
  `__ORGANIZED__`.
- **Idempotent** — re-running skips the `__ORGANIZED__` folder and previously
  sorted category folders, so it never re-shuffles itself.

## Running it directly

The script is plain stdlib Python 3 — no dependencies:

```bash
python3 scripts/organize.py <folder>              # dry-run preview
python3 scripts/organize.py <folder> --execute    # actually move files
python3 scripts/organize.py <folder> --dest DIR --min-age-days 7
```

Categories are defined in `CATEGORIES` at the top of `scripts/organize.py`;
edit that map to add extensions or rename buckets.

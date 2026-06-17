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

### Age filter (optional)

The preview has an **Only move files older than N days** toggle (default 7).
Enable it to leave recent files where they are and only organize older ones —
adjusting the number re-runs the preview. Off by default (everything moves).

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

## Scheduled runs (launchd)

The workflow can run unattended on a folder via a macOS **launchd** agent. In the
hub, the card shows the cadence, target, live status, and an **Enable / Disable**
button. The default job organizes `~/Downloads` **every hour**, moving only files
**older than 7 days** (so it never sweeps something you just downloaded).

The agent is managed by `scripts/schedule.sh`, which the app calls and you can run
directly:

```bash
scripts/schedule.sh enable    # write the LaunchAgent plist and load it
scripts/schedule.sh disable   # unload and delete the plist
scripts/schedule.sh status    # JSON: installed / loaded / lastRunAt
```

Configure via env vars (the app passes these from the registry's `scheduled_job`):
`FO_TARGET`, `FO_INTERVAL` (seconds), `FO_MIN_AGE_DAYS`, `FO_LABEL`. Scheduled runs
use `--execute` (no preview) and log to
`~/Library/Logs/workflow-hub/<label>.log`.

> The plist records the **absolute path** of `organize.py` at enable time. If you
> move the repo (or enable from a temporary git worktree), disable and re-enable
> from the new location to repoint it.

## Running it directly

The script is plain stdlib Python 3 — no dependencies:

```bash
python3 scripts/organize.py <folder>              # dry-run preview
python3 scripts/organize.py <folder> --execute    # actually move files
python3 scripts/organize.py <folder> --dest DIR --min-age-days 7
```

Categories are defined in `CATEGORIES` at the top of `scripts/organize.py`;
edit that map to add extensions or rename buckets.

---
bump: minor
---

### Added

- File Organizer workflow — a "Run" action that sorts a chosen folder's top-level files into category subfolders (Images, PDF, Spreadsheets, …) inside an `__ORGANIZED__` folder, with a dry-run preview before anything moves, content-duplicate detection, empty-folder cleanup, and a JSON undo report.
- Optional age filter on File Organizer runs — only move files older than N days (default 7), adjustable in the run preview.
- "Open in Finder" action after an organize run, revealing the organized folder.
- launchd scheduling for File Organizer — install or remove a recurring background job from the app, with live status and Enable/Disable controls; the default job organizes `~/Downloads` hourly, skipping files newer than 7 days.
- LinkedIn Posts workstream — a card under a new Content cluster that opens a Claude session in the standalone `linkedin_posts` repo via an absolute path.

### Changed

- Workflows can declare a `run` action that executes a bundled script (folder picker → preview → apply) in addition to opening a Claude session. Runner options and scheduled jobs are config-driven in the registry, and cards show a short non-truncated summary.

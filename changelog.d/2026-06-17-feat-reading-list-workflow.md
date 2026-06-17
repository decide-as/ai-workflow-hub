---
bump: minor
---

### Added

- Reading List workflow card with inline controls: "Get from Reminders" button imports URLs from the "Leseliste" and "Prioritert leseliste" macOS Reminders lists, and a URL paste input lets users add links directly. Both import from and add to a local SQLite database at `workflows/reading-list/data/reading_list.db`.
- `ReadingListModal` for browsing all saved URLs, sorted by timestamp descending (entries without a timestamp sort last).
- Three IPC channels (`reading-list-import`, `reading-list-add-url`, `reading-list-get-entries`) bridging the renderer to Python scripts via `spawnSync`.
- Workflow registry rule (`.claude/rules/workflow-registry.md`) enforcing required fields on all registry entries.

### Changed

- Sidebar type `"run"` renamed to `"routine"` — label changes from "Script" to "Routine" in the filter panel. The `routine` type now covers `run`, `reading-list`, and `transcribe` actions.

---
bump: minor
---

### Added

- Grid/list view toggle in the main header — switch between card grid and compact row list per cluster.
- Log modal for scheduled workflows — view a per-run history table (timestamp, result, files moved) parsed from the launchd log file.
- Solution type filter in the sidebar — filter workflows by Scheduled Task, Claude, or Script.
- Configure phase before dry-run — a slider modal lets users set the age filter (0–90 days) before the File Organizer scan starts, defaulting to 7 days.
- `READ_LOG` IPC channel — renderer can read launchd log files for the log modal.
- 30-second live polling for schedule status in SchedulePanel.

### Fixed

- Legacy launchd job (`as.decide.ai-workflow-hub.file-organizer`) is retired automatically on Enable, resolving a stale job left from the project rename.
- Schedule status falls back to the legacy log path so the Logs button shows historical runs before the new job has fired.
- Run index numbering in the log modal — `#1` now correctly refers to the most recent run.
- `readLog` IPC scoped to the user's home directory to make the trust boundary explicit.

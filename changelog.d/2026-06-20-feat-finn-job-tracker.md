---
bump: minor
---

### Added

- Finn.no job auto-tracker script (`scripts/finn-job-tracker.py`) that runs every 15 minutes via launchd, scrapes the first 25 AI-related job listings, scores each via `claude -p` using the job-tracker evaluation framework, stores qualifying results (≥40%) in the job-tracker SQLite DB, and sends Pushover notifications for positions scoring ≥50%.
- Deduplication log at `workflow-hub-data/job-strategy/data/auto-scraped.json` tracks all seen listings across runs, preventing re-scoring and supporting threshold changes via selective log entry removal.
- `logs/` directory with `.gitignore` for runtime log files produced by the auto-tracker.

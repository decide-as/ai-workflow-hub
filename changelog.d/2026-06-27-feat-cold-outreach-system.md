---
bump: minor
---

### Added

- Cold outreach system: four integrated workflows sharing a single SQLite database in `workflow-hub-data/cold-outreach/`
  - **Cold Outreach Lead Builder** — research and build a list of leads with treatment group tags (value-first, demo-ask, case-study)
  - **Email Sender** — draft and send outreach emails from leads in the database via macOS Mail
  - **Outreach CRM** — view contacts and log follow-up interactions per lead
  - **Email Inbox Checker** (scheduled) — IMAP poller that detects replies from contacted leads and logs them back to the CRM with idempotency via UID markers
- New `outreach` cluster in `registry/workflows.yaml` grouping all four workflows
- SQLite schema (`cold-outreach/schema.sql`) with `leads`, `interactions`, and `treatment_group_log` tables, CHECK constraints, and indexes
- Three treatment group markdown templates (`value-first.md`, `demo-ask.md`, `case-study.md`) for Claude session access
- `Inbox` icon registered in `src/renderer/src/lib/icons.tsx`

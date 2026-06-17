<!-- markdownlint-disable MD013 MD024 -->
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.0] - 2026-06-17

### Added

- File Organizer workflow — a "Run" action that sorts a chosen folder's top-level files into category subfolders (Images, PDF, Spreadsheets, …) inside an `__ORGANIZED__` folder, with a dry-run preview before anything moves, content-duplicate detection, empty-folder cleanup, and a JSON undo report.
- Optional age filter on File Organizer runs — only move files older than N days (default 7), adjustable in the run preview.
- "Open in Finder" action after an organize run, revealing the organized folder.
- launchd scheduling for File Organizer — install or remove a recurring background job from the app, with live status and Enable/Disable controls; the default job organizes `~/Downloads` hourly, skipping files newer than 7 days.
- LinkedIn Posts workstream — a card under a new Content cluster that opens a Claude session in the standalone `linkedin_posts` repo via an absolute path.

### Changed

- Workflows can declare a `run` action that executes a bundled script (folder picker → preview → apply) in addition to opening a Claude session. Runner options and scheduled jobs are config-driven in the registry, and cards show a short non-truncated summary.

## [0.3.0] - 2026-06-16

### Added

- Expense Reimbursement workflow: a Norwegian Utleggsskjema (Excel) built from receipts via Claude, with reverse-VAT extraction, a gitignored per-batch data folder, and 0#/Bilagsnr attachment numbering.
- Bank Transaction Triage workflow: ingest many bank exports (PDF/CSV/XLSX), normalize and dedup every line against a hash-keyed master ledger, triage register/route/skip, and route reimbursable items into the Expense/Travel forms.

### Changed

- Workflow cards show a one-line summary (full text stays in the modal) and are wider; a Finance cluster groups the finance workflows in the sidebar and sections.

## [0.2.0] - 2026-06-16

### Added

- Workflow detail modal with rich metadata: status, trigger type, run history, success rate, performance estimates, inputs, outputs, and workspace badge
- 12 self-contained workflow directories (workflows/<name>/) each with README, project-meta.yaml for one-command scaffold, and .claude/rules/task.md for Claude task instructions
- Vitest unit test suite (23 tests) covering clustering engine, registry YAML round-trip, CLI register/write logic, and terminal launch error paths
- Structured error handling for Terminal launch: distinguishes Automation permission denial, missing claude binary, and missing repo path with actionable UI messages


- Travel Reimbursement workflow (`workflows/travel-reimbursement-form/`): a Claude-driven workflow that turns a trip's receipts into a Norwegian-format travel expense report (Excel) plus a bookkeeping summary. Ships the full `.claude` instruction set (attachment intake with SHA-256 dedup, semantic grouping of documents into one transaction, HEIC→JPG, UUID→`0#` renaming; transaction extraction and ordering; VAT rules and the seven ledger categories; `standardsatser` allowance; markup and bookkeeping summary), reference docs (Skatteetaten rates with row map and the Fiken/MVA FAQ), the `.xlsx` report template, and example inputs
- `scripts/generate_report.py` (openpyxl): fills only the template's input cells and leaves its formulas intact, bakes computed totals via LibreOffice so they display in any viewer (Excel, Numbers, LibreOffice), and validates the data plus cross-checks every computed total (grand, markup combined, and per-category NOK/other × refunded/not) against the transaction sums

### Changed

- Advance project phase from prototype to mvp — quality gate moves to basic, risk tier to basic
- Terminal launch: renamed itunesRunning() → isIterm2Running(); added pre-flight checks before osascript invocation
- OpenResult type extended with errorKind discriminant for targeted renderer error messages
- Workflow directories stripped to minimal scaffoldable structure (3 files each) to prevent Claude Code context inheritance from hub's Node rules


- Workflow `repo_path` may be relative to the app root and is resolved at open time, so bundled workflows ship machine-independent paths instead of hardcoded absolutes
- Remove the 12 seed mock workflows and reset the registry to empty

### Fixed

- Registry path resolution when Electron launched with absolute entry path (app.getAppPath() returned out/main instead of project root)

## [0.1.0] - 2026-06-15

### Added

- Initial project scaffold

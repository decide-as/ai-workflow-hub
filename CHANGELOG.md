<!-- markdownlint-disable MD013 MD024 -->
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.26.0] - 2026-06-21

### Added

- Finn.no job auto-tracker script (`scripts/finn-job-tracker.py`) that runs every 15 minutes via launchd, scrapes the first 25 AI-related job listings, scores each via `claude -p` using the job-tracker evaluation framework, stores qualifying results (≥40%) in the job-tracker SQLite DB, and sends Pushover notifications for positions scoring ≥50%.
- Deduplication log at `workflow-hub-data/job-strategy/data/auto-scraped.json` tracks all seen listings across runs, preventing re-scoring and supporting threshold changes via selective log entry removal.
- `logs/` directory with `.gitignore` for runtime log files produced by the auto-tracker.

## [0.25.0] - 2026-06-20

### Added

- Job Strategy workflow — opens Claude in `~/Repositories/job-strategy` as a persistent career thinking partner that accumulates context across sessions via its memory system.
- `local-dependency` tag on all workflows that require a locally cloned repository (Loan Agreement Generator, Accrued Loan Interest, LinkedIn Posts, Scaffold New Project, Web Scraper, Job Strategy), making device-specific dependencies identifiable at a glance.
- `Briefcase` icon registered in the icon set for use by career/job workflows.
- `career` cluster in the workflow registry.

## [0.24.0] - 2026-06-19

### Added

- Employee Gift Tracker workflow with a three-phase modal (form → confirm → result) for documenting employee gifts under the Norwegian tax-free gift rule (5 000 NOK per employee per calendar year). Calculates the tax-free portion and taxable income split automatically.
- `shared/gift-tax.ts` — pure calculation module for the Norwegian gift tax rule, importable by both the renderer and the test suite.
- 17 new unit tests covering all three user-specified scenarios (first gift exceeding limit, first gift within limit, second gift with prior total) plus four edge cases (exact limit, exhausted limit, straddle, over-limit previous total).

## [0.23.0] - 2026-06-19

### Added

- Workspace badge added to each workflow card (top-right of the title row in grid view, inline with the workflow name in list view), color-tinted from the workspace's hashed color. Badge is shown only when viewing "All workflows" — hidden when a workspace is selected from the sidebar.
- Schedule indicator moved next to the workspace badge on the name line in list view.
- Action button fixed to a uniform width (`w-24`) across all list rows so Open/Run buttons align consistently.
- Always-rendered `w-5` overflow slot ensures the `+N` tag pill right-aligns with other rows even when fewer than 4 tags are present.

### Changed

- Workspace section dividers (colored header bars) removed from the main content area; the layout is now a single unbroken workflow grid/list.

## [0.22.0] - 2026-06-19

### Added

- Voice Transcriber workflow card with in-card Record/Stop button, 5-minute countdown timer with auto-stop, and live transcription via OpenAI Whisper (gpt-4o-transcribe model).
- Transcriptions are automatically copied to clipboard after each recording.
- Last transcription shown on the card with a one-click Copy button.
- Transcription log persists for 24 hours; accessible via a modal by clicking the card body.
- OpenAI API key loaded from a `.env` file at the repo root — works from both the main checkout and any worktree via `git rev-parse --git-common-dir`.
- `.prettierignore` added; full codebase formatted with Prettier so `make lint` now passes cleanly.

## [0.21.0] - 2026-06-19

### Added

- Web Scraper workflow card — paste any URL (web article, Instagram, LinkedIn, YouTube, PDF) and Claude runs the scrapers repo with `--output-dir` routing all output to `workflow-hub-data/web-scraper/data`
- `workflow-data-repo` rule mandating a corresponding data folder in `workflow-hub-data` for every registry workflow, with symlink/routing conventions for scaffold and external-repo workflows

## [0.20.0] - 2026-06-19

### Added

- Voucher Folder Creator workflow: drag-and-drop bank statement screenshots onto the card, Claude reads them via the local `claude -p` CLI subprocess, and one sub-folder per transaction is created in the configured output directory with Norwegian Title Case naming rules.
- `bookkeeping` action type for workflow cards with a full multi-phase inline UI (idle drop zone, processing spinner, done list, error state).
- `pickFolder` IPC call now accepts an optional `defaultPath` so the Finder folder picker opens pre-navigated to the configured output directory.
- `.claude/guides/claude-subprocess.md` documenting the preferred pattern for invoking Claude headlessly from the Electron main process without calling the Anthropic API directly.

## [0.19.3] - 2026-06-19

### Fixed

- Bundle registry into production app build so workflow cards load correctly in packaged builds.
- Compact `BookkeepingControls` idle state to a single-row drop target, eliminating the card height inconsistency in the grid.
- Ensure all workflow cards share a uniform minimum height via CSS `min-height` on the description element.

## [0.19.2] - 2026-06-18

### Fixed

- `stage-all-files.sh` now detects and unstages symlinks pointing to gitignored directories (e.g. a `node_modules` worktree symlink), preventing accidental commits of ignored paths.

## [0.19.1] - 2026-06-18

### Fixed

- Remove accidentally committed `node_modules` symlink from the repository.

## [0.19.0] - 2026-06-18

### Added

- "Other…" option in Loan Agreement lender and borrower dropdowns — selecting it reveals a name field (lender) or name + bank account fields (borrower), allowing ad-hoc parties not in the registry.
- Bank account formatting helper that auto-formats 11-digit Norwegian account numbers as `xxxx.xx.xxxxx` in dropdown labels and PDF generation.

### Changed

- Loan Agreement modal now filters available borrowers based on the selected lender's `allowedBorrowers` list, with ChevronDown indicator and updated layout matching main branch improvements.
- Six native modals (LoanModal, RunModal, LogModal, CalendarModal, TranscribeModal, ReadingListModal) rethemed from hardcoded dark zinc Tailwind classes to the app's CSS variable design system, enabling correct rendering in both dark and light themes.

### Removed

- Valentina Valkova and Vshape Nails AS removed from the loan agreement stakeholder registry.

## [0.18.0] - 2026-06-18

### Added

- New lender "Valentina Valkova" and borrower "Vshape Nails AS" registered in loan stakeholders
- Conditional borrower filtering per lender: each lender now has an `allowedBorrowers` list so only relevant counterparties appear in the dropdown
- New "Accrued Loan Interest" workstream (`loan-interest` action) with a full transaction management modal — add, edit, delete loan disbursements and repayments per lender/borrower pair
- Skjermingsrente lookup from skatteetaten.no for automatic rate retrieval per bimonthly period

### Fixed

- Interest calculation now locks the skjermingsrente at the tranche creation date; rate changes after a loan is made no longer retroactively affect outstanding tranches (FIFO repayment order preserved)

## [0.17.1] - 2026-06-18

### Changed

- Workflow modal now always shows the `updated` date as the version ("Updated DD Mon YYYY") instead of the optional semver version field — the date is always visible and always meaningful to users.
- LoanModal restyled to use the app's shared design tokens (`modal-panel`, `form-input`, `btn`, CSS variables) for visual consistency with other modals.
- Registry rule updated to document `updated` as the canonical user-facing version, with a corrected checklist item.

## [0.17.0] - 2026-06-17

### Added

- Loan Agreement Generator: structured form modal that collects lender, borrower, amount, date, and location, fetches the current skjermingsrente (shielding interest rate) from skatteetaten.no for the correct bimonthly period, generates a Norwegian-language PDF via Electron's printToPDF, saves it to `workflow-hub-data/loan-agreement/data/`, and reveals it in Finder.
- Separate lender and borrower party lists: all three parties (Christian Braathen, Decide AS, Bæredyktig AS) are available as lenders; only companies (Decide AS, Bæredyktig AS) are available as borrowers.
- Same-party validation in the loan modal: Generate button is disabled with a red warning when the same party is selected as both lender and borrower.

## [0.16.0] - 2026-06-17

### Added

- `setup_command` field on scaffold workflows: runs once after first clone (re-runs on command change) to install dependencies into the cache directory — no manual venv setup needed
- Automatic venv activation: if `setup_command` creates a `.venv`, it is sourced before Claude opens so all CLI tools are on PATH for the entire session
- Web Scraper now clones from GitHub (authoritative, committed state) and installs its own venv on first use

## [0.15.0] - 2026-06-17

### Added

- Voucher Folder Creator workflow: drag-and-drop bank statement screenshots onto the card, Claude reads them via the local `claude -p` CLI subprocess, and one sub-folder per transaction is created in the configured output directory with Norwegian Title Case naming rules.
- `bookkeeping` action type for workflow cards with a full multi-phase inline UI (idle drop zone, processing spinner, done list, error state).
- `pickFolder` IPC call now accepts an optional `defaultPath` so the Finder folder picker opens pre-navigated to the configured output directory.
- `.claude/guides/claude-subprocess.md` documenting the preferred pattern for invoking Claude headlessly from the Electron main process without calling the Anthropic API directly.

## [0.14.0] - 2026-06-17

### Added

- Web Scraper workflow card — paste any URL (web article, Instagram, LinkedIn, YouTube, PDF) and Claude runs the scrapers repo with `--output-dir` routing all output to `workflow-hub-data/web-scraper/data`
- `workflow-data-repo` rule mandating a corresponding data folder in `workflow-hub-data` for every registry workflow, with symlink/routing conventions for scaffold and external-repo workflows

## [0.13.0] - 2026-06-17

### Added

- Dark/light mode theming with automatic macOS system preference detection (`prefers-color-scheme`), manual Sun/Moon toggle in header, and localStorage persistence for override.
- Light theme using the lanserbart beige palette (`#f9f6f2` warm white base) via CSS custom properties.
- No-flash inline script in `index.html` applies the correct theme before React mounts.

### Changed

- Schedule status controls (cadence, last run, enable/disable, logs) moved from workflow cards into the workflow detail modal as a live Schedule section.
- Workflow cards now show a uniform footer with only the primary CTA button — schedule state no longer clutters the card grid.
- `InlineRecordButton` renamed to `TranscribeControls` with an `onTranscribed` callback and proper error state handling.
- `WorkflowCard` accepts new `clusterColor?` prop and `onOpen(id, initialPrompt?)` signature, consistent with the rest of the component tree.

## [0.12.0] - 2026-06-17

### Added

- Calendar Event Creator workflow: describe events in text, record voice, or paste a transit/flight screenshot — Claude generates AppleScript and runs it directly in Apple Calendar.
- New `calendar` workflow action type with `CalendarModal` component for the generate-review-execute flow.
- Main-process IPC handlers for `exec-osascript`, `read-clipboard-image`, and `generate-calendar-script`.
- `src/main/calendar.ts` with AppleScript conventions: programmatic date building, Oslo timezone, emoji titles, per-calendar alarm rules, walking legs in descriptions.

## [0.11.0] - 2026-06-17

### Added

- Add `transcribe_to_claude` flag to workflow registry — when set on a `claude`-action workflow, an inline voice recorder appears on the card below the "Open in Claude" button, separated by an "or transcribe" divider.
- After transcription completes, the text is automatically passed as the initial prompt when opening Claude, seeding the session with the spoken content (clipboard copy still occurs as well).
- Extend `openWorkflow` IPC call through the full stack (handler, preload bridge, type declarations, `handleOpen`) to accept an optional `initialPrompt` parameter; the no-prompt path is unchanged.

## [0.10.0] - 2026-06-17

### Added

- Reading List workflow card with inline controls: "Get from Reminders" button imports URLs from the "Leseliste" and "Prioritert leseliste" macOS Reminders lists, and a URL paste input lets users add links directly. Both import from and add to a local SQLite database at `workflows/reading-list/data/reading_list.db`.
- `ReadingListModal` for browsing all saved URLs, sorted by timestamp descending (entries without a timestamp sort last).
- Three IPC channels (`reading-list-import`, `reading-list-add-url`, `reading-list-get-entries`) bridging the renderer to Python scripts via `spawnSync`.
- Workflow registry rule (`.claude/rules/workflow-registry.md`) enforcing required fields on all registry entries.

### Changed

- Sidebar type `"run"` renamed to `"routine"` — label changes from "Script" to "Routine" in the filter panel. The `routine` type now covers `run`, `reading-list`, and `transcribe` actions.

## [0.9.0] - 2026-06-17

### Added

- Workspace badge added to each workflow card (top-right of the title row in grid view, inline with the workflow name in list view), color-tinted from the workspace's hashed color. Badge is shown only when viewing "All workflows" — hidden when a workspace is selected from the sidebar.
- Schedule indicator moved next to the workspace badge on the name line in list view.
- Action button fixed to a uniform width (`w-24`) across all list rows so Open/Run buttons align consistently.
- Always-rendered `w-5` overflow slot ensures the `+N` tag pill right-aligns with other rows even when fewer than 4 tags are present.

### Changed

- Workspace section dividers (colored header bars) removed from the main content area; the layout is now a single unbroken workflow grid/list.

## [0.8.0] - 2026-06-17

### Added

- Package Workflow Hub as a native macOS `.app` via `electron-builder` — run `make dist` to produce a `.dmg` and `.app` bundle launchable from Spotlight, Raycast, or the Dock without a terminal open
- App icon (`resources/icon.icns`) generated from the existing logo asset

## [0.7.0] - 2026-06-17

### Added

- Voice Transcriber workflow card with in-card Record/Stop button, 5-minute countdown timer with auto-stop, and live transcription via OpenAI Whisper (gpt-4o-transcribe model).
- Transcriptions are automatically copied to clipboard after each recording.
- Last transcription shown on the card with a one-click Copy button.
- Transcription log persists for 24 hours; accessible via a modal by clicking the card body.
- OpenAI API key loaded from a `.env` file at the repo root — works from both the main checkout and any worktree via `git rev-parse --git-common-dir`.
- `.prettierignore` added; full codebase formatted with Prettier so `make lint` now passes cleanly.

## [0.6.0] - 2026-06-17

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

## [0.5.0] - 2026-06-17

### Changed

- Renamed project from `ai-workflow-hub` to `workflow-hub` across all source files, documentation, configuration, and workflow scripts.

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

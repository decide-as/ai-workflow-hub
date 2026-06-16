<!-- markdownlint-disable MD013 MD024 -->
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

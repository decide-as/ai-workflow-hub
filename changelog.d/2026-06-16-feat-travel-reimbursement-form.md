---
bump: minor
phase: mvp
---

### Added

- Travel Reimbursement workflow (`workflows/travel-reimbursement-form/`): a Claude-driven workflow that turns a trip's receipts into a Norwegian-format travel expense report (Excel) plus a bookkeeping summary. Ships the full `.claude` instruction set (attachment intake with SHA-256 dedup, semantic grouping of documents into one transaction, HEIC→JPG, UUID→`0#` renaming; transaction extraction and ordering; VAT rules and the seven ledger categories; `standardsatser` allowance; markup and bookkeeping summary), reference docs (Skatteetaten rates with row map and the Fiken/MVA FAQ), the `.xlsx` report template, and example inputs
- `scripts/generate_report.py` (openpyxl): fills only the template's input cells and leaves its formulas intact, bakes computed totals via LibreOffice so they display in any viewer (Excel, Numbers, LibreOffice), and validates the data plus cross-checks every computed total (grand, markup combined, and per-category NOK/other × refunded/not) against the transaction sums

### Changed

- Workflow `repo_path` may be relative to the app root and is resolved at open time, so bundled workflows ship machine-independent paths instead of hardcoded absolutes
- Remove the 12 seed mock workflows and reset the registry to empty

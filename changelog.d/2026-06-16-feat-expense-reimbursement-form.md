---
bump: minor
---

### Added
- Expense Reimbursement workflow: a Norwegian Utleggsskjema (Excel) built from receipts via Claude, with reverse-VAT extraction, a gitignored per-batch data folder, and 0#/Bilagsnr attachment numbering.
- Bank Transaction Triage workflow: ingest many bank exports (PDF/CSV/XLSX), normalize and dedup every line against a hash-keyed master ledger, triage register/route/skip, and route reimbursable items into the Expense/Travel forms.

### Changed
- Workflow cards show a one-line summary (full text stays in the modal) and are wider; a Finance cluster groups the finance workflows in the sidebar and sections.

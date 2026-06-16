# Scripts

Deterministic helpers the agent runs during a session.

## `generate_report.py`

Fills `templates/expense-reimbursement-report.xlsx` from `profile.json` +
`data/<batch-slug>/report.json` and writes the final workbook to
`data/<batch-slug>/output/`. It writes **only input cells** — the header (Company
`C4`, Claim date `C5`, Name `C9`, Bank account `C10`) and the ledger (rows 13–106,
columns `B`–`I`). The per-row VAT amount/net and the column totals are template
formulas that recalc when the file is opened.

```
python3 scripts/generate_report.py \
  --report   data/<batch-slug>/report.json \
  --profile  profile.json \
  --template templates/expense-reimbursement-report.xlsx \
  --out      data/<batch-slug>/output/<batch-slug>.xlsx
```

Requires **openpyxl**: `python3 -m pip install --user openpyxl`. After filling the
template, it recalculates the workbook with **LibreOffice** (headless) to bake the
computed totals into the file — openpyxl writes formulas but no results, so without
this some viewers (Numbers, Excel for Mac) show blank/zero totals. If LibreOffice
isn't installed the generator still works and sets `fullCalcOnLoad`, so the totals
recalc when the file is opened in Excel; install LibreOffice for pre-baked totals.

Input schema: `report.example.json`. Behavior/rules: `.claude/rules/04-output-excel.md`.

It validates the data (category is one of the ten; currency mandatory; `vat_rate`
is `0.25/0.15/0.12/0`; foreign-currency rows must be `0`; amount mandatory; max 94
rows) and, after baking, cross-checks the workbook's computed totals against the
transaction sums (gross incl. VAT, extracted VAT, net excl. VAT). It exits non-zero
with a clear message on any violation.

## Other helpers

HEIC→JPG conversion and SHA-256 dedup use macOS built-ins (`sips`, `shasum`) — no
extra dependencies (see `.claude/rules/01-intake-attachments.md`).

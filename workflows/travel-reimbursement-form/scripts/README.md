# Scripts

Deterministic helpers the agent runs during a session.

## `generate_report.py`

Fills `templates/travel-expense-report.xlsx` from `profile.json` +
`data/<trip-slug>/report.json` and writes the final workbook to
`data/<trip-slug>/output/`. It writes **only input cells** (header, ledger,
allowance quantities, markup rates); all totals, the markup roll-up, and the
bookkeeping summary are template formulas that recalc when the file is opened.

```
python3 scripts/generate_report.py \
  --report   data/<trip-slug>/report.json \
  --profile  profile.json \
  --template templates/travel-expense-report.xlsx \
  --out      data/<trip-slug>/output/<trip-slug>.xlsx
```

Requires **openpyxl**: `python3 -m pip install --user openpyxl`. After filling the
template, it recalculates the workbook with **LibreOffice** (headless) to bake the
computed totals into the file — openpyxl writes formulas but no results, so without
this some viewers (Numbers, Excel for Mac) show blank/zero totals. If LibreOffice
isn't installed the generator still works and sets `fullCalcOnLoad`, so the totals
recalc when the file is opened in Excel; install LibreOffice for pre-baked totals.

Input schema: `report.example.json`. Behavior/rules: `.claude/rules/06-output-excel.md`.

It validates the data (VAT vs currency, ledger category, mandatory currency, max
28 ledger rows) and exits non-zero with a clear message on violation.

## Other helpers

HEIC→JPG conversion and SHA-256 dedup use macOS built-ins (`sips`, `shasum`) — no
extra dependencies (see `.claude/rules/01-intake-attachments.md`).

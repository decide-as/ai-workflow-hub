# Templates

The form template lives here as `expense-reimbursement-report.xlsx`.

The generator (`scripts/generate_report.py`) fills this template's input cells —
the header and the receipt ledger — and writes the result to
`data/<batch-slug>/output/<batch-slug>.xlsx`. Keeping a fixed template preserves
the exact layout, styling, and formulas across runs.

The template stores VAT **in reverse**: you fill the gross amount incl. VAT
(column H, in NOK) and the Norwegian VAT rate (column I); the template derives the
VAT amount (column J = `H × I / (1 + I)`) and the net excl. VAT (column K), and
totals the columns at row 107. It carries `fullCalcOnLoad` so those formulas
recompute on open.

> Status: `expense-reimbursement-report.xlsx` is **present** and wired to the
> generator (cell map in `.claude/rules/04-output-excel.md`).

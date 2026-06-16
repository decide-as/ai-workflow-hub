# Templates

Place the report template here as `travel-expense-report.xlsx`.

The generator (`scripts/generate_report.py`) fills this template's cells — header,
the actual-expenses ledger, the `standardsatser` allowance table, the
rebilling/markup table, and the bookkeeping summary — and writes the result to
`data/<trip-slug>/output/<trip-slug>.xlsx`. Keeping a fixed template preserves the
exact layout, styling, and formulas across runs.

> Status: `travel-expense-report.xlsx` is **present**. The remaining piece is the
> generator (`scripts/generate_report.py`), to be written against this template's
> cell map (see `.claude/rules/06-output-excel.md`).

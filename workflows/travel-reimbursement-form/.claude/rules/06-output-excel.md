# 06 — Output: the Excel report

The deliverable is one Excel workbook in `data/<trip-slug>/output/`, built from
the template at `templates/travel-expense-report.xlsx`, alongside the receipts
renamed to their final `0#` numbers.

## Generation

The report is produced **deterministically from the template**, not hand-built,
so formatting and formulas stay exact run-to-run. Build
`data/<trip-slug>/report.json` (schema: `report.example.json`), then run:

```
python3 scripts/generate_report.py \
  --report   data/<trip-slug>/report.json \
  --profile  profile.json \
  --template templates/travel-expense-report.xlsx \
  --out      data/<trip-slug>/output/<trip-slug>.xlsx
```

Requires `openpyxl` (`python3 -m pip install --user openpyxl`).

**The generator only fills input cells** — header (B3–B11), the ledger
(rows 15–42, cols A/B/F/G/H/I/J/K), allowance **quantities** (col H, rows 47–67),
and markup **rates** (col H, rows 71–78). Everything else — allowance rates and
totals, the markup roll-up, and the entire **bookkeeping summary** — are the
template's own formulas and recalculate when the workbook is opened. Do not try to
compute those yourself.

It enforces the rules: NOK rows need VAT / non-NOK rows must not have it; category
must be one of the seven ledger categories; original currency is mandatory; max
**28** ledger rows. Fix the data if it errors — don't bypass it.

After filling, it recalculates the workbook (LibreOffice) so the totals are baked
in, then **cross-checks** the workbook's computed totals against sums taken
straight from the transactions — the grand total, the markup combined total, and
every per-category bookkeeping cell (NOK/other × refunded/not). If any disagree it
fails: that means a row landed outside a formula's range or a category is off, not
that the data is wrong. Don't bypass it.

`report.json`'s `allowance` entries are keyed by **template row** (47–67); see
`.claude/reference/skatteetaten-rates-2026.md` for the row meanings.

## Report layout (target)

The template has four blocks — fill from the data you built:

1. **Header** — from `profile.json`: Name, Address, Postal code/City, Bank
   account no., Email; then Date/time travel start, Date/time travel end, Date
   submitted (today).
2. **Actual expenses** — one row per transaction, ordered per `02`:
   `Date · Expense type and purpose · Attachment no. (0#) · Amount (NOK) ·
   Of which VAT · Category · Rebilled to customer · Original currency`.
3. **Expense coverage (`standardsatser`)** — the allowance rates table with
   quantities and totals (blank/Sum 0 if allowance not used). See `04`.
4. **Roll-ups** — the rebilling/markup table and the **Summary for bookkeeping**
   (categories × NOK / Other currencies, non-markup amounts). See `05`.

## Final ordering & attachments

Before generating: order transactions (`02`), assign `0#` numbers, write them
into `manifest.json`, and copy the receipts into `output/` renamed to `01.<ext>`,
`02.<ext>`, … (`01`-style zero-padded). The "Attachment no." column cites these.

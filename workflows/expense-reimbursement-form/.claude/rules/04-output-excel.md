# 04 — Output: the Excel form

The deliverable is one Excel workbook in `data/<batch-slug>/output/`, built from
the template at `templates/expense-reimbursement-report.xlsx`, alongside the
receipts renamed to their final `0#` numbers.

## Generation

The form is produced **deterministically from the template**, not hand-built, so
formatting and formulas stay exact run-to-run. Build
`data/<batch-slug>/report.json` (schema: `report.example.json`), then run:

```
python3 scripts/generate_report.py \
  --report   data/<batch-slug>/report.json \
  --profile  profile.json \
  --template templates/expense-reimbursement-report.xlsx \
  --out      data/<batch-slug>/output/<batch-slug>.xlsx
```

Requires `openpyxl` (`python3 -m pip install --user openpyxl`).

**The generator only fills input cells** — the header (Company `C4`, Claim date
`C5`, Name `C9`, Bank account `C10`) and the ledger (rows 13–106, columns
`B`–`I`). Everything else — the per-row VAT split (`J`, `K`) and the column totals
at row 107 — are the template's own formulas and recalculate when the workbook is
opened. Do not try to compute those yourself.

It enforces the rules: category must be one of the **ten**; currency is mandatory;
`vat_rate` must be one of `0.25 / 0.15 / 0.12 / 0`; foreign-currency rows must have
`vat_rate` `0`; amount is mandatory; max **94** ledger rows. Fix the data if it
errors — don't bypass it.

After filling, it recalculates the workbook (LibreOffice) so the totals are baked
in, then **cross-checks** the computed totals against sums taken straight from the
transactions — gross (incl. VAT), the extracted Norwegian VAT, and net (excl.
VAT). If any disagree it fails: that means a row landed outside a SUM range or a
rate didn't write through, not that the data is wrong. Don't bypass it.

## Report layout (target)

The template has three blocks — fill from the data you built:

1. **Header** — Company (the entity claimed against), Claim date (today unless
   told otherwise), and from `profile.json`: Name and Bank account no.
2. **Receipt ledger** — one row per transaction, ordered per `02`:
   `Date · Bilagsnr (0#) · Supplier · Description & purpose · Category · Currency ·
   Amount incl. VAT (NOK) · Norwegian VAT %`. The form fills VAT amount and net.
3. **Total** — gross incl. VAT (the amount to reimburse), total VAT, and net. All
   template formulas.

## Final ordering & attachments

Before generating: order transactions (`02`), assign `0#` numbers, write them into
`manifest.json`, and copy the receipts into `output/` renamed to `01.<ext>`,
`02.<ext>`, … (`01`-style zero-padded). The **Bilagsnr** column cites these.

## Present to the user

After generating, summarise: the number of receipts, the **total to reimburse**
(gross), the total Norwegian VAT, and any rows where you derived a VAT rate or
assumed a default — so the user can sanity-check before filing. Point to the FAQ
for registering foreign-currency lines.

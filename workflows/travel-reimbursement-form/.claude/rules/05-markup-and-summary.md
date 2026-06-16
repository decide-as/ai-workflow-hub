# 05 — Markup roll-up & bookkeeping summary

Two separate roll-ups. Do not conflate them.

## Rebilling / markup table

Template-driven (rows 71–78, eight rows incl. "Subsistence and supplements",
whose figure comes from the allowance section). You supply only the **markup rate
per category** via `report.json` `markup` (default **10%** each, from the up-front
question); the template computes "Rebilled to customer" and "Combined" from the
ledger's `rebilled_nok` values.

Markup applies **only here** — never to the bookkeeping summary.

## Summary for bookkeeping (what the user registers)

This is the important output. In the template it is **formula-driven** — you fill
the ledger and the template computes it. Its shape:

- **Rows** = the seven ledger categories:
  `Transport, Hotel, Fuel, Meals, Phone, Entertainment, Misc`
  (Subsistence/allowance is not a bookkeeping-summary row here).
- **Columns** = `NOK` and `Other currencies` (two columns).
- **Cells** = the **total non-markup amount** for that category, split by the
  transaction's `original_currency`:
  - `original_currency == NOK` → the **NOK** column.
  - anything else → the **Other currencies** column.
- Add a **Total** row.

Use the raw `amount_nok` values (everything is already expressed in NOK); the
NOK-vs-other split is by **origin currency**, not by amount unit. Markup is **not**
included here.

When you present this summary, point the user to the **FAQ**
(`.claude/reference/fiken-mva-faq.md`) for how to register each kind of line —
particularly foreign-currency purchases (no Norwegian VAT deduction; use the
correct `Grunnlag`/`Tjeneste utlandet` mva-code), since this summary is what they
enter into their accounts.

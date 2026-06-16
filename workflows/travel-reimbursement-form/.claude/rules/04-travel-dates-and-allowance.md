# 04 — Travel dates & the allowance section

## Travel start / end

Derive the trip window from the **Transport** transactions — the first outbound
and last inbound legs bound the trip.

- If the report uses **`standardsatser`**, travel **times are mandatory** (the
  allowance brackets depend on duration — 6–12 h vs over 12 h). Capture the
  best-known departure time of the first leg and arrival time of the last.
- If it does **not** use `standardsatser`, only the **dates** are mandatory.

If a needed time can't be read from a receipt, ask the user.

## Date submitted

= today. Derive with `date +%Y-%m-%d` and format to match the template.

## Expense coverage — `standardsatser` (allowance)

Only fill this section if the user opted into allowance rates (the up-front
question). Otherwise leave every quantity blank so the section sums to 0 (as in
the reference report).

Rates are in `.claude/reference/skatteetaten-rates-2026.md`. To fill the section:

1. Pick the applicable **per-diem** row by accommodation type:
   - hotel → 617,00 NOK/day
   - other accommodation without cooking facilities → 172,00
   - work travel with cooking facilities → 95,00
2. Multiply by the number of qualifying days; record the **quantity** and total.
3. **Subtract meal deductions** for any meal that was *also* covered by a receipt,
   was provided, or was included in the price — to avoid double-dipping
   (breakfast / lunch / dinner each have a deduction rate per per-diem type). A
   meal claimed via an actual receipt in the ledger **must** be deducted here.
4. Add **day allowance** (6–12 h / over 12 h), **night supplement** (domestic
   travel only), and **mileage**/passenger/road/equipment supplements per km if
   the user drove. Record quantities and totals.
5. The section's **Sum** is the net allowance.

Be explicit with the user about which meals you deducted and why. When in doubt
about eligibility, ask rather than over-claim — this is a tax-free benefit and
must be defensible.

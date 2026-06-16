# 04 — Routing to the forms

After the new lines are dispositioned and appended to the ledger (`02`/`03`), hand
the reimbursable subsets to the existing reimbursement workflows. The two form
workflows live alongside this one:

```
../expense-reimbursement-form/   # Expense Reimbursement
../travel-reimbursement-form/    # Travel Reimbursement
```

## reimburse-expense → Expense Reimbursement

Assemble the `reimburse-expense` lines into that form's `report.json` shape (see
`../expense-reimbursement-form/report.example.json`):

- `date` ← line date; `supplier` ← merchant from the description; `description` ←
  business purpose (ask the user where it isn't obvious); `currency` ← line currency;
  `amount_incl_vat` ← `abs(amount)`.
- `category` and `vat_rate` ← propose per that workflow's
  `.claude/rules/03-vat-and-categories.md` (foreign rows → rate 0), and have the
  user confirm.

Write it to `data/<batch>/routed/expense-report.json`. A bank line has no receipt
image or printed VAT, so this is a **draft**: the user finishes it in the Expense
Reimbursement workflow — attaching the receipts (which provide the `0#`/Bilagsnr
and confirm VAT) — before generating the final form. You may run that workflow's
generator on the draft to preview totals, but flag clearly that receipts and VAT
still need verification.

## reimburse-travel → Travel Reimbursement

Group the `reimburse-travel` lines by their `trip`, then assemble each trip into the
Travel Reimbursement `report.json` (`../travel-reimbursement-form/report.example.json`):
ledger transactions per line, plus the trip's start/end dates (ask the user).
Write to `data/<batch>/routed/travel-<trip>.json`. Same caveat: it's a draft to be
completed in the Travel workflow (receipts, allowance, VAT).

## register-direct

v1 does **not** generate a bookkeeping sheet. Output the `register-direct` lines as a
simple list (`data/<batch>/routed/register-direct.md`: date · amount · supplier ·
suggested account/category) for the user to book in Fiken. (Generating a
Fiken-style sheet here is a planned next increment.)

## skip / maybe

Nothing to route — `skip` is logged and done; `maybe` waits for a later pass.

## Hand-off summary

Finish by telling the user, per disposition: how many lines, the totals, and the
exact next action ("open the Expense Reimbursement workflow on
`data/<batch>/routed/expense-report.json` to attach receipts and generate").

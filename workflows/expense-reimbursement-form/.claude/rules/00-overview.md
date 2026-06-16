# 00 — Overview & folder layout

## What this produces

A Norwegian **Expense Reimbursement Form** (*Utleggsskjema*) with three parts
(see the template, `templates/expense-reimbursement-report.xlsx`):

1. **Header** — company being claimed against, claim date, and the employee's
   name + bank account (from the profile).
2. **Receipt ledger** — one row per receipt: date, *Bilagsnr* (= the attachment
   `0#`), supplier, description & business purpose, category, currency, amount
   incl. VAT, and the Norwegian VAT rate. The form derives the VAT amount and the
   net (excl. VAT) per row.
3. **Total** — the column totals (gross incl. VAT, VAT, net) — the gross total is
   the **amount to reimburse** (*Sum til utbetaling*).

There is **no allowance section and no markup/rebilling** — that is the Travel
Reimbursement workflow. This one is a flat, VAT-aware receipt ledger.

## Folder layout (per batch)

All working state lives under `data/` (gitignored — never committed):

```
data/<batch-slug>/
├── inbox/            # the user drops raw receipts here (any format/name)
├── attachments/      # processed receipts stored as <uuid>.<ext> during the run
├── manifest.json     # attachment log: uuid → { original_name, ext, sha256, number }
├── report.json       # generator input: header + transactions
└── output/           # final deliverables: <batch-slug>.xlsx + receipts renamed to 0#
```

- `<batch-slug>` is a kebab-case slug of the batch name (e.g. `office-supplies-q2-2026`).
- The user adds receipts by dropping files into `inbox/`. You may also accept
  file paths or pasted images directly in chat — treat those the same as inbox.
- `data/` is gitignored, so it may not exist yet — create the batch's folders at
  the start of a run: `mkdir -p data/<batch-slug>/{inbox,attachments,output}`.

## Profile

`profile.json` (gitignored) holds the identity used on every form: `name`,
`bank_account`, and a default `company`. Copy `profile.example.json` if missing.

## Dates

- **Claim date** defaults to today. Derive it with `date +%Y-%m-%d` (never guess).
  Confirm with the user if the claim is dated differently.
- Each receipt's **transaction date** comes from the receipt itself.

## Non-negotiables

- **Amounts (incl. VAT) are read from the receipts in NOK. Never invent or
  auto-convert an exchange rate.** (See `02-transactions.md`.)
- Every transaction gets **exactly one** category, a **mandatory** currency, and a
  **Norwegian VAT rate** (one of `25% · 15% · 12% · 0%`).
- Foreign-currency purchases carry **no deductible Norwegian VAT → rate 0%**.
- When unsure about a number that affects the filing, **ask the user**.

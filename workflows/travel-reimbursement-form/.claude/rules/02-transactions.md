# 02 — Transactions (the actual-expenses ledger)

One row per receipt line item. Build the `transactions` array inside
`data/<trip-slug>/report.json` (the generator's input — see `report.example.json`
and `06-output-excel.md`). Each entry:

| Field | Notes |
|-------|-------|
| `date` | Transaction date. Try to capture **time** too (see ordering + travel dates). |
| `time` | `HH:MM` if the receipt shows it; else null. |
| `description` | "Expense type and purpose" — merchant + what/where, e.g. `Uber – ride (London)`. |
| `attachment_ids` | UUIDs of the receipt(s) backing this row (→ `0#` at the end). |
| `amount_nok` | Amount in **NOK** (see below). |
| `vat_nok` | "Of which VAT" — see `03-vat-and-categories.md`. |
| `category` | Exactly one of the seven ledger categories (see `03`). |
| `rebilled_nok` | Amount to bill the customer; **blank unless the user says so**. |
| `original_currency` | **Mandatory** ISO code (e.g. `NOK`, `GBP`). |

## Amount (NOK)

- Read the amount **from the receipt/attachment**. If the receipt is already in
  NOK, use it.
- **Norwegian bank-app screenshots are the usual NOK source.** Many "receipts"
  are screenshots of the card transaction in a Norwegian banking app, which show
  both the foreign amount **and the NOK actually charged** (often including a
  currency fee), e.g. *"kr 269,04 (incl. kr 6,56 fee) · GBP 21.06"*. Use that NOK
  figure — the full charge incl. fee — as `amount_nok`, and the foreign code as
  `original_currency`.
- **Never invent or auto-convert an exchange rate yourself.** If a foreign receipt
  has **no NOK figure anywhere** (e.g. a paper receipt with only the GBP total and
  no matching bank screenshot), **stop and ask the user** for the NOK amount that
  was charged to the account. Do not guess or apply an FX rate. (This is also what
  Fiken needs — see the FAQ.)

## Original currency (mandatory)

Derive from the currency symbol/code on the receipt, or from the country of the
receipt when the symbol is ambiguous (a London Tesco receipt → `GBP`). This field
drives the bookkeeping split (NOK vs other currencies), so it must always be set.

## Rebilled to customer

Leave blank by default. Only fill it when the user explicitly says a given
expense is rebilled, and then it holds the **amount** to bill them (in NOK).

## Ordering

Pick the rule based on whether you have **time** for *all* transactions:

- **All have date + time** → order by full datetime, ascending.
- **Any are date-only** → order by:
  1. `date` ascending, then
  2. **category**, in this fixed order:
     `Transport, Hotel, Fuel, Meals, Phone, Entertainment, Misc`, then
  3. **original currency**: `NOK` first, then other currencies alphabetically.

The final order determines the `0#` attachment numbering (see `01`).

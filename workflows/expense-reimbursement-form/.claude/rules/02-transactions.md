# 02 — Transactions (the receipt ledger)

A ledger row is one **expense** — a single category at a single VAT rate — not one
physical receipt and not one SKU. A receipt with several items of the **same**
category and rate is **one** row; a receipt spanning rates or categories is
**split** (see "Multi-item receipts" below). Build the `transactions` array inside
`data/<batch-slug>/report.json` (the generator's input — see `report.example.json`
and `04-output-excel.md`). Each entry:

| Field | Column | Notes |
|-------|--------|-------|
| `date` | B (Date) | Transaction date from the receipt. |
| `attachment_ids` | — | UUIDs of the receipt(s) backing this row (→ `0#` at the end). |
| `attachment_no` | C (Bilagsnr) | The `0#` number(s), set at the end (see `01`). |
| `supplier` | D (Supplier) | Merchant / vendor name, e.g. `Rema 1000`, `Transport for London`. |
| `description` | E (Description & purpose) | What it was **and the business purpose**, e.g. `Coffee with client – sales meeting`. |
| `category` | F (Category) | Exactly one of the ten categories (see `03`). |
| `currency` | G (Cur.) | **Mandatory** ISO code (e.g. `NOK`, `GBP`). Default `NOK`. |
| `amount_incl_vat` | H (Amount incl. VAT) | Gross amount in **NOK** (see below). |
| `vat_rate` | I (Norwegian VAT %) | One of `0.25 · 0.15 · 0.12 · 0` (see `03`). |

The form derives the **VAT amount** (J) and **net excl. VAT** (K) per row, and the
**totals** at row 107 — you never fill those.

## Amount (NOK, incl. VAT)

- Read the amount **from the receipt/attachment**. If the receipt is already in
  NOK, use it. This is the **gross** amount, including VAT.
- **Norwegian bank-app screenshots are the usual NOK source.** Many "receipts"
  are screenshots of the card transaction in a Norwegian banking app, which show
  both the foreign amount **and the NOK actually charged** (often including a
  currency fee), e.g. *"kr 269,04 (incl. kr 6,56 fee) · GBP 21.06"*. Use that NOK
  figure — the full charge incl. fee — as `amount_incl_vat`, and the foreign code
  as `currency`.
- **Never invent or auto-convert an exchange rate yourself.** If a foreign receipt
  has **no NOK figure anywhere** (e.g. a paper receipt with only the GBP total and
  no matching bank screenshot), **stop and ask the user** for the NOK amount that
  was charged to the account. Do not guess or apply an FX rate.

## Currency (mandatory)

Derive from the currency symbol/code on the receipt, or from the country of the
receipt when the symbol is ambiguous (a London Tesco receipt → `GBP`). The currency
decides the VAT rate: anything other than `NOK` carries **no Norwegian VAT** (rate
`0`) — see `03`.

## Supplier & description

- `supplier` is the vendor (column D). Keep it short and recognisable.
- `description` (column E) must state **what** and **why** — the business purpose.
  "Lunch" is not enough; "Lunch with client – contract review" is. For
  **Entertainment/representation**, the purpose and the attendees matter (see the
  note on the form and `03`).

## Multi-item receipts

One receipt can produce one row or several — decide by category and VAT rate, not
by the number of items printed:

- **All items share one category and one VAT rate → one row.** Use the receipt
  total as `amount_incl_vat` and a summary `description` (e.g. `Groceries — office
  kitchen`). Do not create a row per SKU.
- **Items span different VAT rates or categories → one row per rate/category**,
  each citing the **same** attachment `0#` (Bilagsnr). The reverse-VAT model needs
  a single rate per row, so a mixed-rate receipt *must* be split for the VAT to be
  correct. The split rows must sum to the amount actually charged.
- **Small incidental add-ons stay on the parent row — do not split them out.**
  Shipping, freight, postage on a purchase, a carrier bag, deposits, or small
  handling fees belong on the **same row** as the item they accompany, under that
  item's category and VAT rate. Under Norwegian MVA, ancillary costs like freight
  follow the main good's rate, so this is also the correct treatment — not just a
  simplification. Only split when the receipt holds genuinely **distinct
  expenses** (e.g. groceries + electronics), not when it itemises one purchase
  plus its delivery.

Norwegian receipts print an **MVA summary by rate** (grunnlag + mva per 25/15/12%)
at the bottom — use those subtotals as the per-row gross amounts. If a receipt
mixes rates but doesn't print the split, **ask** for the breakdown rather than
guess. (This is the inverse of the grouping rule in `01`, where several documents
for one purchase collapse into one row.)

## Ordering

Pick the rule based on whether you have **time** for *all* transactions:

- **All have date + time** → order by full datetime, ascending.
- **Any are date-only** → order by:
  1. `date` ascending, then
  2. **category**, in this fixed order:
     `Transport, Hotel, Fuel, Meals, Entertainment, Phone, Office supplies,
     Parking/Toll, Postage/Courier, Misc`, then
  3. **currency**: `NOK` first, then other currencies alphabetically.

The final order determines the `0#` attachment numbering / Bilagsnr (see `01`).

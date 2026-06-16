# 03 — VAT and categories

## Category (exactly one)

Every transaction must be classified into **exactly one** of these **ten**
categories (the form's intended dropdown):

`Transport · Hotel · Fuel · Meals · Entertainment · Phone · Office supplies ·
Parking/Toll · Postage/Courier · Misc`

Guidance:
- Flights, trains, metro/Tube, buses, taxis, ride-hail, airport express → **Transport**.
- Hotels / lodging → **Hotel**. Fuel / EV charging → **Fuel**.
- Food, groceries, coffee, restaurant meals → **Meals**.
- Client entertainment / representation → **Entertainment** (see the note below).
- SIM / roaming / phone / telecom → **Phone**.
- Stationery, hardware, software bought outright → **Office supplies**.
- Parking and road tolls (bompenger) → **Parking/Toll**.
- Postage, shipping, couriers → **Postage/Courier**.
- Anything that genuinely fits none of the above → **Misc** (use sparingly; ask
  if unsure).

## The VAT model (read this carefully)

The form stores VAT **in reverse**: you enter the **gross amount incl. VAT** (H)
and the **Norwegian VAT rate** (I); the form computes the VAT amount
(`J = H × I / (1 + I)`) and the net (`K = H − J`). So `vat_rate` is a **rate**, not
a kroner figure, and it must be one of: **`0.25` · `0.15` · `0.12` · `0`**.

**Rule 1 — prefer the printed VAT.** Norwegian receipts show the MVA. If the
receipt prints a VAT breakdown, choose the rate that matches it. If the printed
split implies a rate outside `{25, 15, 12, 0}` (e.g. a mixed-rate till receipt),
**split it into separate rows per rate**, or ask.

**Rule 2 — foreign currency → rate 0.** Any row whose `currency` is not `NOK`
carries **no deductible Norwegian VAT**: set `vat_rate` to `0`. (The generator
enforces this.) See the FAQ for how to register these in Fiken.

**Rule 3 — when VAT isn't printed (NOK rows), use the category default below and
say you derived it.** When in doubt, ask — these figures get filed.

## Default Norwegian VAT rate by category (NOK receipts)

| Category | Typical rate | Notes |
|----------|-------------:|-------|
| Transport | **12%** | Domestic passenger transport. **International transport is 0%.** |
| Hotel | **12%** | Norwegian accommodation. |
| Fuel | **25%** | |
| Meals | **15% or 25%** | Groceries / takeaway foodstuffs = **15%**; restaurant *serving* (eat-in, catering) = **25%**. Use the printed split. |
| Entertainment | **0%** | Representation VAT is generally **not deductible** — enter `0` unless your accountant says otherwise. Attach the purpose + attendee list (name + company) per Skatteetaten. |
| Phone | **25%** | |
| Office supplies | **25%** | |
| Parking/Toll | **25% or 0%** | Parking = **25%**; road tolls (**bompenger**) are exempt = **0%**. Split if a row mixes both. |
| Postage/Courier | **25%** | |
| Misc | **read the receipt** | No safe default — take the printed rate or ask. |

These defaults apply only to **NOK** rows. Foreign rows are always `0` (Rule 2).

When you classify, also tell the user how to register the line in bookkeeping
using the **FAQ** (`.claude/reference/fiken-mva-faq.md`) — especially foreign
purchases, where no Norwegian VAT deduction applies.

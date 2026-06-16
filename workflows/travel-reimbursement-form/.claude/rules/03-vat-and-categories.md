# 03 — VAT and categories

## Category (exactly one)

Every **ledger** transaction must be classified into **exactly one** of these
**seven** categories (the template's dropdown / `Sheet2` allows only these):

`Hotel · Transport · Fuel · Meals · Phone · Entertainment · Misc`

> **"Subsistence and supplements" is NOT a ledger category** in this template —
> it is the **allowance section** (`standardsatser`, rows 47–68). Its total flows
> into the markup table automatically. Never put a receipt row under Subsistence;
> if a cost doesn't fit the seven, it's **Misc** (ask if unsure).

Guidance:
- Flights, trains, metro/Tube, buses, taxis, ride-hail, airport express → **Transport**.
- Hotels / lodging → **Hotel**. Fuel/charging → **Fuel**.
- Food, groceries, coffee, snacks on the trip → **Meals**.
- SIM/roaming/phone → **Phone**. Client entertainment → **Entertainment**.
- Anything that genuinely fits none of the above → **Misc** (use sparingly; ask
  if unsure). Per-diem / subsistence is **not** a ledger row — it's the allowance
  section (`04`).

When you classify, also recommend how the user should register it in bookkeeping
using the **FAQ** (`.claude/reference/fiken-mva-faq.md`) — especially for
foreign-currency purchases, where no Norwegian VAT deduction applies.

## "Of which VAT"

This column is the Norwegian VAT portion of the amount.

**Validation:**
- If `original_currency` is **NOK** → `vat_nok` is **required** (state the VAT,
  even if it works out to 0 for a VAT-exempt item).
- If `original_currency` is **not NOK** → `vat_nok` must be **blank**. Foreign
  purchases carry no deductible Norwegian VAT (see FAQ §4–11).

If a NOK receipt shows a VAT figure explicitly, use the printed figure. Otherwise:

**Flights — domestic vs international:**
- **Domestic** Norwegian flights carry **12% VAT**, often not printed. Compute it
  as `vat = amount − amount / 1.12` and note you derived it.
- **International** flights (e.g. Oslo–London) are **zero-rated → VAT 0**. Do not
  apply 12% to an international ticket. (A NOK-origin ticket still needs the field
  filled — use `0`.)

**Food / groceries / meals** in Norway carry the reduced **15% VAT** rate
(`vat = amount − amount / 1.15`), not 25%. Transport (Flytoget etc.) is **12%**.
Use the printed figure when shown; otherwise apply the rate for the item type.
These rates apply only to **NOK-origin** rows — foreign rows stay blank.

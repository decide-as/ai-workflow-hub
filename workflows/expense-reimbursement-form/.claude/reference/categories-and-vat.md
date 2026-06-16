# Categories & Norwegian VAT — reference

Background for the rate choices in `03-vat-and-categories.md`. The form's
"Norwegian VAT %" column is the **rate of deductible Norwegian input VAT** in the
gross amount. Pick the rate from the **printed receipt** first; use these defaults
only when the receipt doesn't show it, and **say when you derived a rate**.

## Norwegian VAT rates (2026)

| Rate | Applies to |
|-----:|------------|
| **25%** | Standard rate — most goods and services (fuel, electronics, office supplies, restaurant *serving*, postage, parking). |
| **15%** | Foodstuffs (*næringsmidler*) — groceries and takeaway food. |
| **12%** | Passenger transport, accommodation (hotel), cinema, public broadcasting. |
| **0%** | Zero-rated / exempt — international transport, road tolls (*bompenger*), and **all foreign-currency purchases** (no Norwegian VAT to deduct). |

## Per-category notes & edge cases

- **Transport** — domestic passenger transport is **12%**. **International**
  transport (e.g. an Oslo–London flight) is **0%**, even when paid in NOK. A taxi
  in London paid in GBP is a foreign row → **0%** anyway.
- **Hotel** — Norwegian accommodation is **12%**. Breakfast included in the room
  rate follows the room (12%); a separately-billed restaurant meal is **Meals**.
- **Meals** — the split that trips people up: **groceries / takeaway foodstuffs =
  15%**, but **restaurant *serving* (eat-in, catering) = 25%**. A single till
  receipt can mix both — split it into two rows if the printed VAT shows two rates.
- **Entertainment (representation)** — input VAT on representation is generally
  **not deductible**, so enter **0%**. Skatteetaten requires the **business
  purpose and the full attendee list (name + company)** to be attached — capture
  these in the description / as an attachment. Confirm treatment with the user's
  accountant when material.
- **Parking/Toll** — parking is **25%**; **road tolls (bompenger) are exempt =
  0%**. Don't apply 25% to a bompenger charge.
- **Phone / Office supplies / Fuel / Postage/Courier** — standard **25%** for
  NOK purchases.
- **Foreign rows (any non-NOK currency)** — always **0%**. The deduction question
  is handled at bookkeeping time via the right mva-code, not on this form — see
  `fiken-mva-faq.md`.

## Splitting a mixed receipt

If one receipt covers items at different VAT rates (e.g. groceries at 15% + a hot
meal at 25%, or shopping that includes a bompenger line), create **one ledger row
per rate**, each citing the **same** attachment `0#`. The form totals them
correctly and the VAT per rate stays accurate.

**Exception — incidental add-ons stay with their parent.** Shipping, freight,
postage, a carrier bag, deposits, or small handling fees are kept on the **same
row** as the item they accompany, at that item's rate. Ancillary costs like
freight share the principal good's VAT rate under Norwegian MVA, so this is the
correct treatment. Split only for genuinely distinct expenses, not for one
purchase plus its delivery.

# 00 — Overview & folder layout

## What this produces

A Norwegian **Travel Expense Report** with four parts (see the template):

1. **Header** — traveler identity + travel start/end + date submitted.
2. **Actual expenses** — the itemized receipt ledger (one row per receipt).
3. **Expense coverage (`standardsatser`)** — the tax-free allowance section
   (filled only if the user opts into allowance rates).
4. **Roll-ups** — a rebilling/markup table and a **Summary for bookkeeping**
   (categories × NOK vs other currencies). The bookkeeping summary is the part
   the user actually registers in their accounting system.

## Folder layout (per trip)

All working state lives under `data/` (gitignored — never committed):

```
data/<trip-slug>/
├── inbox/            # the user drops raw receipts here (any format/name)
├── attachments/      # processed receipts stored as <uuid>.<ext> during the run
├── manifest.json     # attachment log: uuid → { original_name, ext, sha256, number }
├── report.json       # generator input: travel dates + transactions + allowance + markup
└── output/           # final deliverables: <trip-slug>.xlsx + receipts renamed to 0#
```

- `<trip-slug>` is a kebab-case slug of the trip name (e.g. `london-may-2026`).
- The user adds receipts by dropping files into `inbox/`. You may also accept
  file paths or pasted images directly in chat — treat those the same as inbox.
- `data/` is gitignored, so it may not exist yet — create the trip's folders at
  the start of a run: `mkdir -p data/<trip-slug>/{inbox,attachments,output}`.

## Profile

`profile.json` (gitignored) holds the header identity used on every report:
`name`, `address`, `postal_city`, `bank_account`, `email`. Copy
`profile.example.json` if it's missing.

## Dates

- **Date submitted** = today. Derive it with `date +%Y-%m-%d` (never guess).
- **Travel start/end** — see `04-travel-dates-and-allowance.md`.

## Non-negotiables

- **Amounts are read from the receipts in NOK. Never invent or auto-convert an
  exchange rate.** (See `02-transactions.md`.)
- Every transaction gets **exactly one** category and a **mandatory** original
  currency.
- The bookkeeping summary uses **non-markup** amounts.
- When unsure about a number that affects the filing, **ask the user**.

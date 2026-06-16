# Travel Reimbursement

Turn a trip's receipts into a Norwegian-format **Travel Expense Report** (Excel)
plus a bookkeeping summary, driven entirely by Claude.

## How it works

Opening this workflow from the AI Workflow Hub launches a Claude session in this
folder. Claude reads `CLAUDE.md` + `.claude/rules/` and runs the whole job:

1. Asks two up-front questions — use `standardsatser` (allowance rates)? and the
   customer markup rate (default 10%)?
2. Picks up the trip's receipts from `data/<trip-slug>/inbox/` (drop them there),
   dedupes by SHA-256, converts HEIC→JPG, and stores them by UUID.
3. Extracts transactions (amount in NOK as read from the receipt — no
   auto-conversion), classifies category / original currency / VAT.
4. Derives travel dates, fills the allowance section (if used), and computes the
   markup table and the **bookkeeping summary** (categories × NOK/other currency).
5. Numbers and renames the attachments to `0#`, then generates the Excel report
   from `templates/travel-expense-report.xlsx` into `data/<trip-slug>/output/`.

## Layout

```
CLAUDE.md                 # agent entry point (auto-loaded)
.claude/rules/            # the authoritative instructions
.claude/reference/        # Skatteetaten rates + Fiken/MVA FAQ
templates/                # the .xlsx report template (pending)
scripts/                  # generator + helpers
profile.example.json      # copy to profile.json (gitignored) and fill in
data/                     # gitignored working state: trips, attachments, output
```

## Setup

1. `cp profile.example.json profile.json` and fill in your details.
2. Add `templates/travel-expense-report.xlsx`.
3. Open the workflow and follow Claude's prompts.

`data/`, `profile.json`, and generated `*.xlsx` are gitignored — your receipts and
personal details never get committed.

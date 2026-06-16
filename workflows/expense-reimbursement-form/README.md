# Expense Reimbursement

Turn a batch of out-of-pocket business receipts into a Norwegian-format **Expense
Reimbursement Form** (*Utleggsskjema*, Excel) with the Norwegian VAT extracted per
line — driven entirely by Claude.

## How it works

Opening this workflow from the AI Workflow Hub launches a Claude session in this
folder. Claude reads `CLAUDE.md` + `.claude/rules/` and runs the whole job:

1. Confirms the **company** being claimed against and the **claim date** (today by
   default), and loads your name + bank account from `profile.json`.
2. Picks up the batch's receipts from `data/<batch-slug>/inbox/` (drop them there),
   dedupes by SHA-256, converts HEIC→JPG, and stores them by UUID.
3. Extracts transactions (amount incl. VAT in NOK as read from the receipt — no
   auto-conversion), classifies category / currency / Norwegian VAT rate.
4. Numbers and renames the attachments to `0#` (which become the *Bilagsnr*), then
   generates the Excel form from `templates/expense-reimbursement-report.xlsx`
   into `data/<batch-slug>/output/`.

The form derives the VAT amount, the net per line, and the total to reimburse.
There is **no allowance section and no markup** — for trips with per-diems or
rebilling, use the **Travel Reimbursement** workflow instead.

## Layout

```
CLAUDE.md                 # agent entry point (auto-loaded)
.claude/rules/            # the authoritative instructions
.claude/reference/        # category/VAT reference + Fiken/MVA FAQ
templates/                # the .xlsx form template
scripts/                  # generator + helpers
profile.example.json      # copy to profile.json (gitignored) and fill in
data/                     # gitignored working state: batches, attachments, output
```

## Setup

1. `cp profile.example.json profile.json` and fill in your details.
2. Open the workflow and follow Claude's prompts.

`data/`, `profile.json`, and generated `*.xlsx` are gitignored — your receipts and
personal details never get committed.

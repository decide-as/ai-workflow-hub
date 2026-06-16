# 00 — Overview & folder layout

## What this produces

1. A **master ledger** (`data/ledger.ndjson`) — the append-only, hash-keyed record
   of every transaction you have ever dispositioned, across all batches and
   accounts. This is the anti-duplicate guarantee.
2. Per batch, a **triage result**: every new transaction with its disposition and
   reason, and — for the reimbursable ones — batches handed to the **Expense** and
   **Travel Reimbursement** generators.

## Folder layout

All working state lives under `data/` (gitignored — never committed):

```
data/
├── ledger.ndjson              # MASTER ledger (all batches) — one JSON record per dispositioned line
└── <batch-slug>/
    ├── inbox/                 # the user drops raw bank exports here (PDF/CSV/XLSX)
    ├── normalized.json        # every line mapped to the common schema (transactions.example.json)
    ├── checked.json           # normalized.json tagged with fingerprint + seen/new (from ledger.py check)
    ├── dispositioned.json     # the NEW lines with a disposition + reason (appended to the ledger)
    └── routed/                # batches assembled for the Expense / Travel generators
```

- `<batch-slug>` is a kebab-case slug of the batch name (e.g. `q2-2026-reconciliation`).
- The master `ledger.ndjson` lives at the **top of `data/`**, not inside a batch —
  it spans every batch so dedup works across sessions.
- `data/` is gitignored, so it may not exist yet — create it as needed
  (`mkdir -p data/<batch-slug>/inbox`).

## Accounts

`accounts.json` (gitignored) declares each account so triage knows the defaults:

```json
{
  "personal-dnb":   { "kind": "personal", "currency": "NOK", "label": "DNB personal" },
  "company-sb1":    { "kind": "company",  "currency": "NOK", "label": "SpareBank 1 company card" }
}
```

- **personal** accounts hold out-of-pocket spending → candidates for
  `reimburse-expense` / `reimburse-travel`.
- **company** accounts are already paid by the firm → candidates for
  `register-direct` (book straight into the accounts).

Copy `accounts.example.json` if it's missing and ask the user to describe the
accounts in this batch.

## The pipeline

```
ingest (01) → normalize (01) → dedup-check (02) → triage NEW lines (03) →
append decisions to the ledger (02) → route reimburse-* to the forms (04)
```

## Non-negotiables

- **The ledger is the single source of truth.** Every line is dedup-checked against
  it before triage; only *new* lines are shown.
- **Never auto-register an ambiguous line** — propose, the user confirms (`03`).
- **Amounts are taken as they appear on the statement.** Never invent an FX rate.

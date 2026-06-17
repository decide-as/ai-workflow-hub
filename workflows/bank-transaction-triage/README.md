# Bank Transaction Triage

Upload many bank exports (PDF statements, CSV/XLSX) from one or more accounts and
triage every transaction — **register / route / skip** — while a hash-keyed master
ledger guarantees nothing is ever registered twice. The upstream Finance workflow:
it decides what each transaction is and feeds the reimbursable ones into the
**Expense** and **Travel Reimbursement** forms.

## How it works

Opening this workflow from the Workflow Hub launches a Claude session in this
folder. Claude reads `CLAUDE.md` + `.claude/rules/` and runs the whole job:

1. Normalizes every line from each export to a common schema (`01`).
2. Fingerprints each line and dedup-checks it against the master ledger, so only
   **new** transactions are shown (`02`, `scripts/ledger.py`).
3. Walks you through the new lines, proposing a disposition + reason for each —
   `register-direct` / `reimburse-expense` / `reimburse-travel` / `skip` / `maybe`
   (`03`).
4. Appends your decisions to the append-only ledger and routes the reimbursable
   subsets into the Expense / Travel forms (`04`).

## Dedup guarantee

Every transaction carries a content fingerprint (`account + date + amount +
description + balance-or-sequence`). Re-import an overlapping statement and every
prior line shows as already-dispositioned; only genuinely new lines surface. The
master ledger (`data/ledger.ndjson`) spans all batches and accounts.

## Layout

```
CLAUDE.md                 # agent entry point (auto-loaded)
.claude/rules/            # the authoritative instructions
scripts/ledger.py         # fingerprint + dedup engine
transactions.example.json # the normalized transaction schema
accounts.example.json     # copy to accounts.json (gitignored) and describe your accounts
data/                     # gitignored working state: the master ledger, batches, routed drafts
```

## Setup

1. `cp accounts.example.json accounts.json` and describe each account
   (personal vs company, currency).
2. Open the workflow and follow Claude's prompts.

`data/` (incl. the master ledger), `accounts.json`, and generated `*.xlsx` are
gitignored — your bank data never gets committed.

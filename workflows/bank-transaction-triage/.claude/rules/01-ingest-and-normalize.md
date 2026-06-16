# 01 — Ingest & normalize

Turn every bank export the user provides (from `inbox/`, pasted, or given paths)
into one flat list of transactions in the **common schema**, regardless of bank or
file format.

## Per export

1. **Identify the account.** Ask which account each file belongs to (match against
   `accounts.json`); a single file is one account. If the export spans an unknown
   account, add it to `accounts.json` (kind = personal/company, currency) first.
2. **Read the file.**
   - **CSV / XLSX** — read the columns directly. Identify the date, amount (or
     separate debit/credit columns), description/counterparty, and running balance.
   - **PDF statement** — read the text and pull the transaction rows. Watch for
     multi-line descriptions and page headers/footers that aren't transactions.
3. **Map each row to the schema** (see `transactions.example.json`):

   | Field | Notes |
   |-------|-------|
   | `account` | The account slug from `accounts.json`. |
   | `date` | ISO `YYYY-MM-DD`. **Confirm the day/month order** if the source is ambiguous (e.g. `03.04` — dd.mm in Norway). |
   | `amount` | **Signed**: money out is **negative**, money in **positive**. Merge separate debit/credit columns into one signed number. |
   | `currency` | The account currency unless the line states otherwise. |
   | `description` | Counterparty + any reference text, as printed. |
   | `balance` | Running balance after the line **if the statement shows it** — capture it, it strengthens dedup (`02`). Else `null`. |
   | `type` | Optional: `card` / `transfer` / `fee` / `interest` / … if known. |
   | `source_file` | The original filename. |

4. **Foreign-currency lines.** Use the amount **as it moved through this account**
   (the account-currency figure the statement settled). If the line also shows an
   original foreign amount, keep it in the `description`. Never invent an FX rate.

5. Write the combined list to `data/<batch>/normalized.json`.

## Cautions

- **Don't drop or merge rows during normalization** — every statement line becomes
  one record. Deduplication happens later (`02`) against the master ledger, not here.
- If you can't confidently read a value (an amount sign, a date, a garbled PDF
  row), **ask** rather than guess — this feeds tax filings.
- Tell the user the per-file counts ("DNB May: 42 lines; SpareBank 1: 18 lines")
  so they can sanity-check the extraction before triage.

> Bank-specific column maps and PDF quirks will be added here as real exports are
> seen. Until then, infer the layout per file and confirm anything ambiguous.

# 02 — Dedup & the master ledger

This is the heart of the workflow: **no transaction is ever registered twice**,
even when statements overlap or are re-imported in a later session.

## Fingerprint (content-hash-only)

Each normalized line gets a SHA-256 **fingerprint** computed by `scripts/ledger.py`:

```
fp = sha256( account | date | amount(2dp, signed) | norm(description) | disambiguator )
```

- `norm(description)` is casefolded with whitespace collapsed — trivial spacing/case
  differences between exports don't change the fingerprint.
- `disambiguator` is the post-transaction **balance** when the export has one
  (unique and stable per line), otherwise an intra-day **sequence index** among
  otherwise-identical lines.

**Capture the running balance whenever the statement shows it** (`balance` in the
normalized schema). It makes the fingerprint robust: two genuinely identical
same-day charges are told apart by their differing balances, and the index is
never needed. Without a balance, identical same-day lines are distinguished only by
their order in the export — still correct for re-imports, but balance is stronger.

## Procedure

1. After normalizing the batch (`01`) to `data/<batch>/normalized.json`, classify it
   against the master ledger:

   ```
   python3 scripts/ledger.py check \
     --transactions data/<batch>/normalized.json \
     --ledger       data/ledger.ndjson \
     --out          data/<batch>/checked.json
   ```

   Each line comes back tagged with `fp`, `seen` (true/false), and
   `prior_disposition` (what it was last time, if seen).

2. **Triage only the `seen: false` lines** (`03`). Already-seen lines are reported to
   the user ("12 lines already in the ledger, skipping") but never re-triaged.

3. After the user dispositions the new lines, write them (each keeping its `fp`, plus
   `disposition` and `reason`) to `data/<batch>/dispositioned.json` and append:

   ```
   python3 scripts/ledger.py append \
     --records data/<batch>/dispositioned.json \
     --ledger  data/ledger.ndjson
   ```

   `append` ignores any fingerprint already in the ledger, so it is safe to re-run.

## The master ledger record

One JSON object per line in `data/ledger.ndjson`:

```json
{"fp":"<sha256>","account":"personal-dnb","date":"2026-05-19","amount":-49.0,
 "currency":"NOK","description":"Kaffebrenneriet","balance":null,
 "disposition":"reimburse-expense","reason":"client coffee","batch":"q2-2026",
 "source_file":"dnb-mai.pdf"}
```

- The ledger is **append-only** — never rewrite or delete lines to "fix" a decision.
  To change a disposition, the correct approach is a new corrective entry; ask the
  user before doing anything that rewrites history.
- The ledger holds transaction descriptions and amounts → it is **gitignored** with
  the rest of `data/`. Never commit it.

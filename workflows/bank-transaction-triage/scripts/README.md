# Scripts

## `ledger.py`

The fingerprint + dedup engine — the anti-duplicate guarantee. Parser-agnostic: it
operates on normalized transactions (see `../transactions.example.json`), not raw
bank files (Claude does the extraction per `.claude/rules/01-ingest-and-normalize.md`).

```
# classify a normalized batch against the master ledger
python3 scripts/ledger.py check \
  --transactions data/<batch>/normalized.json \
  --ledger       data/ledger.ndjson \
  --out          data/<batch>/checked.json

# after dispositioning the new lines, append them (idempotent)
python3 scripts/ledger.py append \
  --records data/<batch>/dispositioned.json \
  --ledger  data/ledger.ndjson
```

`check` tags each line with `fp`, `seen`, and `prior_disposition`. `append` adds
only fingerprints not already in the ledger, so it is safe to re-run. Fingerprint
recipe and the ledger format are documented in
`.claude/rules/02-dedup-and-ledger.md` and the module docstring. Pure standard
library — no dependencies.

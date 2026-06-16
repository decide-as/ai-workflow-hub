#!/usr/bin/env python3
"""Master transaction ledger — fingerprint + dedup for bank-statement triage.

The triage workflow normalizes every bank line to a common shape (see
`transactions.example.json`), then uses this helper to tell which lines are
**new** (never dispositioned) versus **already seen** — so re-importing an
overlapping statement never double-counts. Dispositioned lines are appended to an
append-only NDJSON ledger keyed by a content fingerprint.

## Fingerprint (content-hash-only)

    fp = sha256( account | date | amount(2dp, signed) | norm(description) | disambiguator )

- `norm(description)` is casefolded with internal whitespace collapsed.
- `disambiguator` is the post-transaction **balance** when the export has one
  (unique and stable per line) — otherwise an intra-day **sequence index** among
  otherwise-identical lines. Balance is far more robust; prefer exports that
  include it. With neither a bank reference nor a balance, two genuinely identical
  same-day lines are told apart only by their order in the export.

## Usage

    # 1) classify a normalized batch against the ledger
    python3 scripts/ledger.py check \
        --transactions data/<batch>/normalized.json \
        --ledger       data/ledger.ndjson \
        --out          data/<batch>/checked.json

    # 2) after you disposition the NEW lines (register/skip/route/…),
    #    append them to the ledger (already-present fingerprints are ignored)
    python3 scripts/ledger.py append \
        --records data/<batch>/dispositioned.json \
        --ledger  data/ledger.ndjson
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

# Dispositions a transaction can carry in the ledger.
DISPOSITIONS = {
    "register-direct",  # book straight into the accounts (e.g. company-card purchase)
    "reimburse-expense",  # route to the Expense Reimbursement form
    "reimburse-travel",  # route to the Travel Reimbursement form
    "skip",  # personal, internal transfer, already booked, etc.
    "maybe",  # undecided — needs more info before it can be registered
}

_WS = re.compile(r"\s+")


def die(msg: str) -> None:
    print(f"error: {msg}", file=sys.stderr)
    raise SystemExit(1)


def norm_desc(s) -> str:
    """Casefold + collapse whitespace so trivial spacing/case differences between
    exports don't change the fingerprint."""
    return _WS.sub(" ", str(s or "").strip()).casefold()


def amount_str(v) -> str:
    """Signed amount to 2 decimals — the canonical form used in the fingerprint."""
    return f"{float(v):.2f}"


def fingerprint(
    account: str, date: str, amount, description: str, disambiguator: str
) -> str:
    key = "|".join(
        [
            str(account or "").strip(),
            str(date or "").strip(),
            amount_str(amount),
            norm_desc(description),
            disambiguator,
        ]
    )
    return hashlib.sha256(key.encode("utf-8")).hexdigest()


def _has_balance(t: dict) -> bool:
    return t.get("balance") is not None and t.get("balance") != ""


def _tuple_key(t: dict) -> tuple:
    """Identity tuple for no-balance lines (used to sequence identical same-day rows)."""
    return (
        str(t.get("account") or "").strip(),
        str(t.get("date") or "").strip(),
        amount_str(t.get("amount")),
        norm_desc(t.get("description")),
    )


def load_ledger(path: Path) -> list[dict]:
    if not path.exists():
        return []
    records = []
    for i, line in enumerate(path.read_text().splitlines(), 1):
        line = line.strip()
        if not line:
            continue
        try:
            records.append(json.loads(line))
        except json.JSONDecodeError as e:
            die(f"{path}:{i}: corrupt ledger line: {e}")
    return records


def compute_fp(t: dict, disambiguator: str) -> str:
    return fingerprint(
        t.get("account"),
        t.get("date"),
        t.get("amount"),
        t.get("description"),
        disambiguator,
    )


def check(transactions: list[dict], ledger: list[dict]) -> list[dict]:
    """Tag each incoming transaction with its fingerprint and whether the ledger has
    already seen it (carrying the prior disposition when so)."""
    ledger_fps = {r["fp"]: r for r in ledger if "fp" in r}

    # For no-balance lines, the disambiguator is the 0-based occurrence index among
    # otherwise-identical lines *within this batch*. Starting at 0 every time means a
    # re-imported statement reproduces the same fingerprints (seq:0, seq:1, …) and
    # matches the ledger, while a genuinely extra identical line gets the next index
    # and is flagged new.
    running: dict[tuple, int] = {}
    out = []
    for t in transactions:
        if _has_balance(t):
            disamb = f"bal:{amount_str(t['balance'])}"
        else:
            key = _tuple_key(t)
            idx = running.get(key, 0)
            running[key] = idx + 1
            disamb = f"seq:{idx}"
        fp = compute_fp(t, disamb)
        prior = ledger_fps.get(fp)
        out.append(
            {
                **t,
                "fp": fp,
                "seen": prior is not None,
                "prior_disposition": prior.get("disposition") if prior else None,
            }
        )
    return out


def append(records: list[dict], ledger_path: Path) -> tuple[int, int]:
    """Append dispositioned records whose fingerprint isn't already in the ledger.
    Returns (added, skipped)."""
    ledger = load_ledger(ledger_path)
    existing = {r["fp"] for r in ledger if "fp" in r}
    added = skipped = 0
    lines = []
    for r in records:
        fp = r.get("fp")
        if not fp:
            die("every record to append must carry an 'fp' (run `check` first).")
        disp = r.get("disposition")
        if disp not in DISPOSITIONS:
            die(
                f"record {fp[:12]}…: disposition {disp!r} not one of {sorted(DISPOSITIONS)}."
            )
        if fp in existing:
            skipped += 1
            continue
        existing.add(fp)
        lines.append(json.dumps(r, ensure_ascii=False))
        added += 1
    if lines:
        ledger_path.parent.mkdir(parents=True, exist_ok=True)
        with ledger_path.open("a", encoding="utf-8") as f:
            f.write("\n".join(lines) + "\n")
    return added, skipped


def main() -> None:
    ap = argparse.ArgumentParser(description="Transaction ledger fingerprint + dedup.")
    sub = ap.add_subparsers(dest="cmd", required=True)

    c = sub.add_parser("check", help="classify a normalized batch against the ledger")
    c.add_argument("--transactions", required=True, type=Path)
    c.add_argument("--ledger", required=True, type=Path)
    c.add_argument(
        "--out", type=Path, help="write the tagged batch here (default: stdout)"
    )

    a = sub.add_parser("append", help="append dispositioned records to the ledger")
    a.add_argument("--records", required=True, type=Path)
    a.add_argument("--ledger", required=True, type=Path)

    args = ap.parse_args()

    if args.cmd == "check":
        if not args.transactions.exists():
            die(f"not found: {args.transactions}")
        txns = json.loads(args.transactions.read_text())
        tagged = check(txns, load_ledger(args.ledger))
        new = sum(1 for t in tagged if not t["seen"])
        seen = len(tagged) - new
        payload = json.dumps(tagged, ensure_ascii=False, indent=2)
        if args.out:
            args.out.parent.mkdir(parents=True, exist_ok=True)
            args.out.write_text(payload)
        else:
            print(payload)
        print(
            f"checked {len(tagged)} transactions: {new} new, {seen} already in ledger",
            file=sys.stderr,
        )
    elif args.cmd == "append":
        if not args.records.exists():
            die(f"not found: {args.records}")
        recs = json.loads(args.records.read_text())
        added, skipped = append(recs, args.ledger)
        print(f"ledger: +{added} appended, {skipped} already present", file=sys.stderr)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Generate test paradigm counts from pytest markers.

Runs ``pytest --collect-only`` for each registered marker and prints a
summary table.  Optionally updates the counts table inside
``tests/TEST_PARADIGM.md`` when called with ``--update``.

Usage::

    python scripts/test_paradigm_counts.py          # print counts
    python scripts/test_paradigm_counts.py --update  # print + patch TEST_PARADIGM.md
"""

from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

MARKERS = [
    ("unit", "Unit"),
    ("integration", "Integration"),
    ("e2e", "CLI / E2E"),
    ("edge_case", "Edge Case"),
    ("error_handling", "Error Handling"),
    ("security", "Security"),
    ("config", "Configuration"),
    ("smoke", "Smoke"),
    ("quality", "Quality"),
    ("structure", "Structure"),
]

PARADIGM_PATH = Path(__file__).resolve().parent.parent / "tests" / "TEST_PARADIGM.md"


def _collect_count(marker: str) -> int:
    """Return the number of tests collected for *marker*."""
    result = subprocess.run(
        ["pytest", "tests/", "-m", marker, "--collect-only", "-q", "--no-header"],
        capture_output=True,
        text=True,
    )
    for line in reversed(result.stdout.strip().splitlines()):
        m = re.search(r"(\d+)/\d+ tests collected", line)
        if m:
            return int(m.group(1))
        m = re.search(r"(\d+) tests? collected", line)
        if m:
            return int(m.group(1))
    return 0


def _total_count() -> int:
    """Return the total number of tests (no marker filter)."""
    result = subprocess.run(
        ["pytest", "tests/", "--collect-only", "-q", "--no-header"],
        capture_output=True,
        text=True,
    )
    for line in reversed(result.stdout.strip().splitlines()):
        m = re.search(r"(\d+) test", line)
        if m:
            return int(m.group(1))
    return 0


def gather_counts() -> tuple[int, list[tuple[str, str, int]]]:
    """Return (total, [(marker, label, count), ...]) sorted by count desc."""
    total = _total_count()
    rows = []
    for marker, label in MARKERS:
        count = _collect_count(marker)
        rows.append((marker, label, count))
    rows.sort(key=lambda r: r[2], reverse=True)
    return total, rows


def format_table(total: int, rows: list[tuple[str, str, int]]) -> str:
    """Return a markdown table string."""
    lines = [
        f"| Category | Count | % of {total} |",
        "|----------|------:|:--------:|",
    ]
    for _, label, count in rows:
        pct = round(count / total * 100) if total else 0
        lines.append(f"| {label} | {count} | {pct}% |")
    return "\n".join(lines)


def update_paradigm(total: int, rows: list[tuple[str, str, int]]) -> bool:
    """Replace the summary table in TEST_PARADIGM.md. Returns True if changed."""
    if not PARADIGM_PATH.exists():
        print(f"  {PARADIGM_PATH} not found -- skipping update", file=sys.stderr)
        return False

    content = PARADIGM_PATH.read_text()
    new_table = format_table(total, rows)

    pattern = re.compile(
        r"(## Summary\n\n)"
        r"\| Category.*?"
        r"(\nTests may carry)",
        re.DOTALL,
    )
    replacement = rf"\g<1>{new_table}\n\g<2>"
    new_content, n = pattern.subn(replacement, content)

    if n == 0:
        print("  Could not locate summary table in TEST_PARADIGM.md", file=sys.stderr)
        return False

    if new_content == content:
        print("  TEST_PARADIGM.md already up to date")
        return False

    PARADIGM_PATH.write_text(new_content)
    print("  TEST_PARADIGM.md updated")
    return True


def main() -> None:
    update = "--update" in sys.argv

    print("Collecting test counts per marker...\n")
    total, rows = gather_counts()

    print(format_table(total, rows))
    print(f"\nTotal tests: {total}")
    print("(Tests may carry multiple markers, so category totals may exceed the total.)\n")

    if update:
        update_paradigm(total, rows)


if __name__ == "__main__":
    main()

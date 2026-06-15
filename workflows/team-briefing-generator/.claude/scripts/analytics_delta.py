#!/usr/bin/env python3
"""Remove orphaned analytics sidecar JSON files.

An orphan is a sidecar whose corresponding test_*.py source file no longer
exists. Walks tests/.analytics/ recursively (handles hierarchical structure)
and removes any .json file whose relative stem has no matching test file.

Usage:
    python scripts/analytics_delta.py
"""

from __future__ import annotations

from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent.resolve()
ANALYTICS_DIR = REPO_ROOT / "tests" / ".analytics"
TESTS_ROOT = REPO_ROOT / "tests"


def main() -> None:
    """Remove orphaned sidecar files."""
    if not ANALYTICS_DIR.exists():
        print("[TQS] No analytics directory.")
        return

    # Self-referential files excluded from TQS evaluation (mirrored from test_analytics_sync.py)
    _EXCLUDED = {
        "test_analytics_sync.py",
        "test_analytics_scripts.py",
        "test_analytics_stats.py",
        "test_evaluate_test_file.py",
        "test_analytics_gates.py",
    }

    # Build set of valid relative keys (e.g. "core/test_metadata")
    valid_keys: set[str] = set()
    for p in TESTS_ROOT.rglob("test_*.py"):
        if ".analytics" in p.parts:
            continue
        if p.name in _EXCLUDED:
            continue
        rel = p.resolve().relative_to(TESTS_ROOT.resolve())
        valid_keys.add(str(rel.with_suffix("")).replace("\\", "/"))

    removed = 0
    for sidecar in ANALYTICS_DIR.rglob("*.json"):
        rel = sidecar.resolve().relative_to(ANALYTICS_DIR.resolve())
        key = str(rel.with_suffix("")).replace("\\", "/")
        if key not in valid_keys:
            sidecar.unlink()
            print(f"[TQS] Removed orphan: {sidecar.relative_to(REPO_ROOT)}")
            removed += 1

    if removed == 0:
        print("[TQS] No orphaned sidecars found.")
    else:
        print(f"[TQS] Removed {removed} orphaned sidecar(s).")


if __name__ == "__main__":
    main()

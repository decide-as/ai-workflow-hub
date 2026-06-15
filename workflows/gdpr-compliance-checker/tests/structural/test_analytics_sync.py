"""Integrity tests ensuring analytics JSON sidecars stay in sync with test code.

Three invariants enforced:
1. No orphaned records (analytics for functions that no longer exist)
2. No missing records (test functions with no analytics entry)
3. No hash drift (test bodies modified after last evaluation)

The missing-detection test skips if the analytics directory is empty — this
covers the cold-start state before any tests have been evaluated.
"""

from __future__ import annotations

import ast
import hashlib
import json
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).parent.parent.parent
ANALYTICS_DIR = REPO_ROOT / "tests" / ".analytics"
TESTS_DIR = REPO_ROOT / "tests"

pytestmark = [pytest.mark.structure, pytest.mark.test_value("structural")]


def _hash_function_body(node: ast.FunctionDef) -> str:
    """Recompute body hash using the same algorithm as evaluate_test_file.py."""
    body_source = ast.unparse(ast.Module(body=node.body, type_ignores=[]))
    return hashlib.md5(body_source.encode(), usedforsecurity=False).hexdigest()


def _load_all_sidecars() -> dict[str, dict[str, dict]]:
    """Return {relative_stem: {sidecar_key: record}} for all sidecar files.

    Keys mirror the tests/ directory structure, e.g. "core/test_metadata" for
    tests/.analytics/core/test_metadata.json.  Sidecar keys may be bare
    (``function_name``, v1) or qualified (``ClassName::function_name``, v2).
    Non-dict entries (e.g. ``schema_version``) are stripped.
    """
    sidecars: dict[str, dict[str, dict]] = {}
    if not ANALYTICS_DIR.exists():
        return sidecars
    for sidecar_path in sorted(ANALYTICS_DIR.rglob("*.json")):
        try:
            data = json.loads(sidecar_path.read_text())
        except (json.JSONDecodeError, OSError):
            continue
        # Key: path relative to ANALYTICS_DIR without .json suffix
        rel = sidecar_path.relative_to(ANALYTICS_DIR)
        key = str(rel.parent / rel.stem) if rel.parent != Path(".") else rel.stem
        # Strip non-dict entries (schema_version etc.)
        sidecars[key] = {k: v for k, v in data.items() if isinstance(v, dict)}
    return sidecars


def _test_function_keys_in_file(path: Path) -> set[str]:
    """Return the set of sidecar keys for test_* functions in a Python file.

    Class methods → ``ClassName::function_name`` (matches v2 qualified keys).
    Module-level functions → bare ``function_name``.
    Also returns bare function names to support v1 sidecars during the
    transition window before migration.
    """
    try:
        source = path.read_text()
        tree = ast.parse(source)
    except (OSError, SyntaxError):
        return set()
    keys: set[str] = set()
    for stmt in tree.body:
        if isinstance(stmt, ast.FunctionDef) and stmt.name.startswith("test_"):
            keys.add(stmt.name)  # module-level: bare key
        elif isinstance(stmt, ast.ClassDef):
            for item in stmt.body:
                if isinstance(item, ast.FunctionDef) and item.name.startswith("test_"):
                    keys.add(f"{stmt.name}::{item.name}")  # qualified key
                    keys.add(item.name)  # also accept bare during transition
    return keys


def _test_functions_in_file(path: Path) -> set[str]:
    """Return bare function names for backward compatibility."""
    return {k.split("::")[-1] if "::" in k else k for k in _test_function_keys_in_file(path)}


def _all_test_stems() -> dict[str, Path]:
    """Return {relative_stem: path} for all test_*.py files in the tests directory.

    Keys mirror the analytics sidecar keys, e.g. "core/test_metadata" for
    tests/core/test_metadata.py.
    """
    # TQS self-referential files: these test the TQS analytics scripts themselves
    # and must never be scored by TQS (circular). If you add a new analytics
    # test file, add its name here or the sync test will demand a sidecar for it.
    _EXCLUDED = {
        "test_analytics_sync.py",
        "test_analytics_scripts.py",
        "test_analytics_stats.py",
        "test_evaluate_test_file.py",
        "test_analytics_gates.py",
    }
    result: dict[str, Path] = {}
    for path in TESTS_DIR.rglob("test_*.py"):
        if path.name in _EXCLUDED:
            continue
        rel = path.relative_to(TESTS_DIR)
        key = str(rel.parent / rel.stem) if rel.parent != Path(".") else rel.stem
        result[key] = path
    return result


class TestOrphanDetection:
    """Analytics records must not reference functions that no longer exist."""

    @pytest.mark.test_value("structural")
    def test_no_orphaned_records(self) -> None:
        """Contract: every analytics record must correspond to an existing test function."""
        sidecars = _load_all_sidecars()
        if not sidecars:
            return  # cold start — pass vacuously

        test_stems = _all_test_stems()
        orphans: list[str] = []

        for stem, records in sidecars.items():
            test_path = test_stems.get(stem)
            if test_path is None:
                # Entire file was deleted
                for func_name in records:
                    orphans.append(f"{stem}.json::{func_name} (test file deleted)")
                continue

            valid_keys = _test_function_keys_in_file(test_path)
            for func_key in records:
                if func_key not in valid_keys:
                    orphans.append(f"tests/.analytics/{stem}.json::{func_key}")

        assert not orphans, (
            f"Found {len(orphans)} orphaned analytics record(s) — "
            f"run 'make test-analytics-delta' to clean up:\n"
            + "\n".join(f"  {o}" for o in sorted(orphans))
        )


class TestMissingDetection:
    """Every test function must have an analytics record (skips on cold start)."""

    @pytest.mark.test_value("structural")
    def test_no_missing_records(self) -> None:
        """Contract: every test_* function must have a corresponding analytics record."""
        if not ANALYTICS_DIR.exists() or not any(ANALYTICS_DIR.rglob("*.json")):
            pytest.skip(
                "Analytics directory is empty (cold start) — "
                "run 'make test-analytics' to bootstrap"
            )

        sidecars = _load_all_sidecars()
        test_stems = _all_test_stems()
        all_funcs: list[str] = []
        missing: list[str] = []

        for stem, test_path in test_stems.items():
            records = sidecars.get(stem, {})
            # Collect the canonical (qualified) keys present in the sidecar.
            sidecar_keys = set(records.keys())
            try:
                source = test_path.read_text()
                tree = ast.parse(source)
            except (OSError, SyntaxError):
                continue
            canonical_keys: set[str] = set()
            for stmt in tree.body:
                if isinstance(stmt, ast.FunctionDef) and stmt.name.startswith("test_"):
                    canonical_keys.add(stmt.name)
                elif isinstance(stmt, ast.ClassDef):
                    for item in stmt.body:
                        if isinstance(item, ast.FunctionDef) and item.name.startswith("test_"):
                            canonical_keys.add(f"{stmt.name}::{item.name}")
            for canon_key in canonical_keys:
                all_funcs.append(f"{stem}::{canon_key}")
                # Accept either the canonical key or the bare form (transition)
                bare = canon_key.split("::")[-1] if "::" in canon_key else canon_key
                if canon_key not in sidecar_keys and bare not in sidecar_keys:
                    missing.append(f"{stem}::{canon_key}")

        # Skip enforcement when the suite is less than 50% bootstrapped — this is
        # expected on a fresh clone or before the first full 'make test-analytics' run.
        if len(all_funcs) > 0 and len(missing) / len(all_funcs) > 0.5:
            pytest.skip(
                f"Analytics bootstrap incomplete ({len(all_funcs) - len(missing)}/{len(all_funcs)} functions evaluated) — "
                f"run 'make test-analytics' to bootstrap"
            )

        assert not missing, (
            f"Found {len(missing)} test function(s) with no analytics record — "
            f"run 'make test-analytics' to evaluate them:\n"
            + "\n".join(f"  {m}" for m in sorted(missing))
        )


class TestHashDrift:
    """Test bodies must not change after their last evaluation without updating analytics."""

    @pytest.mark.test_value("structural")
    def test_no_hash_drift(self) -> None:
        """Contract: every analytics record's body_hash must match the current function body."""
        sidecars = _load_all_sidecars()
        if not sidecars:
            return  # cold start — pass vacuously

        test_stems = _all_test_stems()
        drifted: list[str] = []

        for stem, records in sidecars.items():
            test_path = test_stems.get(stem)
            if test_path is None:
                continue  # handled by orphan test

            try:
                source = test_path.read_text()
                tree = ast.parse(source)
            except (OSError, SyntaxError):
                continue

            # Build func_map keyed by both qualified (ClassName::func) and bare name.
            # Qualified keys match v2 sidecars; bare names match v1/transition sidecars.
            func_map: dict[str, ast.FunctionDef] = {}
            for stmt in tree.body:
                if isinstance(stmt, ast.FunctionDef) and stmt.name.startswith("test_"):
                    func_map.setdefault(stmt.name, stmt)
                elif isinstance(stmt, ast.ClassDef):
                    for item in stmt.body:
                        if isinstance(item, ast.FunctionDef) and item.name.startswith("test_"):
                            qualified = f"{stmt.name}::{item.name}"
                            func_map.setdefault(qualified, item)
                            func_map.setdefault(item.name, item)

            for func_key, record in records.items():
                node = func_map.get(func_key)
                if node is None:
                    continue  # orphan — handled by orphan test

                current_hash = _hash_function_body(node)
                stored_hash = record.get("body_hash", "")
                if current_hash != stored_hash:
                    drifted.append(f"{stem}::{func_key} (body changed since last evaluation)")

        assert not drifted, (
            f"Found {len(drifted)} test function(s) whose body changed after evaluation — "
            f"run 'make test-analytics' to re-evaluate:\n"
            + "\n".join(f"  {d}" for d in sorted(drifted))
        )

#!/usr/bin/env python3
"""Bulk-evaluate all test files and update analytics sidecars.

Usage:
    python scripts/update_analytics.py [--force] [--workers N] [--file-workers N]
                                       [--log PATH] [--allow-pre-beta]

Walks tests/ for test_*.py files, calls evaluate_file() on each, and
prints a final summary. Errors on individual files are logged but do not
stop the run (resume semantics — already-evaluated unchanged functions are
skipped automatically via body hash comparison).

Use --force to re-evaluate every function regardless of hash.
Use --workers N (default 1) to evaluate functions in parallel within each file.
Use --file-workers N (default 1) to evaluate multiple files concurrently.
Use --log PATH to write a live progress log (count, percentage, file::function).
Use --allow-pre-beta on pre-beta projects for manual one-off audits.
"""

from __future__ import annotations

import argparse
import ast
import datetime
import hashlib
import json
import sys
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent.resolve()
TESTS_ROOT = REPO_ROOT / "tests"

# Import from the sibling script
sys.path.insert(0, str(Path(__file__).parent))
from evaluate_test_file import _BETA_PHASES, _read_project_phase, evaluate_file  # noqa: E402

_print_lock = threading.RLock()  # RLock allows the same thread to acquire it multiple times (needed when _ProgressTee._emit is called from within _print)

# --- Progress tracking -----------------------------------------------------------

_progress_lock = threading.Lock()
_progress_evaluated = 0
_progress_total = 0
_log_file: Path | None = None


def _count_pending_functions(test_files: list[Path], force: bool) -> int:
    """Count how many functions will actually be evaluated (not hash-skipped)."""
    _EXCLUDED = {
        "test_analytics_sync.py",
        "test_analytics_scripts.py",
        "test_analytics_stats.py",
        "test_evaluate_test_file.py",
        "test_analytics_gates.py",
    }
    analytics_dir = TESTS_ROOT / ".analytics"
    total = 0
    for p in test_files:
        if p.name in _EXCLUDED:
            continue
        try:
            tree = ast.parse(p.read_text())
        except (OSError, SyntaxError):
            continue
        rel = p.relative_to(TESTS_ROOT)
        sidecar_path = analytics_dir / rel.parent / f"{rel.stem}.json"
        try:
            sidecar = json.loads(sidecar_path.read_text()) if sidecar_path.exists() else {}
        except Exception:
            sidecar = {}
        seen: set[str] = set()
        for node in ast.walk(tree):
            if not isinstance(node, ast.FunctionDef) or not node.name.startswith("test_"):
                continue
            if node.name in seen:
                continue
            seen.add(node.name)
            if force:
                total += 1
            else:
                rec = sidecar.get(node.name)
                body = ast.unparse(ast.Module(body=node.body, type_ignores=[]))
                cur_hash = hashlib.md5(body.encode(), usedforsecurity=False).hexdigest()
                if not rec or rec.get("body_hash") != cur_hash:
                    total += 1
    return total


def _log(msg: str) -> None:
    """Write a timestamped line to the log file (if configured)."""
    if _log_file is None:
        return
    ts = datetime.datetime.now().strftime("%H:%M:%S")
    with _print_lock, open(_log_file, "a") as f:
        f.write(f"[{ts}] {msg}\n")


class _ProgressTee:
    """Wraps sys.stdout to intercept '[TQS] Evaluating' lines and inject progress."""

    def __init__(self, wrapped: object) -> None:
        self._wrapped = wrapped
        self._buf = ""

    def write(self, text: str) -> int:
        self._buf += text
        while "\n" in self._buf:
            line, self._buf = self._buf.split("\n", 1)
            self._emit(line)
        return len(text)

    def _emit(self, line: str) -> None:
        global _progress_evaluated
        if "[TQS] Evaluating " in line:
            with _progress_lock:
                _progress_evaluated += 1
                done = _progress_evaluated
                total = _progress_total
            pct = (done / total * 100) if total else 0
            enriched = f"{line}  [{done}/{total}  {pct:.1f}%]"
            with _print_lock:
                self._wrapped.write(enriched + "\n")
                self._wrapped.flush()
            _log(enriched)
        else:
            with _print_lock:
                self._wrapped.write(line + "\n")
                self._wrapped.flush()
            if line.strip():
                _log(line)

    def flush(self) -> None:
        self._wrapped.flush()

    def fileno(self) -> int:
        return self._wrapped.fileno()  # type: ignore[attr-defined]


def _print(msg: str, *, file: object | None = None) -> None:
    """Thread-safe print."""
    with _print_lock:
        print(msg, file=file, flush=True)


def _evaluate_one_file(
    test_file: Path,
    index: int,
    total: int,
    force: bool,
    workers: int,
    batch_size: int = 5,
) -> tuple[int, int, str | None]:
    """Evaluate a single test file. Returns (evaluated, skipped_flag, error_msg)."""
    rel = test_file.relative_to(REPO_ROOT)
    _print(f"[TQS] [{index}/{total}] {rel}")
    try:
        count = evaluate_file(test_file.resolve(), force=force, workers=workers, batch_size=batch_size)
        return (count, 0, None) if count > 0 else (0, 1, None)
    except Exception as exc:  # noqa: BLE001
        import traceback as tb

        msg = f"[TQS] ERROR evaluating {rel}: {exc}"
        if not isinstance(exc, (ValueError, OSError)):
            msg += "\n" + tb.format_exc()
        return (0, 0, msg)


def main() -> None:
    """Walk tests/ and evaluate all test files."""
    parser = argparse.ArgumentParser(
        description="Bulk-evaluate all test files and update analytics sidecars.",
        epilog="TQS runs automatically from beta onwards. Use --allow-pre-beta for manual pre-beta audits.",
    )
    parser.add_argument("--force", action="store_true", help="Re-evaluate all functions, ignoring cached hashes")
    parser.add_argument(
        "--workers",
        type=int,
        default=1,
        metavar="N",
        help="Parallel Claude invocations per file (default: 1). Use 20 for fast full-suite runs.",
    )
    parser.add_argument(
        "--file-workers",
        type=int,
        default=1,
        metavar="N",
        help="Concurrent file evaluations (default: 1). Use 10 for fast full-suite runs.",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=5,
        metavar="N",
        help="Functions per Claude call (default: 5). Higher = fewer process spawns. Set to 1 to disable.",
    )
    parser.add_argument(
        "--log",
        metavar="PATH",
        help="Write live progress log to this file (count, percentage, file::function).",
    )
    parser.add_argument(
        "--allow-pre-beta",
        action="store_true",
        help="Allow manual TQS evaluation before the project reaches beta phase.",
    )
    parser.add_argument(
        "--files-from",
        metavar="PATH",
        help="File containing test file paths (one per line) to evaluate instead of auto-discovery.",
    )
    args = parser.parse_args()

    # Phase gate — same logic as evaluate_test_file.py
    phase = _read_project_phase()
    if phase and phase not in _BETA_PHASES and not args.allow_pre_beta:
        print(
            f"[TQS] Project phase is '{phase}' (pre-beta). TQS runs automatically from beta onwards.\n"
            f"      To evaluate manually now: add --allow-pre-beta",
            file=sys.stderr,
        )
        sys.exit(1)

    if args.files_from:
        files_from = Path(args.files_from)
        if not files_from.exists():
            print(f"[TQS] --files-from path not found: {files_from}", file=sys.stderr)
            sys.exit(1)
        raw_lines = files_from.read_text().splitlines()
        test_files = sorted(REPO_ROOT / line.strip() for line in raw_lines if line.strip() and not line.startswith("#"))
    else:
        test_files = sorted(p for p in TESTS_ROOT.rglob("test_*.py") if ".analytics" not in p.parts)

    if not test_files:
        print("[TQS] No test files found.")
        return

    # --- Set up logging and progress tracking ---
    global _log_file, _progress_total
    if args.log:
        _log_file = Path(args.log)

    pending = _count_pending_functions(test_files, args.force)
    _progress_total = pending

    ts = datetime.datetime.now().strftime("%H:%M:%S")
    header = (
        f"[{ts}] TQS run started — {pending} function(s) to evaluate "
        f"(workers={args.workers}, file-workers={args.file_workers}, batch={args.batch_size}, force={args.force})"
    )
    print(header)
    if _log_file is not None:
        with open(_log_file, "a") as f:
            f.write(header + "\n")

    # Intercept stdout to inject progress counters on Evaluating lines
    sys.stdout = _ProgressTee(sys.stdout)  # type: ignore[assignment]

    total_evaluated = 0
    skipped = 0
    errors = 0

    file_workers = min(args.file_workers, len(test_files))
    if file_workers <= 1:
        # Sequential path — preserves simple ordered output
        for i, test_file in enumerate(test_files, 1):
            evaluated, sk, err = _evaluate_one_file(
                test_file, i, len(test_files), args.force, args.workers, args.batch_size
            )
            total_evaluated += evaluated
            skipped += sk
            if err:
                print(err, file=sys.stderr)
                errors += 1
    else:
        # Parallel path — N files concurrently, each with --workers intra-file threads
        futures = {}
        with ThreadPoolExecutor(max_workers=file_workers) as executor:
            for i, test_file in enumerate(test_files, 1):
                fut = executor.submit(
                    _evaluate_one_file, test_file, i, len(test_files), args.force, args.workers, args.batch_size
                )
                futures[fut] = test_file
            for fut in as_completed(futures):
                evaluated, sk, err = fut.result()
                total_evaluated += evaluated
                skipped += sk
                if err:
                    _print(err, file=sys.stderr)
                    errors += 1

    print(
        f"\n[TQS] Done. {total_evaluated} function(s) evaluated, "
        f"{skipped} file(s) skipped (unchanged), "
        f"{errors} error(s)."
    )
    if errors:
        sys.exit(1)


if __name__ == "__main__":
    main()

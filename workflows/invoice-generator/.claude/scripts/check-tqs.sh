#!/usr/bin/env bash
# check-tqs.sh — Enforce TQS minimum gate for the current project phase.
#
# Reads PHASE_TO_TQS_MINIMUM from _analytics_shared.py (or the consuming
# project's equivalent), loads all analytics sidecars, computes TQS, and
# exits non-zero if TQS falls below the phase minimum.
#
# Usage:
#   bash .claude/scripts/check-tqs.sh [--phase <phase>]
#
# If --phase is not given, reads phase from project-meta.yaml.

set -euo pipefail

PHASE=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --phase) PHASE="$2"; shift 2 ;;
        *) echo "Unknown argument: $1"; exit 1 ;;
    esac
done

PYTHON="${PYTHON:-.venv/bin/python3}"
if ! command -v "$PYTHON" &>/dev/null; then
    PYTHON="python3"
fi

# Pass this script's own directory so the Python heredoc can locate _analytics_shared
# regardless of whether scripts live in scripts/ or .claude/scripts/.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

TQS_PHASE="$PHASE" TQS_SCRIPT_DIR="$SCRIPT_DIR" "$PYTHON" - <<'PYEOF'
import json
import os
import re
import sys
from pathlib import Path

# Try importing from scripts/ dir (project copy), then from content/ (distributed copy).
_shared_search_dirs = [
    os.environ.get("TQS_SCRIPT_DIR", ""),
    str(Path(".") / "scripts"),
    str(Path(".") / ".claude" / "scripts"),
]
for _d in _shared_search_dirs:
    if _d:
        sys.path.insert(0, _d)

try:
    from _analytics_shared import (  # type: ignore[import-not-found]
        DIMENSIONS,
        PHASE_TO_TQS_MINIMUM,
        PHASE_TO_TEST_SCORE_FLOOR,
        PHASE_TO_FILE_AVG_FLOOR,
        PHASE_TO_DIM_DIST_GE1,
        PHASE_TO_DIM_DIST_GE1_SB,
        PHASE_TO_DIM_DIST_GE1_EC,
        PHASE_TO_DIM_DIST_GE2,
        PHASE_TO_DIM_DIST_GE2_SB,
        PHASE_TO_DIM_DIST_GE2_EC,
        PHASE_TO_DIM_DIST_GE3_OTHER,
        PHASE_TO_DIM_DIST_GE3_SB,
        PHASE_TO_DIM_DIST_GE3_EC,
    )
    _SHARED_LOADED = True
except ImportError:
    _SHARED_LOADED = False
    DIMENSIONS = [
        "structure_organization", "contract_intent", "isolation_determinism",
        "scenario_breadth", "execution_speed", "maintainability",
        "assertion_precision", "edge_coverage",
    ]
    PHASE_TO_TQS_MINIMUM = {
        "mvp": 0.45, "alpha": 0.52, "beta": 0.58,
        "pilot": 0.68, "validation": 0.75, "production": 0.80,
    }
    PHASE_TO_TEST_SCORE_FLOOR = {
        "mvp": 5, "alpha": 6, "beta": 7,
        "pilot": 12, "validation": 16, "production": 20,
    }
    PHASE_TO_FILE_AVG_FLOOR = {
        "mvp": 9.0, "alpha": 11.0, "beta": 12.0,
        "pilot": 16.0, "validation": 20.0, "production": 23.0,
    }
    PHASE_TO_DIM_DIST_GE1 = {"mvp": 0.88, "alpha": 0.93, "beta": 0.95, "pilot": 0.98, "validation": 1.00, "production": 1.00}
    PHASE_TO_DIM_DIST_GE2 = {"mvp": 0.55, "alpha": 0.72, "beta": 0.85, "pilot": 0.92, "validation": 0.97, "production": 0.97}
    PHASE_TO_DIM_DIST_GE3_OTHER = {"mvp": 0.12, "alpha": 0.28, "beta": 0.40, "pilot": 0.60, "validation": 0.75, "production": 0.80}
    PHASE_TO_DIM_DIST_GE1_SB = {"mvp": 0.75, "alpha": 0.82, "beta": 0.88, "pilot": 0.92, "validation": 0.96, "production": 0.98}
    PHASE_TO_DIM_DIST_GE2_SB = {"mvp": 0.02, "alpha": 0.03, "beta": 0.04, "pilot": 0.08, "validation": 0.15, "production": 0.25}
    PHASE_TO_DIM_DIST_GE3_SB = {"mvp": 0.00, "alpha": 0.00, "beta": 0.00, "pilot": 0.01, "validation": 0.03, "production": 0.06}
    PHASE_TO_DIM_DIST_GE1_EC = {"mvp": 0.08, "alpha": 0.12, "beta": 0.20, "pilot": 0.32, "validation": 0.48, "production": 0.62}
    PHASE_TO_DIM_DIST_GE2_EC = {"mvp": 0.00, "alpha": 0.005, "beta": 0.008, "pilot": 0.05, "validation": 0.12, "production": 0.20}
    PHASE_TO_DIM_DIST_GE3_EC = {"mvp": 0.00, "alpha": 0.00, "beta": 0.00, "pilot": 0.01, "validation": 0.02, "production": 0.04}

_SB_DIMS = {"scenario_breadth"}
_EC_DIMS = {"edge_coverage"}
_ZERO_EXEMPT_DIMS: set[str] = set()  # all 8 dims must score ≥1 per test at beta+

# v1 → v2 dimension name normalization
_V1_TO_V2 = {
    "coverage_signal": "scenario_breadth",
    "performance": "execution_speed",
    "maintenance": "maintainability",
}

repo_root = Path(".")
analytics_dir = repo_root / "tests" / ".analytics"
phase = os.environ.get("TQS_PHASE", "")

# Read phase from project-meta.yaml if not provided
if not phase:
    meta = repo_root / "project-meta.yaml"
    if meta.exists():
        m = re.search(r"^phase:\s*(\S+)", meta.read_text(), re.MULTILINE)
        if m:
            phase = m.group(1).strip('"').strip("'")

if not phase:
    print("[TQS] No phase found — skipping TQS gate check.")
    sys.exit(0)

minimum = PHASE_TO_TQS_MINIMUM.get(phase)
if minimum is None:
    print(f"[TQS] Phase '{phase}' has no TQS minimum — skipping.")
    sys.exit(0)

# Load all records, normalizing v1→v2 dimension names
if not analytics_dir.exists() or not list(analytics_dir.rglob("*.json")):
    print("[TQS] No analytics records found — skipping gate (run 'make update-analytics-stats' to bootstrap).")
    sys.exit(0)

records = []
for sidecar in sorted(analytics_dir.rglob("*.json")):
    try:
        data = json.loads(sidecar.read_text())
        if not isinstance(data, dict):
            continue
        for v in data.values():
            if not isinstance(v, dict):
                continue
            rec = dict(v)
            if "dimensions" in rec:
                rec["dimensions"] = {_V1_TO_V2.get(k, k): val for k, val in rec["dimensions"].items()}
            records.append(rec)
    except (json.JSONDecodeError, OSError):
        continue

if not records:
    print("[TQS] Analytics directory exists but contains no records — skipping gate.")
    sys.exit(0)

# Recompute TQS from normalized dimensions (not stored total_score, which may be stale)
_MAX_SCORE = 32
tqs = sum(
    sum(r.get("dimensions", {}).get(d, 0) for d in DIMENSIONS) / _MAX_SCORE
    for r in records
) / len(records)
pct = tqs * 100

print(f"[TQS] Phase: {phase}  |  Score: {pct:.1f}%  |  Minimum: {minimum * 100:.0f}%  |  Tests: {len(records)}")

# Check for blocking dimensions (score 0 on non-exempt dims)
_ZERO_BLOCK_PHASES = {"beta", "pilot", "validation", "production"}

blocking_dims = []
for r in records:
    fn = r.get("function_name", "?")
    dims = r.get("dimensions", {})
    for d in DIMENSIONS:
        if d not in _ZERO_EXEMPT_DIMS and dims.get(d, 1) == 0:
            blocking_dims.append(f"{fn} [{d}=0]")

if blocking_dims:
    severity = "FAIL" if phase in _ZERO_BLOCK_PHASES else "WARNING"
    print(f"[TQS] {severity}: {len(blocking_dims)} test(s) have a non-exempt dimension scored 0:")
    for msg in blocking_dims[:10]:
        print(f"  - {msg}")
    if len(blocking_dims) > 10:
        print(f"  ... and {len(blocking_dims) - 10} more")
    if phase in _ZERO_BLOCK_PHASES:
        print(f"[TQS] Dimension-0 scores are blocking at phase '{phase}'")
        sys.exit(1)

if tqs < minimum:
    print(f"[TQS] FAIL: {pct:.1f}% < {minimum * 100:.0f}% required for phase '{phase}'")
    sys.exit(1)

# --- Per-test score floor gate ---
test_floor = PHASE_TO_TEST_SCORE_FLOOR.get(phase)
if test_floor is not None:
    floor_failures = []
    for r in records:
        total = sum(r.get("dimensions", {}).get(d, 0) for d in DIMENSIONS)
        if total < test_floor:
            fn = r.get("function_name", "?")
            floor_failures.append(f"  {fn}: total={total} < floor={test_floor}")
    if floor_failures:
        print(f"[TQS] FAIL: {len(floor_failures)} test(s) below per-test score floor ({test_floor}/32):")
        for msg in floor_failures[:10]:
            print(msg)
        if len(floor_failures) > 10:
            print(f"  ... and {len(floor_failures) - 10} more")
        sys.exit(1)
    print(f"[TQS] Per-test floor PASS (floor={test_floor}/32)")

# --- Per-file average floor gate ---
file_avg_floor = PHASE_TO_FILE_AVG_FLOOR.get(phase)
if file_avg_floor is not None:
    from collections import defaultdict
    file_scores: dict[str, list[float]] = defaultdict(list)
    for r in records:
        fp = r.get("file_path", r.get("function_name", "unknown"))
        total = sum(r.get("dimensions", {}).get(d, 0) for d in DIMENSIONS)
        file_scores[fp].append(float(total))
    file_failures = []
    for fp, scores in sorted(file_scores.items()):
        avg = sum(scores) / len(scores)
        if avg < file_avg_floor:
            file_failures.append(f"  {fp}: avg={avg:.1f} < floor={file_avg_floor}")
    if file_failures:
        print(f"[TQS] FAIL: {len(file_failures)} file(s) below per-file average floor ({file_avg_floor}/32):")
        for msg in file_failures[:10]:
            print(msg)
        if len(file_failures) > 10:
            print(f"  ... and {len(file_failures) - 10} more")
        sys.exit(1)
    print(f"[TQS] Per-file average floor PASS (floor={file_avg_floor}/32)")

# --- Dimension distribution gates ---
def _ge1_req(dim: str) -> float | None:
    if dim in _SB_DIMS:
        return PHASE_TO_DIM_DIST_GE1_SB.get(phase)
    if dim in _EC_DIMS:
        return PHASE_TO_DIM_DIST_GE1_EC.get(phase)
    return PHASE_TO_DIM_DIST_GE1.get(phase)

def _ge2_req(dim: str) -> float | None:
    if dim in _SB_DIMS:
        return PHASE_TO_DIM_DIST_GE2_SB.get(phase)
    if dim in _EC_DIMS:
        return PHASE_TO_DIM_DIST_GE2_EC.get(phase)
    return PHASE_TO_DIM_DIST_GE2.get(phase)

def _ge3_req(dim: str) -> float | None:
    if dim in _SB_DIMS:
        return PHASE_TO_DIM_DIST_GE3_SB.get(phase)
    if dim in _EC_DIMS:
        return PHASE_TO_DIM_DIST_GE3_EC.get(phase)
    return PHASE_TO_DIM_DIST_GE3_OTHER.get(phase)

n = len(records)
dist_failures: list[str] = []

for d in DIMENSIONS:
    actual_ge1 = sum(1 for r in records if r.get("dimensions", {}).get(d, 0) >= 1) / n
    actual_ge2 = sum(1 for r in records if r.get("dimensions", {}).get(d, 0) >= 2) / n
    actual_ge3 = sum(1 for r in records if r.get("dimensions", {}).get(d, 0) >= 3) / n

    req1 = _ge1_req(d)
    req2 = _ge2_req(d)
    req3 = _ge3_req(d)

    if req1 is not None and actual_ge1 < req1:
        dist_failures.append(f"  {d}: ≥1 actual {actual_ge1:.1%} < required {req1:.1%}")
    if req2 is not None and actual_ge2 < req2:
        dist_failures.append(f"  {d}: ≥2 actual {actual_ge2:.1%} < required {req2:.1%}")
    if req3 is not None and actual_ge3 < req3:
        dist_failures.append(f"  {d}: ≥3 actual {actual_ge3:.1%} < required {req3:.1%}")

if dist_failures:
    print(f"[TQS] FAIL: {len(dist_failures)} dimension distribution gate(s) not met:")
    for msg in dist_failures:
        print(msg)
    sys.exit(1)

print(f"[TQS] Distribution gates PASS")
print(f"[TQS] PASS")
PYEOF

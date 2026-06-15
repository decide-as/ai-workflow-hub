"""Shared constants for TQS analytics scripts.

Imported by evaluate_test_file.py, test_analytics_stats.py, and
check-tqs.sh. Keep this file in sync with the content copy at
src/code_practices/content/scripts/_analytics_shared.py.

Dimension set (v2 — 8 dimensions, max score 32):
    structure_organization, contract_intent, isolation_determinism,
    scenario_breadth, execution_speed, maintainability,
    assertion_precision, edge_coverage

v1 names (coverage_signal, performance, maintenance) are normalized to v2
names by upgrade_v1_sidecars.py and test_analytics_stats.py when loading
sidecar records.
"""

from __future__ import annotations

DIMENSIONS: list[str] = [
    "structure_organization",
    "contract_intent",
    "isolation_determinism",
    "scenario_breadth",
    "execution_speed",
    "maintainability",
    "assertion_precision",
    "edge_coverage",
]

# TQS minimum per phase (TQS = mean score / 32). Must be kept in sync with metadata.py.
# Calibrated for 8-dim v2 rubric where edge_coverage is structurally low for most test
# suites (boundary testing requires additive test work, not just refactoring).
PHASE_TO_TQS_MINIMUM: dict[str, float] = {
    "mvp": 0.45,
    "alpha": 0.52,
    "beta": 0.58,
    "pilot": 0.68,
    "validation": 0.75,
    "production": 0.80,
}

# Per-test total score floor (0–32). Calibrated for 8-dim v2 rubric where
# edge_coverage=0 and assertion_precision=0 are valid for smoke/crash tests.
PHASE_TO_TEST_SCORE_FLOOR: dict[str, int] = {
    "mvp": 5,
    "alpha": 6,
    "beta": 7,
    "pilot": 12,
    "validation": 16,
    "production": 20,
}

# Per-file average score floor (0–32). Must be kept in sync with metadata.py.
PHASE_TO_FILE_AVG_FLOOR: dict[str, float] = {
    "mvp": 9.0,
    "alpha": 11.0,
    "beta": 12.0,
    "pilot": 16.0,
    "validation": 20.0,
    "production": 23.0,
}

# ---------------------------------------------------------------------------
# Per-dimension score distribution requirements
# ---------------------------------------------------------------------------
# Design decisions:
# - No ≥4 gate: score=4 is structurally unachievable for some dimensions
#   regardless of quality. Gating on ≥4 penalises correct simple tests.
#
# Dimensions are split into three groups based on v2 scoring characteristics:
#
# STANDARD dims (structure_organization, contract_intent, isolation_determinism,
#                execution_speed, maintainability, assertion_precision):
#   Use PHASE_TO_DIM_DIST_GE1 / GE2 / GE3_OTHER tables.
#
# SB_ONLY dims (scenario_breadth):
#   v2 rubric is much stricter about scenario count than v1. Most tests score
#   sb=1 (single scenario). Use separate lower ramps for ≥1, ≥2, ≥3.
#
# EC_ONLY dims (edge_coverage):
#   Boundary testing is additive work — most tests cover the happy path only.
#   Use separate, much lower thresholds for all three gates.

# --- Standard dims (so, ci, id, es, ma, ap) ---

PHASE_TO_DIM_DIST_GE1: dict[str, float] = {
    "mvp": 0.88,
    "alpha": 0.93,
    "beta": 0.95,
    "pilot": 0.98,
    "validation": 1.00,
    "production": 1.00,
}

PHASE_TO_DIM_DIST_GE2: dict[str, float] = {
    "mvp": 0.55,
    "alpha": 0.72,
    "beta": 0.85,
    "pilot": 0.92,
    "validation": 0.97,
    "production": 0.97,
}

# ≥3 threshold for the six standard dimensions.
# Calibrated so that assertion_precision (44–72% ≥3 depending on scoring method)
# meets the threshold across both AST-estimated and Claude-scored states.
PHASE_TO_DIM_DIST_GE3_OTHER: dict[str, float] = {
    "mvp": 0.12,
    "alpha": 0.28,
    "beta": 0.40,
    "pilot": 0.60,
    "validation": 0.75,
    "production": 0.80,
}

# Backward-compat alias — was PHASE_TO_DIM_DIST_GE3_COVERAGE in v1 design.
PHASE_TO_DIM_DIST_GE3_COVERAGE = PHASE_TO_DIM_DIST_GE3_OTHER

# --- Scenario-breadth-only thresholds ---
# v2 rubric scores sb=1 for most tests (single scenario); only parametrized
# tests or multi-case tests reach sb>=2. The ≥2 and ≥3 ramps are very slow.

PHASE_TO_DIM_DIST_GE1_SB: dict[str, float] = {
    "mvp": 0.75,
    "alpha": 0.82,
    "beta": 0.88,
    "pilot": 0.92,
    "validation": 0.96,
    "production": 0.98,
}

PHASE_TO_DIM_DIST_GE2_SB: dict[str, float] = {
    "mvp": 0.02,
    "alpha": 0.03,
    "beta": 0.04,
    "pilot": 0.08,
    "validation": 0.15,
    "production": 0.25,
}

PHASE_TO_DIM_DIST_GE3_SB: dict[str, float] = {
    "mvp": 0.00,
    "alpha": 0.00,
    "beta": 0.00,
    "pilot": 0.01,
    "validation": 0.03,
    "production": 0.06,
}

# --- Edge-coverage-only thresholds ---
# Boundary testing is structural work. ec=0 is normal for happy-path unit tests.
# Thresholds ramp slowly across phases — improvement requires writing new test cases.

PHASE_TO_DIM_DIST_GE1_EC: dict[str, float] = {
    "mvp": 0.08,
    "alpha": 0.12,
    "beta": 0.20,
    "pilot": 0.32,
    "validation": 0.48,
    "production": 0.62,
}

PHASE_TO_DIM_DIST_GE2_EC: dict[str, float] = {
    "mvp": 0.00,
    "alpha": 0.005,
    "beta": 0.008,
    "pilot": 0.05,
    "validation": 0.12,
    "production": 0.20,
}

PHASE_TO_DIM_DIST_GE3_EC: dict[str, float] = {
    "mvp": 0.00,
    "alpha": 0.00,
    "beta": 0.00,
    "pilot": 0.01,
    "validation": 0.02,
    "production": 0.04,
}

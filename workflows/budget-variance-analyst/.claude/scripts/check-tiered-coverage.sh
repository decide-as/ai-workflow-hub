#!/usr/bin/env bash
# check-tiered-coverage.sh — Run pytest with JSON coverage and check per-module
# coverage against tier requirements.
#
# Usage:
#   bash .claude/scripts/check-tiered-coverage.sh [--gate basic|strict]
#
# Exit codes:
#   0 — all modules meet their tier thresholds
#   1 — one or more modules below threshold

set -euo pipefail

# ---- Activate local venv if present ------------------------------------------
if [[ -d ".venv/bin" ]]; then
  export PATH="$PWD/.venv/bin:$PATH"
elif _git_root=$(git rev-parse --show-toplevel 2>/dev/null) && [[ -d "$_git_root/.venv/bin" ]]; then
  export PATH="$_git_root/.venv/bin:$PATH"
elif [[ -n "${VIRTUAL_ENV:-}" ]] && [[ -x "${VIRTUAL_ENV}/bin/python3" ]]; then
  export PATH="$VIRTUAL_ENV/bin:$PATH"
fi

# Derive package slug from project-meta.yaml or src/ layout
if [ -f project-meta.yaml ] && command -v python3 &>/dev/null; then
    PKG_SLUG=$(python3 -c "import yaml; print(yaml.safe_load(open('project-meta.yaml'))['project_slug'])" 2>/dev/null || true)
fi
if [ -z "${PKG_SLUG:-}" ]; then
    PKG_SLUG=$(ls -d src/*/ 2>/dev/null | head -1 | sed 's|src/||;s|/||')
fi
if [ -z "${PKG_SLUG:-}" ]; then
    echo "[!!] Cannot determine package slug. Set project_slug in project-meta.yaml." >&2
    exit 1
fi

GATE="${1:-basic}"
if [ "$GATE" = "--gate" ]; then
    GATE="${2:-basic}"
fi

echo "[--] Running pytest with coverage..."
pytest tests/ -v --cov=${PKG_SLUG} --cov-report=json --cov-report=term-missing

if [ ! -f coverage.json ]; then
    echo "[!!] coverage.json not found. Tests may have been skipped or pytest-cov is not installed."
    exit 1
fi

echo ""
echo "[--] Checking tiered coverage (gate=$GATE)..."
python -m code_practices.quality.coverage_tiers --check coverage.json --gate "$GATE"

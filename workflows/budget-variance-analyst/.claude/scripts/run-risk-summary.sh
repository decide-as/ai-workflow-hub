#!/usr/bin/env bash
#
# Print a compact risk assessment summary for the current project.
# Reads project-meta.yaml, runs the risk filter, and prints a one-line
# summary with applicable risk count, tier, and phase.
#
# Read-only. No side effects.
#
# Usage:
#   bash .claude/scripts/run-risk-summary.sh
#   bash .claude/scripts/run-risk-summary.sh --deterministic-pass --semantic-pass
#   bash .claude/scripts/run-risk-summary.sh --deterministic-fail
#
# Flags:
#   --deterministic-pass   Mark deterministic checks as passed (default if no flag)
#   --deterministic-fail   Mark deterministic checks as failed
#   --semantic-pass        Mark semantic evaluation as passed (default if no flag)
#   --semantic-fail        Mark semantic evaluation as failed
#
# Exit codes:
#   0 — summary printed
#   1 — project-meta.yaml not found or risk_filter unavailable

set -euo pipefail

if [ ! -f "project-meta.yaml" ]; then
  echo "[!!] project-meta.yaml not found in current directory." >&2
  exit 1
fi

# --- Parse flags ---
DETERMINISTIC_PASS="True"
SEMANTIC_PASS="True"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --deterministic-pass) DETERMINISTIC_PASS="True"; shift ;;
    --deterministic-fail) DETERMINISTIC_PASS="False"; shift ;;
    --semantic-pass)      SEMANTIC_PASS="True"; shift ;;
    --semantic-fail)      SEMANTIC_PASS="False"; shift ;;
    *)
      echo "[!!] Unknown flag: $1" >&2
      echo "Usage: $0 [--deterministic-pass|--deterministic-fail] [--semantic-pass|--semantic-fail]" >&2
      exit 1
      ;;
  esac
done

# Prefer the worktree's venv python if available
if [ -x ".venv/bin/python3" ]; then
  PY=".venv/bin/python3"
else
  PY="python3"
fi

# Check if the risk filter module is available
if ! $PY -c "import code_practices.quality.risk_filter" 2>/dev/null; then
  echo "[--] Risk summary module not available — skipping." >&2
  exit 0
fi

$PY -c "
import sys, yaml
sys.path.insert(0, 'src')
from code_practices.quality.risk_filter import (
    load_applicability_registry,
    filter_applicable_risks,
    compact_summary,
)
from code_practices.quality.risk_checks import PHASE_TO_TIER
meta = yaml.safe_load(open('project-meta.yaml'))
registry = load_applicability_registry()
tier = PHASE_TO_TIER.get(meta.get('phase', 'discovery'), 0)
applicable = filter_applicable_risks(
    registry, meta, tier=tier,
)
print(compact_summary(
    applicable, len(registry), tier,
    meta.get('phase', 'discovery'),
    deterministic_pass=$DETERMINISTIC_PASS,
    semantic_pass=$SEMANTIC_PASS,
))
"

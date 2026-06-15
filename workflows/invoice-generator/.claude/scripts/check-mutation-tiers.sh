#!/usr/bin/env bash
#
# Run mutmut mutation testing and check kill rates against tier thresholds.
#
# Usage:
#   bash .claude/scripts/check-mutation-tiers.sh [--gate basic|strict]
#
# Requires mutmut to be installed and [tool.mutmut] configured in pyproject.toml.

set -euo pipefail

# ---- Activate local venv if present ------------------------------------------
if [[ -d ".venv/bin" ]]; then
  export PATH="$PWD/.venv/bin:$PATH"
elif _git_root=$(git rev-parse --show-toplevel 2>/dev/null) && [[ -d "$_git_root/.venv/bin" ]]; then
  export PATH="$_git_root/.venv/bin:$PATH"
elif [[ -n "${VIRTUAL_ENV:-}" ]] && [[ -x "${VIRTUAL_ENV}/bin/python3" ]]; then
  export PATH="$VIRTUAL_ENV/bin:$PATH"
fi

GATE="basic"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --gate)
      GATE="$2"
      shift 2
      ;;
    *)
      echo "[!!] Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

if ! command -v mutmut &>/dev/null; then
  echo "[!!] mutmut not found. Install with: pip install 'mutmut>=3.5'" >&2
  exit 1
fi

# --- Ensure we're inside a Git repository ---------------------------------
if ! GIT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null); then
  echo "[!!] Not inside a Git repository." >&2
  exit 1
fi
cd "$GIT_ROOT"

echo "[--] Running mutmut mutation testing..."
mutmut run

echo "[--] Checking mutation tier kill rates (gate=$GATE)..."
python -m code_practices.quality.mutation_tiers --check mutants/ --gate "$GATE"

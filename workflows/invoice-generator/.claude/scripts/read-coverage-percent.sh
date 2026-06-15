#!/usr/bin/env bash
# read-coverage-percent.sh — Extract coverage percentage from coverage.json.
#
# Usage:
#   bash .claude/scripts/read-coverage-percent.sh [coverage.json]
#
# Output: the coverage percentage as an integer (e.g., "77").
#
# If no argument is given, reads coverage.json from the project root.
#
# This script exists so Claude Code never needs to construct
# python3 -c "import json; ..." one-liners to read coverage data,
# which are not in the settings.json allow list and trigger
# permission prompts.
#
# Auto-approved via: Bash(bash *.claude/scripts/*)

set -euo pipefail

# ---- Activate local venv if present ------------------------------------------
if [[ -d ".venv/bin" ]]; then
  export PATH="$PWD/.venv/bin:$PATH"
elif _git_root=$(git rev-parse --show-toplevel 2>/dev/null) && [[ -d "$_git_root/.venv/bin" ]]; then
  export PATH="$_git_root/.venv/bin:$PATH"
elif [[ -n "${VIRTUAL_ENV:-}" ]] && [[ -x "${VIRTUAL_ENV}/bin/python3" ]]; then
  export PATH="$VIRTUAL_ENV/bin:$PATH"
fi

coverage_file="${1:-coverage.json}"

if [ ! -f "$coverage_file" ]; then
    echo "[!!] Coverage file not found: $coverage_file" >&2
    exit 1
fi

# Use python3 to extract the percentage (json module is always available)
python3 -c "
import json, sys
with open('$coverage_file') as f:
    data = json.load(f)
print(data['totals']['percent_covered_display'])
"

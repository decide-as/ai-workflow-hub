#!/usr/bin/env bash
# read-quality-gate.sh — Read the effective quality gate from project metadata.
#
# Reads quality_gate from project-meta.yaml. If not explicitly set, derives
# it from the project phase:
#   discovery/poc/prototype → none
#   mvp/alpha              → basic
#   beta/pilot/validation/production → strict
#
# Usage:
#   GATE=$(bash .claude/scripts/read-quality-gate.sh)
#
# Output: one of: none, basic, strict

set -euo pipefail

# ---- Activate local venv if present ------------------------------------------
if [[ -d ".venv/bin" ]]; then
  export PATH="$PWD/.venv/bin:$PATH"
elif _git_root=$(git rev-parse --show-toplevel 2>/dev/null) && [[ -d "$_git_root/.venv/bin" ]]; then
  export PATH="$_git_root/.venv/bin:$PATH"
elif [[ -n "${VIRTUAL_ENV:-}" ]] && [[ -x "${VIRTUAL_ENV}/bin/python3" ]]; then
  export PATH="$VIRTUAL_ENV/bin:$PATH"
fi

# Locate project-meta.yaml
meta_file="project-meta.yaml"
if [ ! -f "$meta_file" ]; then
  repo_root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
  if [ -n "$repo_root" ] && [ -f "$repo_root/project-meta.yaml" ]; then
    meta_file="$repo_root/project-meta.yaml"
  else
    # Default to basic if no metadata found
    echo "basic"
    exit 0
  fi
fi

python3 -c "
import yaml, sys

with open('$meta_file') as f:
    meta = yaml.safe_load(f)

# Explicit quality_gate takes precedence
gate = meta.get('quality_gate')
if gate:
    print(gate)
    sys.exit(0)

# Derive from phase
phase = meta.get('phase', 'mvp')
phase_to_gate = {
    'discovery': 'none', 'poc': 'none', 'prototype': 'none',
    'mvp': 'basic', 'alpha': 'basic',
    'beta': 'strict', 'pilot': 'strict',
    'validation': 'strict', 'production': 'strict',
}
print(phase_to_gate.get(phase, 'basic'))
"

#!/usr/bin/env bash
# read-project-meta.sh — Read fields from project-meta.yaml.
#
# Usage:
#   bash .claude/scripts/read-project-meta.sh <field> [field...]
#   make read-meta FIELDS="language phase branching_complexity"
#
# Examples:
#   bash .claude/scripts/read-project-meta.sh language
#   bash .claude/scripts/read-project-meta.sh language phase branching_complexity
#   bash .claude/scripts/read-project-meta.sh diff_review_threshold
#
# Output: key=value pairs, one per line.
#
# This script exists so Claude Code never needs to construct
# python3 -c "import yaml; ..." one-liners to read metadata,
# which are not in the settings.json allow list and trigger
# permission prompts.

set -euo pipefail

# ---- Activate local venv if present ------------------------------------------
if [[ -d ".venv/bin" ]]; then
  export PATH="$PWD/.venv/bin:$PATH"
elif _git_root=$(git rev-parse --show-toplevel 2>/dev/null) && [[ -d "$_git_root/.venv/bin" ]]; then
  export PATH="$_git_root/.venv/bin:$PATH"
elif [[ -n "${VIRTUAL_ENV:-}" ]] && [[ -x "${VIRTUAL_ENV}/bin/python3" ]]; then
  export PATH="$VIRTUAL_ENV/bin:$PATH"
fi

if [ $# -eq 0 ]; then
    echo "[!!] Usage: read-project-meta.sh <field> [field...]" >&2
    exit 1
fi

# Locate project-meta.yaml
meta_file="project-meta.yaml"
if [ ! -f "$meta_file" ]; then
    repo_root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
    if [ -n "$repo_root" ] && [ -f "$repo_root/project-meta.yaml" ]; then
        meta_file="$repo_root/project-meta.yaml"
    else
        echo "[!!] project-meta.yaml not found" >&2
        exit 1
    fi
fi

# Use python3 to read YAML (PyYAML is always available in CP projects)
python3 -c "
import yaml, sys

with open('$meta_file') as f:
    meta = yaml.safe_load(f)

fields = sys.argv[1:]
for field in fields:
    value = meta.get(field)
    if value is None:
        print(f'{field}=')
    elif isinstance(value, list):
        print(f'{field}={\",\".join(str(v) for v in value)}')
    else:
        print(f'{field}={value}')
" "$@"

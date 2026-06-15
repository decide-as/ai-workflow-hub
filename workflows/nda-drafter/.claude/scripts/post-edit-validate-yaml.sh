#!/usr/bin/env bash
# post-edit-validate-yaml.sh — PostToolUse hook that validates YAML syntax
# after Edit/Write operations on .yaml/.yml files.
#
# Skips .j2 files (Jinja2 templates are not valid YAML).
#
# Exit codes:
#   0 — always (PostToolUse hooks must not fail the session)
#
# Stdin: JSON from Claude Code hook system
# Stdout: feedback shown to Claude (only on syntax errors)

set -euo pipefail

# ---- Activate local venv if present ------------------------------------------
if [[ -d ".venv/bin" ]]; then
  export PATH="$PWD/.venv/bin:$PATH"
elif _git_root=$(git rev-parse --show-toplevel 2>/dev/null) && [[ -d "$_git_root/.venv/bin" ]]; then
  export PATH="$_git_root/.venv/bin:$PATH"
elif [[ -n "${VIRTUAL_ENV:-}" ]] && [[ -x "${VIRTUAL_ENV}/bin/python3" ]]; then
  export PATH="$VIRTUAL_ENV/bin:$PATH"
fi

# Read file path from stdin JSON
file_path=$(cat /dev/stdin | jq -r '.tool_input.file_path // empty' 2>/dev/null) || true

# No file path — skip
if [ -z "$file_path" ]; then
    exit 0
fi

# Not a YAML file — skip
case "$file_path" in
    *.yaml|*.yml) ;;
    *) exit 0 ;;
esac

# Jinja2 template — skip
case "$file_path" in
    *.j2) exit 0 ;;
esac

# File doesn't exist — skip
if [ ! -f "$file_path" ]; then
    exit 0
fi

# python3 not available — skip gracefully
if ! command -v python3 >/dev/null 2>&1; then
    exit 0
fi

# Validate YAML syntax
error_output=$(python3 -c "
import yaml, sys
try:
    with open(sys.argv[1]) as f:
        yaml.safe_load(f)
except yaml.YAMLError as e:
    print(str(e), file=sys.stdout)
    sys.exit(1)
" "$file_path" 2>/dev/null) || true

if [ -n "$error_output" ]; then
    filename=$(basename "$file_path")
    echo "[hook] YAML syntax error in $filename: $error_output"
fi

exit 0

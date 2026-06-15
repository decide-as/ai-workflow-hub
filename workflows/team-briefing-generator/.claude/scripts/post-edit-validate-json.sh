#!/usr/bin/env bash
# post-edit-validate-json.sh — PostToolUse hook that validates JSON syntax
# after Edit/Write operations on .json files.
#
# Skips .j2 files (Jinja2 templates are not valid JSON).
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

# No file path or not a JSON file — skip
if [ -z "$file_path" ] || [[ "$file_path" != *.json ]]; then
    exit 0
fi

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

# Validate JSON syntax
error_output=$(python3 -m json.tool "$file_path" >/dev/null 2>&1) || {
    filename=$(basename "$file_path")
    # Get the actual error message
    error_msg=$(python3 -m json.tool "$file_path" 2>&1 || true)
    echo "[hook] JSON syntax error in $filename: $error_msg"
}

exit 0

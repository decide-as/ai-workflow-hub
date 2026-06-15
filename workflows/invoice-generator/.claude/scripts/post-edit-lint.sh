#!/usr/bin/env bash
# post-edit-lint.sh — PostToolUse hook that runs ruff check (read-only)
# on Python files after Edit/Write operations.
#
# Reports lint warnings but never auto-fixes. Claude decides whether
# to address them.
#
# Exit codes:
#   0 — always (PostToolUse hooks must not fail the session)
#
# Stdin: JSON from Claude Code hook system
# Stdout: feedback shown to Claude (only when warnings found)

set -euo pipefail

# Read file path from stdin JSON
file_path=$(cat /dev/stdin | jq -r '.tool_input.file_path // empty' 2>/dev/null) || true

# No file path or not a Python file — skip
if [ -z "$file_path" ] || [[ "$file_path" != *.py ]]; then
    exit 0
fi

# File doesn't exist — skip
if [ ! -f "$file_path" ]; then
    exit 0
fi

# ruff not available — skip gracefully
if ! command -v ruff >/dev/null 2>&1; then
    exit 0
fi

# Run ruff check (no --fix) and capture output
lint_output=$(ruff check "$file_path" 2>/dev/null) || true

# Report only if real warnings found (filter out "All checks passed!")
if [ -n "$lint_output" ] && ! echo "$lint_output" | grep -q "^All checks passed"; then
    filename=$(basename "$file_path")
    echo "[hook] Lint warnings in $filename:"
    echo "$lint_output"
fi

exit 0

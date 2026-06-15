#!/usr/bin/env bash
# post-edit-format.sh — PostToolUse hook that auto-formats Python files
# after Edit/Write operations using ruff format.
#
# Exit codes:
#   0 — always (PostToolUse hooks must not fail the session)
#
# Stdin: JSON from Claude Code hook system
# Stdout: feedback shown to Claude (only when changes were made)

set -euo pipefail

# Read file path from stdin JSON
file_path=$(cat /dev/stdin | jq -r '.tool_input.file_path // empty' 2>/dev/null) || true

# No file path or not a Python file — skip
if [ -z "$file_path" ] || [[ "$file_path" != *.py ]]; then
    exit 0
fi

# File doesn't exist (e.g., was deleted) — skip
if [ ! -f "$file_path" ]; then
    exit 0
fi

# ruff not available — skip gracefully
if ! command -v ruff >/dev/null 2>&1; then
    exit 0
fi

# Capture file content before formatting
before=$(cat "$file_path")

# Run ruff format on the specific file (suppress all ruff output)
ruff format "$file_path" >/dev/null 2>&1 || true

# Report only if changes were made
after=$(cat "$file_path")
if [ "$before" != "$after" ]; then
    filename=$(basename "$file_path")
    echo "[hook] Formatted $filename"
fi

exit 0

#!/usr/bin/env bash
#
# Commit staged files with a message read from stdin.
# The caller pipes the commit message; this script handles
# the temp file lifecycle internally.
#
# Usage:
#   bash .claude/scripts/commit-staged.sh <<'EOF'
#   ENH Add feature
#
#   Description of changes:
#   - Added the thing
#   EOF
#
# Exit codes:
#   0 — commit created successfully
#   1 — no message provided or git commit failed

set -euo pipefail

# --- Read commit message from stdin ---
msg=$(cat)

if [ -z "$msg" ]; then
  echo "[!!] No commit message provided on stdin." >&2
  exit 1
fi

# --- Auto-format staged Python files with ruff ---
py_files=$(git diff --cached --name-only --diff-filter=ACM -- '*.py' || true)
if [ -n "$py_files" ]; then
  if command -v ruff &>/dev/null; then
    echo "$py_files" | xargs ruff format --quiet 2>/dev/null || true
    echo "$py_files" | xargs git add
  fi
fi

# --- Write to temp file, clean up on exit ---
tmpfile=$(mktemp /tmp/commit_msg_XXXXXX)
trap 'rm -f "$tmpfile"' EXIT
printf '%s\n' "$msg" > "$tmpfile"

# --- Commit ---
git commit -F "$tmpfile"

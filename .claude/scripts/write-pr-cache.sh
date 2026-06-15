#!/usr/bin/env bash
# write-pr-cache.sh — Write a PR pipeline cache file from stdin.
#
# Usage:
#   bash .claude/scripts/write-pr-cache.sh <filename> <<'EOF'
#   ... content ...
#   EOF
#
# Examples:
#   bash .claude/scripts/write-pr-cache.sh risk.md <<'EOF'
#   ### Risk Assessment
#   **Phase:** alpha | **Tier:** basic | **Changed files:** 42
#   EOF
#
#   bash .claude/scripts/write-pr-cache.sh review.md <<'EOF'
#   ### Code Review
#   **Verdict:** PASS
#   EOF
#
# Supported filenames: risk.md, review.md, diff-review.md, coverage.md
# (any .md filename is accepted, but the /pr skill uses these four).
#
# This script exists so Claude Code never needs to construct
# python3 -c "Path('.pr-cache/X').write_text(...)" one-liners,
# which are not in the settings.json allow list and trigger
# permission prompts.
#
# Auto-approved via: Bash(bash *.claude/scripts/*)

set -euo pipefail

if [ $# -ne 1 ]; then
    echo "[!!] Usage: write-pr-cache.sh <filename>" >&2
    echo "[!!] Example: write-pr-cache.sh risk.md <<'EOF'" >&2
    exit 1
fi

filename="$1"

# Validate filename: must be a simple name with .md extension, no path traversal
if [[ "$filename" == *"/"* ]] || [[ "$filename" == *".."* ]]; then
    echo "[!!] Filename must not contain path separators or '..': $filename" >&2
    exit 1
fi

if [[ "$filename" != *.md ]]; then
    echo "[!!] Filename must end in .md: $filename" >&2
    exit 1
fi

# Ensure .pr-cache/ directory exists
mkdir -p .pr-cache

# Read content from stdin and write to cache file
content=$(cat)
if [ -z "$content" ]; then
    echo "[!!] No content provided on stdin" >&2
    exit 1
fi

printf '%s\n' "$content" > ".pr-cache/${filename}"
echo "[ok] Wrote .pr-cache/${filename}"

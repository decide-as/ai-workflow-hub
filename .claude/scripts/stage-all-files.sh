#!/usr/bin/env bash
#
# Stage all changes (respecting .gitignore) and save the
# resulting staged diff to a temporary file.

set -euo pipefail

# --- Ensure we're inside a Git repository -------------------------------
if ! GIT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null); then
  echo "Not inside a Git repository." >&2
  exit 1
fi

# --- Make sure git emits UTF-8 -----------------------------------------
export LC_ALL=C.UTF-8

echo "Staging all changes (respects .gitignore)..."
git add -u          # modified + deleted tracked files
git add .           # new files, respecting .gitignore

# --- Show staged files --------------------------------------------------
STAGED_FILES=$(git diff --cached --name-only)
if [[ -z "$STAGED_FILES" ]]; then
  echo "No changes staged."
  exit 0
fi

echo "Files staged for diff:"
while IFS= read -r f; do
  echo "  $f"
done <<< "$STAGED_FILES"

# --- Generate and save diff --------------------------------------------
echo "Generating formatted diff..."
TMP_DIFF_FILE=$(mktemp /tmp/git_staged_diff.XXXXXX)
mv "$TMP_DIFF_FILE" "${TMP_DIFF_FILE}.diff"
TMP_DIFF_FILE="${TMP_DIFF_FILE}.diff"
git diff --cached | sed 's/^diff --git/\n\ndiff --git/' > "$TMP_DIFF_FILE"

# --- Print saved path or warn ------------------------------------------
if [[ -s "$TMP_DIFF_FILE" ]]; then
  echo "Diff saved to temporary file:"
  echo "  $TMP_DIFF_FILE"
  echo "$TMP_DIFF_FILE"
else
  rm -f "$TMP_DIFF_FILE"
  echo "No diff output to save."
fi

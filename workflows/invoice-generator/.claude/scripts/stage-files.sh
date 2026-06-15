#!/usr/bin/env bash
#
# Stage the given files (force-add if ignored) and save the staged
# git diff for those files to a temporary file.
#
# Usage: stage-files.sh <file> [file ...]

set -euo pipefail

# --- Ensure we're inside a Git repository --------------------------------
if ! GIT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null); then
  echo "Not inside a Git repository." >&2
  exit 1
fi

export LC_ALL=C.UTF-8   # ensure git emits UTF-8

# --- Validate arguments --------------------------------------------------
if [[ $# -eq 0 ]]; then
  echo "Usage: $(basename "$0") <file> [file ...]" >&2
  exit 1
fi

# Normalise paths and make repo-relative
SELECTED_FILES=()
for arg in "$@"; do
  # normalise to forward slashes
  normalized="${arg//\\//}"
  # strip repo root if absolute
  if [[ "$normalized" == "$GIT_ROOT"* ]]; then
    rel="${normalized#$GIT_ROOT/}"
    SELECTED_FILES+=("$rel")
  else
    SELECTED_FILES+=("$normalized")
  fi
done

echo "Files to diff:"
for f in "${SELECTED_FILES[@]}"; do
  echo "  $f"
done

# --- Stage each file (force in case it's ignored) ------------------------
for f in "${SELECTED_FILES[@]}"; do
  full_path="$GIT_ROOT/$f"
  if [[ ! -e "$full_path" ]]; then
    echo "File not found: $f" >&2
    continue
  fi
  echo "Staging: $f"
  git add --force -- "$f"
done

# --- Run git diff --cached for selected files ----------------------------
echo "Running git diff --cached..."
TMP_DIFF_FILE=$(mktemp /tmp/git_staged_diff.XXXXXX)
mv "$TMP_DIFF_FILE" "${TMP_DIFF_FILE}.diff"
TMP_DIFF_FILE="${TMP_DIFF_FILE}.diff"

git diff --cached -- "${SELECTED_FILES[@]}" \
  | sed 's/^diff --git/\n\ndiff --git/' > "$TMP_DIFF_FILE"

# --- Print saved path or warn -------------------------------------------
if [[ -s "$TMP_DIFF_FILE" ]]; then
  echo "Diff saved to temporary file:"
  echo "  $TMP_DIFF_FILE"
  echo "$TMP_DIFF_FILE"
else
  rm -f "$TMP_DIFF_FILE"
  echo "No changes to diff."
fi

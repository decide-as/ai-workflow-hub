#!/usr/bin/env bash
#
# Safe force-push after rebase.
#
# Wraps `git push --force-with-lease` with a safety check that refuses
# to push to master/main. Intended for use after rebasing a feature branch.
#
# Usage:
#   bash .claude/scripts/post-rebase-push.sh
#
# This script is auto-approved by the worktree permission hook via the
# Bash(bash *.claude/scripts/*) pattern, avoiding manual approval prompts
# for force-with-lease pushes that follow a rebase.

set -euo pipefail

# --- Determine current branch ------------------------------------------------
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

if [[ "$CURRENT_BRANCH" == "master" ]] || [[ "$CURRENT_BRANCH" == "main" ]]; then
  echo "[!!] Refusing to force-push to $CURRENT_BRANCH." >&2
  exit 1
fi

# --- Push with force-with-lease ----------------------------------------------
echo "[--] Force-pushing $CURRENT_BRANCH with lease..." >&2
git push --force-with-lease origin "$CURRENT_BRANCH"
echo "[ok] Pushed $CURRENT_BRANCH" >&2

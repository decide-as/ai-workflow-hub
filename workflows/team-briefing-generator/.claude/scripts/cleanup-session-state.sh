#!/usr/bin/env bash
#
# Delete the session-state checkpoint file for a branch.
#
# Usage:
#   bash .claude/scripts/cleanup-session-state.sh              # current branch
#   bash .claude/scripts/cleanup-session-state.sh <branch-slug> # specific branch
#
# When a branch slug is provided, deletes that branch's checkpoint directly.
# This is used by the PR workflow after merge — we know exactly which branch
# was just merged, so no confirmation is needed.
#
# When no argument is given, derives the slug from the current branch.
#
# Safe to call when no checkpoint exists.

set -euo pipefail

if [[ -n "${1:-}" ]]; then
  BRANCH_SLUG="$1"
else
  BRANCH_SLUG=$(git branch --show-current | tr '/' '-')
fi

CHECKPOINT=".claude/session-state-${BRANCH_SLUG}.md"

if [[ -f "$CHECKPOINT" ]]; then
  rm -f "$CHECKPOINT"
  echo "[ok] Removed checkpoint: $CHECKPOINT"
else
  echo "[--] No checkpoint to clean up: $CHECKPOINT"
fi

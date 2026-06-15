#!/usr/bin/env bash
#
# Check for active PRDs matching the current branch.
# Scans docs/prds/prd-*.md for PRDs whose branch: field matches
# the current git branch and whose status: is not "implemented".
#
# No inputs. Read-only. Prints matching PRD IDs or nothing.
#
# Usage:
#   bash .claude/scripts/check-active-prds.sh
#
# Exit codes:
#   0 — always (absence of output means no active PRDs)

set -euo pipefail

branch=$(git branch --show-current)

for f in docs/prds/prd-*.md; do
  [ -f "$f" ] || continue
  prd_branch=$(grep '^branch:' "$f" | sed 's/^branch: *//' || true)
  prd_status=$(grep '^status:' "$f" | sed 's/^status: *//' || true)
  if [ "$prd_branch" = "$branch" ] && [ "$prd_status" != "implemented" ]; then
    prd_id=$(grep '^id:' "$f" | sed 's/^id: *//' || true)
    echo "ACTIVE PRD: $prd_id ($f)"
  fi
done

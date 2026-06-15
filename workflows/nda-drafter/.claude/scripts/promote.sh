#!/usr/bin/env bash
# promote.sh — Create a promotion PR between environment branches.
#
# Usage: bash .claude/scripts/promote.sh [source] [target]
#   source: source branch (default: auto-detect from tier)
#   target: target branch (default: auto-detect from tier)
#
# Auto-detection reads branching_complexity from project-meta.yaml:
#   standard: develop -> master
#   full (no args): develop -> staging
#   full (with staging as source): staging -> master
set -euo pipefail

META_FILE="project-meta.yaml"
SOURCE="${1:-}"
TARGET="${2:-}"

# Read branching tier
if [[ -f "$META_FILE" ]]; then
    TIER=$(grep -E '^branching_complexity:' "$META_FILE" | awk '{print $2}' | tr -d '"' || echo "simple")
else
    TIER="simple"
fi

if [[ "$TIER" == "simple" ]]; then
    echo "[!!] Promotion is not used with the simple branching tier."
    echo "[--] Work branches PR directly to master."
    exit 1
fi

# Auto-detect source and target
if [[ -z "$SOURCE" && -z "$TARGET" ]]; then
    if [[ "$TIER" == "standard" ]]; then
        SOURCE="develop"
        TARGET="master"
    elif [[ "$TIER" == "full" ]]; then
        SOURCE="develop"
        TARGET="staging"
    fi
fi

if [[ -z "$SOURCE" || -z "$TARGET" ]]; then
    echo "[!!] Usage: promote.sh [source] [target]"
    echo "     Example: promote.sh develop staging"
    exit 1
fi

# Validate branches exist
for BRANCH in "$SOURCE" "$TARGET"; do
    if ! git show-ref --verify --quiet "refs/heads/$BRANCH" && \
       ! git show-ref --verify --quiet "refs/remotes/origin/$BRANCH"; then
        echo "[!!] Branch '$BRANCH' does not exist locally or on remote"
        exit 1
    fi
done

# Check for gh CLI
if ! command -v gh >/dev/null 2>&1; then
    echo "[!!] GitHub CLI (gh) not found. Install from https://cli.github.com/"
    exit 1
fi

PREV_GH=$(bash "$(dirname "$0")/gh-switch.sh")
trap 'bash "$(dirname "$0")/gh-switch.sh" --restore "$PREV_GH"' EXIT

TODAY=$(date +%Y-%m-%d)
TITLE="Promote $SOURCE to $TARGET — $TODAY"

echo "[--] Creating promotion PR: $SOURCE -> $TARGET"
echo "[--] Title: $TITLE"

timeout 60 gh pr create \
    --base "$TARGET" \
    --head "$SOURCE" \
    --title "$TITLE" \
    --body "Promotion of \`$SOURCE\` to \`$TARGET\` on $TODAY.

## Promotion checklist

- [ ] CI passes on source branch
- [ ] No known blockers
- [ ] Changelog updated (if promoting to master)"

echo "[ok] Promotion PR created"

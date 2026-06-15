#!/usr/bin/env bash
# hotfix.sh — Create a hotfix branch from the latest release tag.
#
# Usage: bash .claude/scripts/hotfix.sh <name>
#   name: short description of the fix (e.g., payment-crash)
#
# Creates a branch: {date}/hotfix/{name} from the latest release tag.
set -euo pipefail

NAME="${1:-}"

if [[ -z "$NAME" ]]; then
    echo "[!!] Usage: hotfix.sh <name>"
    echo "     Example: hotfix.sh payment-crash"
    exit 1
fi

# Find latest release tag
LATEST_TAG=$(git tag -l 'v*' --sort=-v:refname | head -1)

if [[ -z "$LATEST_TAG" ]]; then
    echo "[!!] No release tags found (expected v* pattern)"
    echo "[--] Create a release tag first: git tag v0.1.0"
    exit 1
fi

TODAY=$(date +%Y-%m-%d)
BRANCH_NAME="${TODAY}/hotfix/${NAME}"

# Check if branch already exists
if git show-ref --verify --quiet "refs/heads/$BRANCH_NAME"; then
    echo "[!!] Branch '$BRANCH_NAME' already exists"
    exit 1
fi

echo "[--] Latest release tag: $LATEST_TAG"
echo "[--] Creating hotfix branch: $BRANCH_NAME"

git checkout -b "$BRANCH_NAME" "$LATEST_TAG"

echo "[ok] Created $BRANCH_NAME from $LATEST_TAG"
echo "[--] Apply your fix, then PR to master."
echo "[--] After merge, cherry-pick to environment branches per your branching tier."

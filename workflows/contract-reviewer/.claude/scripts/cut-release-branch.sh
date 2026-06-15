#!/usr/bin/env bash
# cut-release-branch.sh — Create a release maintenance branch from a tag.
#
# Usage: bash .claude/scripts/cut-release-branch.sh <version_tag>
#   version_tag: e.g., v1.3.0 — creates release/1.3 from this tag
#
# Release branches receive cherry-picked bugfixes for older releases.
# Only one active release branch at a time is recommended.
set -euo pipefail

VERSION_TAG="${1:-}"

if [[ -z "$VERSION_TAG" ]]; then
    echo "[!!] Usage: cut-release-branch.sh <version_tag>"
    echo "     Example: cut-release-branch.sh v1.3.0"
    exit 1
fi

# Validate tag exists
if ! git rev-parse --verify "$VERSION_TAG" >/dev/null 2>&1; then
    echo "[!!] Tag '$VERSION_TAG' does not exist"
    echo "[--] Available tags:"
    git tag -l --sort=-v:refname | head -10
    exit 1
fi

# Extract major.minor from tag (handles v1.3.0, 1.3.0, v1.3, etc.)
MAJOR_MINOR=$(echo "$VERSION_TAG" | sed -E 's/^v?([0-9]+\.[0-9]+).*/\1/')

if [[ -z "$MAJOR_MINOR" ]]; then
    echo "[!!] Could not extract major.minor from tag '$VERSION_TAG'"
    exit 1
fi

RELEASE_BRANCH="release/$MAJOR_MINOR"

# Check if release branch already exists
if git show-ref --verify --quiet "refs/heads/$RELEASE_BRANCH"; then
    echo "[!!] Release branch '$RELEASE_BRANCH' already exists"
    exit 1
fi

echo "[--] Creating release branch '$RELEASE_BRANCH' from tag '$VERSION_TAG'..."
git branch "$RELEASE_BRANCH" "$VERSION_TAG"
echo "[ok] Created $RELEASE_BRANCH"

echo "[--] To push: git push -u origin $RELEASE_BRANCH"

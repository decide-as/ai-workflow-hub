#!/usr/bin/env bash
# upgrade-branching.sh — Transition between branching tiers.
#
# Usage: bash .claude/scripts/upgrade-branching.sh <target_tier>
#   target_tier: simple, standard, or full
#
# Reads current tier from project-meta.yaml, creates or removes environment
# branches as needed, and updates the branching_complexity field.
set -euo pipefail

TARGET_TIER="${1:-}"
META_FILE="project-meta.yaml"

if [[ -z "$TARGET_TIER" ]]; then
    echo "[!!] Usage: upgrade-branching.sh <simple|standard|full>"
    exit 1
fi

if [[ "$TARGET_TIER" != "simple" && "$TARGET_TIER" != "standard" && "$TARGET_TIER" != "full" ]]; then
    echo "[!!] Invalid tier: $TARGET_TIER (must be simple, standard, or full)"
    exit 1
fi

if [[ ! -f "$META_FILE" ]]; then
    echo "[!!] $META_FILE not found in current directory"
    exit 1
fi

# Check for clean working tree
if ! git diff --quiet || ! git diff --cached --quiet; then
    echo "[!!] Working tree is dirty. Commit or stash changes before upgrading."
    exit 1
fi

# Read current tier
CURRENT_TIER=$(grep -E '^branching_complexity:' "$META_FILE" | awk '{print $2}' | tr -d '"' || echo "simple")
if [[ -z "$CURRENT_TIER" ]]; then
    CURRENT_TIER="simple"
fi

echo "[--] Current tier: $CURRENT_TIER"
echo "[--] Target tier:  $TARGET_TIER"

if [[ "$CURRENT_TIER" == "$TARGET_TIER" ]]; then
    echo "[ok] Already at $TARGET_TIER tier. Nothing to do."
    exit 0
fi

# Determine direction
tier_to_num() {
    case "$1" in
        simple)   echo 1 ;;
        standard) echo 2 ;;
        full)     echo 3 ;;
    esac
}

CURRENT_NUM=$(tier_to_num "$CURRENT_TIER")
TARGET_NUM=$(tier_to_num "$TARGET_TIER")

if [[ "$TARGET_NUM" -gt "$CURRENT_NUM" ]]; then
    DIRECTION="upgrade"
else
    DIRECTION="downgrade"
fi

echo "[--] Direction: $DIRECTION"

# Upgrade: create branches
if [[ "$DIRECTION" == "upgrade" ]]; then
    # Need develop?
    if [[ "$CURRENT_NUM" -lt 2 && "$TARGET_NUM" -ge 2 ]]; then
        if git show-ref --verify --quiet "refs/heads/develop"; then
            echo "[--] develop branch already exists"
        else
            echo "[--] Creating develop branch from master..."
            git branch develop master
            echo "[ok] Created develop branch"
        fi
    fi

    # Need staging?
    if [[ "$CURRENT_NUM" -lt 3 && "$TARGET_NUM" -ge 3 ]]; then
        if git show-ref --verify --quiet "refs/heads/staging"; then
            echo "[--] staging branch already exists"
        else
            echo "[--] Creating staging branch from master..."
            git branch staging master
            echo "[ok] Created staging branch"
        fi
    fi
fi

# Downgrade: merge and remove branches
if [[ "$DIRECTION" == "downgrade" ]]; then
    # Remove staging?
    if [[ "$CURRENT_NUM" -ge 3 && "$TARGET_NUM" -lt 3 ]]; then
        if git show-ref --verify --quiet "refs/heads/staging"; then
            echo "[--] Merging staging into master before removal..."
            git checkout master
            git merge staging --no-edit || {
                echo "[!!] Merge conflict merging staging into master. Resolve manually."
                exit 1
            }
            git branch -d staging
            echo "[ok] Removed staging branch"
        fi
    fi

    # Remove develop?
    if [[ "$CURRENT_NUM" -ge 2 && "$TARGET_NUM" -lt 2 ]]; then
        if git show-ref --verify --quiet "refs/heads/develop"; then
            echo "[--] Merging develop into master before removal..."
            git checkout master
            git merge develop --no-edit || {
                echo "[!!] Merge conflict merging develop into master. Resolve manually."
                exit 1
            }
            git branch -d develop
            echo "[ok] Removed develop branch"
        fi
    fi
fi

# Update project-meta.yaml
if grep -q '^branching_complexity:' "$META_FILE"; then
    sed -i.bak "s/^branching_complexity:.*/branching_complexity: $TARGET_TIER/" "$META_FILE"
    rm -f "${META_FILE}.bak"
else
    echo "branching_complexity: $TARGET_TIER" >> "$META_FILE"
fi
echo "[ok] Updated $META_FILE: branching_complexity: $TARGET_TIER"

echo "[ok] Tier transition complete: $CURRENT_TIER -> $TARGET_TIER"

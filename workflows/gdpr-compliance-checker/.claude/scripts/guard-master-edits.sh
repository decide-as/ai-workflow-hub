#!/usr/bin/env bash
# guard-master-edits.sh — PreToolUse hook that blocks file edits on
# protected branches in the main checkout.  Worktrees are always allowed.
# Files inside registered worktree paths are also allowed (even when
# CWD is the main checkout).
#
# Protected branches:
#   - master/main (always)
#   - develop (standard/full branching tiers)
#   - staging (full branching tier)
#
# Exit codes:
#   0 — allow the operation
#   2 — block the operation (PreToolUse convention)
#
# Stdin: JSON from Claude Code hook system

set -euo pipefail

# Not inside a git repo — allow
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    exit 0
fi

# Get current branch
branch=$(git branch --show-current 2>/dev/null || echo "")

# Build list of protected branches
protected=("master" "main")

# Check branching_complexity from project-meta.yaml
repo_root="$(git rev-parse --show-toplevel)"
meta_file="${repo_root}/project-meta.yaml"
if [ -f "$meta_file" ]; then
    tier=$(grep -E '^branching_complexity:' "$meta_file" 2>/dev/null | awk '{print $2}' || echo "")
    case "$tier" in
        standard) protected+=("develop") ;;
        full)     protected+=("develop" "staging") ;;
    esac
fi

# Check if current branch is protected
is_protected=false
for pb in "${protected[@]}"; do
    if [ "$branch" = "$pb" ]; then
        is_protected=true
        break
    fi
done

if [ "$is_protected" = "false" ]; then
    exit 0
fi

# In a worktree, .git is a *file* (contains "gitdir: ...").
# In the main checkout, .git is a *directory*.
# We only block the main checkout.
git_path="$(git rev-parse --show-toplevel)/.git"

if [ -f "$git_path" ]; then
    # This is a worktree — allow
    exit 0
fi

# --- Main checkout + protected branch: check if target file is in a worktree ---

# Read the target file path from the hook JSON on stdin
input=$(cat)
target_file=""
if command -v jq &>/dev/null; then
    target_file=$(echo "$input" | jq -r '.tool_input.file_path // empty')
fi

# If we got a target file path, check if it lives outside the repo root
# (e.g., ~/.claude/memory files) — those are always allowed
if [ -n "$target_file" ] && [[ "$target_file" != "${repo_root}"/* ]]; then
    exit 0
fi

# If we got a target file path, check if it lives inside a registered worktree
if [ -n "$target_file" ]; then
    registry="${repo_root}/.claude/worktree-paths.txt"
    if [ -f "$registry" ]; then
        while IFS= read -r wt_path; do
            [ -z "$wt_path" ] && continue
            if [[ "$target_file" == "${wt_path}"/* ]]; then
                # File is inside a registered worktree — allow
                exit 0
            fi
        done < "$registry"
    fi
fi

# Main checkout + protected branch + file not in a worktree — block
echo "BLOCKED: You are on '$branch' in the main checkout. Create a worktree first:"
echo ""
echo '  bash .claude/scripts/create-worktree.sh <type> [name]'
echo ""
echo "Types: feat, fix, maint, rel, hotfix"
exit 2

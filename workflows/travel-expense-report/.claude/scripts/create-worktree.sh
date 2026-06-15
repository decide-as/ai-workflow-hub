#!/usr/bin/env bash
# create-worktree.sh — One-command worktree creation with venv setup.
#
# Usage: bash .claude/scripts/create-worktree.sh <type> [name] [base-branch]
#
# Arguments:
#   type         Branch type: feat, fix, maint, rel, hotfix
#   name         Short descriptive name (e.g., add-widget, null-pointer).
#                Optional: if omitted, reads from .claude/session-name.
#   base-branch  Base branch to fork from (default: auto-detect from
#                branching_complexity in project-meta.yaml — develop for
#                standard/full tiers, master for simple; hotfix/rel always
#                use master)
#
# Creates a worktree at ../<repo>-<date>-<type>-<name>, sets up an isolated
# venv, registers the worktree for auto-approval, and prints the absolute
# path on the last line for the caller to cd into.
#
# Examples:
#   bash .claude/scripts/create-worktree.sh feat add-widget
#   # => /Users/.../repo-2026-03-18-feat-add-widget
#
#   bash .claude/scripts/create-worktree.sh feat
#   # Reads name from .claude/session-name

set -euo pipefail

# --- Validate arguments ---
if [ $# -lt 1 ]; then
    echo "[!!] Usage: bash .claude/scripts/create-worktree.sh <type> [name] [base-branch]"
    echo "     Types: feat, fix, maint, rel, hotfix"
    echo "     If name is omitted, reads from .claude/session-name"
    exit 1
fi

wt_type="$1"

# --- Determine name: from arg or from .claude/session-name ---
if [ $# -ge 2 ]; then
    wt_name="$2"
    base_branch_arg="${3:-}"
else
    repo_root_early="$(git rev-parse --show-toplevel)"
    session_name_file="${repo_root_early}/.claude/session-name"
    if [ -f "$session_name_file" ]; then
        wt_name=$(tr '[:upper:]' '[:lower:]' < "$session_name_file" \
            | tr -s '[:space:]' '-' \
            | sed 's/[^a-z0-9-]//g' \
            | sed 's/^-//;s/-$//')
        if [ -z "$wt_name" ]; then
            echo "[!!] .claude/session-name resolved to an empty slug after sanitization."
            echo "     Update it with valid characters: echo 'my-feature' > .claude/session-name"
            exit 1
        fi
        echo "[--] Session name from .claude/session-name: ${wt_name}"
    else
        echo "[!!] No name provided and .claude/session-name not found."
        echo "     Save a session name: echo 'my-feature' > .claude/session-name"
        echo "     Or pass explicitly:  bash .claude/scripts/create-worktree.sh feat my-feature"
        exit 1
    fi
    base_branch_arg=""
fi

valid_types="feat fix maint rel hotfix"
if ! echo "$valid_types" | grep -qw "$wt_type"; then
    echo "[!!] Invalid type '$wt_type'. Must be one of: $valid_types"
    exit 1
fi

# --- Determine base branch from branching tier if not provided ---
if [ -n "${base_branch_arg:-}" ]; then
    base_branch="$base_branch_arg"
else
    META_FILE="project-meta.yaml"
    if [[ -f "$META_FILE" ]]; then
        TIER=$(grep -E '^branching_complexity:' "$META_FILE" | awk '{print $2}' | tr -d '"' || echo "simple")
    else
        TIER="simple"
    fi

    if [[ "$wt_type" == "hotfix" || "$wt_type" == "rel" ]]; then
        base_branch="master"
    elif [[ "$TIER" == "standard" || "$TIER" == "full" ]]; then
        base_branch="develop"
    else
        base_branch="master"
    fi
    echo "[--] Auto-detected base branch: ${base_branch} (tier: ${TIER}, type: ${wt_type})"
fi

# --- Derive date and repo name ---
today=$(date +%Y-%m-%d)
repo_root="$(git rev-parse --show-toplevel)"
repo_name="$(basename "$repo_root")"

# --- Build branch and directory names ---
branch_name="${today}/${wt_type}/${wt_name}"
dir_name="${repo_name}-${today}-${wt_type}-${wt_name}"
worktree_dir="$(dirname "$repo_root")/${dir_name}"

# --- Handle collision ---
if [ -d "$worktree_dir" ] || git show-ref --verify --quiet "refs/heads/${branch_name}" 2>/dev/null; then
    suffix=2
    while [ -d "${worktree_dir}-${suffix}" ] || git show-ref --verify --quiet "refs/heads/${branch_name}-${suffix}" 2>/dev/null; do
        suffix=$((suffix + 1))
    done
    branch_name="${branch_name}-${suffix}"
    worktree_dir="${worktree_dir}-${suffix}"
fi

# --- Create worktree ---
echo "[--] Creating worktree: ${worktree_dir}"
echo "[--] Branch: ${branch_name} (from ${base_branch})"
git worktree add "$worktree_dir" -b "$branch_name" "$base_branch"

# --- Setup venv ---
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Run setup-worktree-venv.sh from within the new worktree
(cd "$worktree_dir" && bash "${worktree_dir}/.claude/scripts/setup-worktree-venv.sh")

# --- Configure git SSH identity ---
identity_script="${worktree_dir}/.claude/scripts/setup-git-identity.sh"
if [[ -f "$identity_script" ]]; then
    (cd "$worktree_dir" && bash "$identity_script") \
        || echo "[warn] Git identity setup failed — run manually: bash .claude/scripts/setup-git-identity.sh"
fi

# --- Print path (last line — caller uses this to cd) ---
echo "[ok] Worktree ready: ${worktree_dir}"
echo "$worktree_dir"

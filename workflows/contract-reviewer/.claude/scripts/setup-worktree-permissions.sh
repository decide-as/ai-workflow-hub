#!/usr/bin/env bash
# setup-worktree-permissions.sh — Register a worktree path so the
# approve-worktree-commands.sh hook auto-approves commands targeting it.
#
# Usage: bash .claude/scripts/setup-worktree-permissions.sh
#
# Idempotent: running twice does not create duplicate entries.

set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"

# --- Guard: only useful inside a worktree ---
git_path="${repo_root}/.git"
if [ -d "$git_path" ]; then
    echo "[--] Not a worktree (main checkout). Nothing to do."
    exit 0
fi

# --- Find main checkout ---
main_git_dir="$(git rev-parse --git-common-dir)"
main_checkout="$(dirname "$main_git_dir")"

registry="${main_checkout}/.claude/worktree-paths.txt"

# --- Register (idempotent) ---
if [ -f "$registry" ] && grep -qxF "$repo_root" "$registry"; then
    echo "[ok] Worktree already registered: ${repo_root}"
    exit 0
fi

echo "$repo_root" >> "$registry"
echo "[ok] Registered worktree: ${repo_root}"

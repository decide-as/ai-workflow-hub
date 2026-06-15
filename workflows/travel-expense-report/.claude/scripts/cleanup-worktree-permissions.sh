#!/usr/bin/env bash
# cleanup-worktree-permissions.sh — Unregister a worktree path from the
# approval registry.
#
# Usage: bash .claude/scripts/cleanup-worktree-permissions.sh <worktree-path>
#
# Run from the main checkout before removing the worktree.

set -euo pipefail

worktree_path="${1:?Usage: cleanup-worktree-permissions.sh <worktree-path>}"

# Resolve to absolute path (the directory may already be gone, so tolerate).
if [ -d "$worktree_path" ]; then
    worktree_path="$(cd "$worktree_path" && pwd)"
fi

repo_root="$(git rev-parse --show-toplevel)"
registry="${repo_root}/.claude/worktree-paths.txt"

if [ ! -f "$registry" ]; then
    echo "[--] No worktree registry found. Nothing to clean up."
    exit 0
fi

if ! grep -qxF "$worktree_path" "$registry"; then
    echo "[--] Worktree not in registry: ${worktree_path}"
    exit 0
fi

grep -vxF "$worktree_path" "$registry" > "${registry}.tmp" || true
mv "${registry}.tmp" "$registry"

# Remove registry file if empty.
if [ ! -s "$registry" ]; then
    rm -f "$registry"
fi

echo "[ok] Unregistered worktree: ${worktree_path}"

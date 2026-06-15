#!/usr/bin/env bash
# gh-switch.sh — Switch the gh CLI account for the current project.
#
# Usage:
#   PREV=$(bash .claude/scripts/gh-switch.sh)
#       Reads github_account from project-meta.yaml. If set, switches to that
#       account and prints the previous active account to stdout. If unset,
#       prints the current active account and exits (no switch performed).
#
#   bash .claude/scripts/gh-switch.sh --restore <prev-account>
#       Restores a previously active account. No-op if prev-account is empty
#       or already the active account.
#
# Pattern for callers:
#   PREV_GH=$(bash .claude/scripts/gh-switch.sh)
#   trap 'bash .claude/scripts/gh-switch.sh --restore "$PREV_GH"' EXIT
#
# Requirements:
#   - gh CLI with multi-account support (gh auth switch).
#   - Target account must be logged in via: gh auth login
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
META_FILE="project-meta.yaml"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_get_active_account() {
    # Parse current active account from `gh auth status`.
    # The active account line looks like:
    #   ✓ Logged in to github.com account <username> (keyring)
    # followed by:
    #   - Active account: true
    # Use grep -B1 to get the "Logged in to" line just before the active marker,
    # then take the second-to-last field (username, before "(keyring)").
    gh auth status 2>&1 \
        | grep -B1 "Active account: true" \
        | grep "Logged in to" \
        | awk '{print $(NF-1)}' \
        | head -1
}

# ---------------------------------------------------------------------------
# --restore mode
# ---------------------------------------------------------------------------

if [[ "${1:-}" == "--restore" ]]; then
    PREV="${2:-}"
    if [[ -z "$PREV" ]]; then
        exit 0
    fi
    CURRENT=$(_get_active_account || echo "")
    if [[ "$PREV" != "$CURRENT" ]]; then
        gh auth switch --user "$PREV" >/dev/null
    fi
    exit 0
fi

# ---------------------------------------------------------------------------
# Switch mode
# ---------------------------------------------------------------------------

# Capture the current active account before any switch.
CURRENT=$(_get_active_account || echo "")

# Read github_account from project-meta.yaml.
# read-project-meta.sh outputs "field=value"; strip the "field=" prefix.
TARGET=""
if [[ -f "$META_FILE" ]]; then
    RAW=$(bash "$SCRIPT_DIR/read-project-meta.sh" github_account 2>/dev/null || echo "")
    TARGET="${RAW#*=}"  # strip everything up to and including the first '='
fi

# Always print the current account so callers can restore it.
echo "$CURRENT"

# Switch only if a target is configured and it differs from the current account.
if [[ -n "$TARGET" && "$TARGET" != "$CURRENT" ]]; then
    gh auth switch --user "$TARGET" >/dev/null
fi

#!/usr/bin/env bash
# Post an agent coverage report comment on a pull request.
#
# Usage:
#   pr-comment-agent-coverage.sh <pr-number> <<'EOF'
#   <formatted coverage report markdown>
#   EOF
#
# Reads formatted coverage report from stdin (including tier enforcement
# table), wraps it with an HTML comment marker, and posts (or updates)
# a comment on the PR. Distinct from the CI-posted coverage delta comment
# (<!-- coverage-delta-comment -->) which shows base-vs-PR delta only.
#
# Requires: gh CLI with GH_TOKEN set or authenticated session.

set -euo pipefail

# GNU timeout is unavailable on macOS; fall back to running gh without a limit.
_timeout() { command -v timeout >/dev/null 2>&1 && timeout 60 "$@" || "$@"; }

PREV_GH=$(bash "$(dirname "$0")/gh-switch.sh")
trap 'bash "$(dirname "$0")/gh-switch.sh" --restore "$PREV_GH"' EXIT

PR_NUMBER="${1:?Usage: pr-comment-agent-coverage.sh <pr-number> < content}"

COMMENT_MARKER="<!-- agent-coverage-report -->"

# Read content from stdin
CONTENT=$(cat)

if [ -z "$CONTENT" ]; then
  echo "[--] No content provided via stdin — skipping coverage report comment."
  exit 0
fi

# Prepend marker
COMMENT_BODY=$(printf '%s\n%s' "$COMMENT_MARKER" "$CONTENT")

# Write comment body to temp file (avoids shell quoting issues)
COMMENT_FILE=$(mktemp)
trap 'rm -f "$COMMENT_FILE"' EXIT
printf '%s\n' "$COMMENT_BODY" > "$COMMENT_FILE"

# Check if a previous agent coverage comment exists and update it, otherwise create new
EXISTING_COMMENT_ID=$(_timeout gh api "repos/{owner}/{repo}/issues/${PR_NUMBER}/comments" \
  --jq ".[] | select(.body | contains(\"$COMMENT_MARKER\")) | .id" 2>/dev/null | head -1)

if [ -n "$EXISTING_COMMENT_ID" ]; then
  _timeout gh api "repos/{owner}/{repo}/issues/comments/${EXISTING_COMMENT_ID}" \
    -X PATCH -F "body=@${COMMENT_FILE}" --silent
  echo "[ok] Updated coverage report comment on PR #$PR_NUMBER"
else
  _timeout gh pr comment "$PR_NUMBER" --body-file "$COMMENT_FILE"
  echo "[ok] Posted coverage report comment on PR #$PR_NUMBER"
fi

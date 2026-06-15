#!/usr/bin/env bash
set -euo pipefail

# Protect the default branch (master or main) on GitHub.
#
# Usage:
#   setup-branch-protection.sh [OWNER/REPO]
#
# If OWNER/REPO is omitted, it is inferred from the current git remote.
# Requires the GitHub CLI (gh) with admin-level permissions.
#
# Note: Branch protection requires GitHub Pro for private repositories.
# For private repos on free plans, this script will warn and exit cleanly.

if [[ "${1:-}" != "" ]]; then
  repo="$1"
else
  remote_url="$(git remote get-url origin 2>/dev/null || true)"
  if [[ -z "$remote_url" ]]; then
    echo "[!!] No remote 'origin' found and no OWNER/REPO argument given." >&2
    exit 1
  fi
  # Extract owner/repo from SSH or HTTPS URL
  repo="$(echo "$remote_url" | sed -E 's#.*[:/]([^/]+/[^/]+?)(\.git)?$#\1#')"
fi

# Detect default branch
default_branch="$(timeout 60 gh api "repos/${repo}" --jq '.default_branch' 2>/dev/null || true)"
if [[ -z "$default_branch" ]]; then
  echo "[!!] Could not determine default branch for ${repo}." >&2
  exit 1
fi

echo "[--] Protecting branch '${default_branch}' on ${repo}..."

# Try rulesets API first (preferred, more flexible)
ruleset_payload='{"name":"Protect default branch","target":"branch","enforcement":"active","conditions":{"ref_name":{"include":["refs/heads/'"${default_branch}"'"],"exclude":[]}},"rules":[{"type":"deletion"},{"type":"non_fast_forward"},{"type":"pull_request","parameters":{"required_approving_review_count":0,"dismiss_stale_reviews_on_push":false,"require_code_owner_review":false}}]}'

if timeout 60 gh api "repos/${repo}/rulesets" --method POST --input - <<< "$ruleset_payload" > /dev/null 2>&1; then
  echo "[ok] Branch '${default_branch}' protected via ruleset on ${repo}."
  exit 0
fi

# Fall back to branch protection API
protection_payload='{"required_pull_request_reviews":{"required_approving_review_count":0,"dismiss_stale_reviews":false,"require_code_owner_reviews":false},"required_status_checks":null,"enforce_admins":false,"restrictions":null,"allow_force_pushes":false,"allow_deletions":false}'

if timeout 60 gh api "repos/${repo}/branches/${default_branch}/protection" --method PUT --input - <<< "$protection_payload" > /dev/null 2>&1; then
  echo "[ok] Branch '${default_branch}' protected on ${repo}."
  exit 0
fi

echo "[!!] Branch protection failed — this feature requires GitHub Pro for private repos." >&2
echo "[--] Consider making the repo public or upgrading to GitHub Pro." >&2
exit 1

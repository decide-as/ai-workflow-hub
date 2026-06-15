#!/usr/bin/env bash
# Post a coverage delta comment on a pull request.
#
# Usage: pr-comment-coverage.sh <base-coverage.json> <pr-coverage.json> <pr-number>
#
# Compares per-module coverage between the base branch and the PR branch,
# formats a markdown table, and posts (or updates) a comment on the PR.
# Requires: python3, gh CLI with GH_TOKEN set.

set -euo pipefail

PREV_GH=$(bash "$(dirname "$0")/gh-switch.sh")
trap 'bash "$(dirname "$0")/gh-switch.sh" --restore "$PREV_GH"' EXIT

# ---- Activate local venv if present ------------------------------------------
if [[ -d ".venv/bin" ]]; then
  export PATH="$PWD/.venv/bin:$PATH"
elif _git_root=$(git rev-parse --show-toplevel 2>/dev/null) && [[ -d "$_git_root/.venv/bin" ]]; then
  export PATH="$_git_root/.venv/bin:$PATH"
elif [[ -n "${VIRTUAL_ENV:-}" ]] && [[ -x "${VIRTUAL_ENV}/bin/python3" ]]; then
  export PATH="$VIRTUAL_ENV/bin:$PATH"
fi

BASE_COV="${1:?Usage: pr-comment-coverage.sh <base-cov.json> <pr-cov.json> <pr-number>}"
PR_COV="${2:?Usage: pr-comment-coverage.sh <base-cov.json> <pr-cov.json> <pr-number>}"
PR_NUMBER="${3:?Usage: pr-comment-coverage.sh <base-cov.json> <pr-cov.json> <pr-number>}"

COMMENT_MARKER="<!-- coverage-delta-comment -->"

# Generate the coverage delta markdown using Python.
# Variables are passed via environment to avoid shell injection in inline Python.
COMMENT_BODY=$(BASE_COV="$BASE_COV" PR_COV="$PR_COV" COMMENT_MARKER="$COMMENT_MARKER" python3 -c "
import json, os, sys

base_cov_path = os.environ['BASE_COV']
pr_cov_path = os.environ['PR_COV']
marker = os.environ['COMMENT_MARKER']

with open(base_cov_path) as f:
    base = json.load(f)
with open(pr_cov_path) as f:
    pr = json.load(f)

base_total = base.get('totals', {}).get('percent_covered', 0)
pr_total = pr.get('totals', {}).get('percent_covered', 0)
delta_total = pr_total - base_total

# Per-module deltas (only modules that changed)
base_files = base.get('files', {})
pr_files = pr.get('files', {})
all_modules = sorted(set(list(base_files.keys()) + list(pr_files.keys())))

rows = []
for mod in all_modules:
    base_pct = base_files.get(mod, {}).get('summary', {}).get('percent_covered', 0)
    pr_pct = pr_files.get(mod, {}).get('summary', {}).get('percent_covered', 0)
    delta = pr_pct - base_pct
    if abs(delta) >= 0.1:  # Only show modules with meaningful change
        icon = '\U0001f534' if delta < -1 else ('\U0001f7e2' if delta > 1 else '\u26aa')
        short = mod.split('/')[-1]
        rows.append(f'| \`{short}\` | {base_pct:.1f}% | {pr_pct:.1f}% | {delta:+.1f}% | {icon} |')

total_icon = '\U0001f534' if delta_total < -1 else ('\U0001f7e2' if delta_total > 1 else '\u26aa')

lines = [marker]
lines.append(f'### Coverage: {pr_total:.1f}% ({delta_total:+.1f}%) {total_icon}')
lines.append('')

if rows:
    lines.append('| Module | Base | PR | Delta | |')
    lines.append('|--------|-----:|---:|------:|-|')
    lines.extend(rows)
else:
    lines.append('No per-module coverage changes detected.')

print('\n'.join(lines))
")

# Write comment body to temp file (avoids shell quoting issues)
COMMENT_FILE=$(mktemp)
printf '%s\n' "$COMMENT_BODY" > "$COMMENT_FILE"

# Check if a previous coverage comment exists and update it, otherwise create new
EXISTING_COMMENT_ID=$(timeout 60 gh api "repos/{owner}/{repo}/issues/${PR_NUMBER}/comments" \
  --jq ".[] | select(.body | contains(\"$COMMENT_MARKER\")) | .id" 2>/dev/null | head -1)

if [ -n "$EXISTING_COMMENT_ID" ]; then
  timeout 60 gh api "repos/{owner}/{repo}/issues/comments/${EXISTING_COMMENT_ID}" \
    -X PATCH -F "body=@${COMMENT_FILE}" --silent
  echo "[ok] Updated coverage comment on PR #$PR_NUMBER"
else
  timeout 60 gh pr comment "$PR_NUMBER" --body-file "$COMMENT_FILE"
  echo "[ok] Posted coverage comment on PR #$PR_NUMBER"
fi

rm -f "$COMMENT_FILE"

#!/usr/bin/env bash
#
# Retro analyzer: Convention Compliance
#
# Checks adherence to commit message conventions (TLA or conventional),
# commit message quality, and branch naming patterns.
#
# Usage:
#   bash retro-compliance.sh --since 2026-03-01 --until 2026-03-17
#
# Output: JSON to stdout. Info/errors to stderr.
# Compatible with bash 3.2+ (macOS default).

set -euo pipefail

# ---- Defaults ----------------------------------------------------------------
SINCE=""
UNTIL=""
REPO_ROOT=""

# ---- Parse arguments ---------------------------------------------------------
while [[ $# -gt 0 ]]; do
  case "$1" in
    --since)     SINCE="$2"; shift 2 ;;
    --until)     UNTIL="$2"; shift 2 ;;
    --repo-root) REPO_ROOT="$2"; shift 2 ;;
    *)           echo "[!!] Unknown argument: $1" >&2; exit 1 ;;
  esac
done

if [[ -z "$SINCE" || -z "$UNTIL" ]]; then
  echo "[!!] --since and --until are required" >&2
  exit 1
fi

# ---- Ensure we are inside a Git repository -----------------------------------
if [[ -n "$REPO_ROOT" ]]; then
  git -C "$REPO_ROOT" rev-parse --show-toplevel >/dev/null 2>&1 || { echo "[!!] Not a Git repository: $REPO_ROOT" >&2; exit 1; }
  cd "$REPO_ROOT"
elif ! REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null); then
  echo "[!!] Not inside a Git repository." >&2
  exit 1
else
  cd "$REPO_ROOT"
fi

echo "[--] Analyzing compliance from $SINCE to $UNTIL" >&2

# ---- Collect commit subjects to temp file ------------------------------------
tmp_subjects=$(mktemp /tmp/retro_compliance_XXXXXX.txt)
trap 'rm -f "$tmp_subjects"' EXIT

git log --format="%s" --since="$SINCE" --until="$UNTIL" --no-merges 2>/dev/null > "$tmp_subjects" || true

TOTAL=$(wc -l < "$tmp_subjects" | tr -d ' ')

if [[ "$TOTAL" -eq 0 ]]; then
  cat <<'EOJSON'
{"analyzer":"compliance","schema_version":1,"skipped":true,"reason":"No commits in window","metrics":{},"findings":[]}
EOJSON
  exit 0
fi

# ---- Separate PR squash-merges from regular commits -------------------------
# PR squash-merges use the PR title as subject (ending with "(#N)").
# TLA prefix compliance is measured only on non-PR commits because PR titles
# bundle multiple commit types and were never designed to carry a single TLA.
tmp_pr=$(mktemp /tmp/retro_compliance_pr_XXXXXX.txt)
tmp_non_pr=$(mktemp /tmp/retro_compliance_nonpr_XXXXXX.txt)
trap 'rm -f "$tmp_subjects" "$tmp_pr" "$tmp_non_pr"' EXIT

while IFS= read -r subj; do
  if echo "$subj" | grep -qE '\(#[0-9]+\)$'; then
    echo "$subj" >> "$tmp_pr"
  else
    echo "$subj" >> "$tmp_non_pr"
  fi
done < "$tmp_subjects"

PR_TOTAL=$(wc -l < "$tmp_pr" 2>/dev/null | tr -d ' ')
NON_PR_TOTAL=$(wc -l < "$tmp_non_pr" 2>/dev/null | tr -d ' ')

# ---- Check prefix compliance (non-PR commits only) --------------------------
with_prefix=0
without_prefix=0

if [[ -s "$tmp_non_pr" ]]; then
  while IFS= read -r subj; do
    has_tla=$(echo "$subj" | grep -cE '^[A-Z]{2,4}[[:space:]]' || true)
    has_cc=$(echo "$subj" | grep -cE '^(feat|fix|refactor|test|chore|docs|ci|perf|build|style)(\(.+\))?:' || true)
    if [[ $has_tla -gt 0 || $has_cc -gt 0 ]]; then
      with_prefix=$((with_prefix + 1))
    else
      without_prefix=$((without_prefix + 1))
    fi
  done < "$tmp_non_pr"
fi

if [[ $NON_PR_TOTAL -gt 0 ]]; then
  prefix_pct=$(awk "BEGIN {printf \"%.1f\", $with_prefix * 100 / $NON_PR_TOTAL}")
else
  prefix_pct="0"
fi

# ---- Commit message quality --------------------------------------------------
total_length=0
long_subjects=0

while IFS= read -r subj; do
  len=${#subj}
  total_length=$((total_length + len))
  if [[ $len -gt 50 ]]; then
    long_subjects=$((long_subjects + 1))
  fi
done < "$tmp_subjects"

avg_length=$(awk "BEGIN {printf \"%.1f\", $total_length / $TOTAL}")

# Check for multi-line commit messages (have a body)
with_body=$(git log --format="%B---END---" --since="$SINCE" --until="$UNTIL" --no-merges 2>/dev/null \
  | awk '/---END---/{if(lines>1) c++; lines=0; next} {lines++} END{print c+0}' || echo 0)

# ---- Branch naming compliance ------------------------------------------------
branches_total=0
branches_compliant=0

while IFS= read -r branch; do
  [[ -z "$branch" ]] && continue
  branch=$(echo "$branch" | sed 's/^[*+ ]*//')
  [[ "$branch" == "master" || "$branch" == "main" ]] && continue

  branch_commits=$( (git log --oneline --since="$SINCE" --until="$UNTIL" "$branch" 2>/dev/null || true) | wc -l | tr -d ' ')
  if [[ $branch_commits -gt 0 ]]; then
    branches_total=$((branches_total + 1))
    if echo "$branch" | grep -qE '^[0-9]{4}-[0-9]{2}-[0-9]{2}-'; then
      branches_compliant=$((branches_compliant + 1))
    fi
  fi
done < <(git branch --list 2>/dev/null || true)

if [[ $branches_total -gt 0 ]]; then
  branch_pct=$(awk "BEGIN {printf \"%.1f\", $branches_compliant * 100 / $branches_total}")
else
  branch_pct="null"
fi

# ---- Findings ----------------------------------------------------------------
finding_items=""

if [[ $NON_PR_TOTAL -gt 5 ]]; then
  prefix_pct_int=$(echo "$prefix_pct" | cut -d. -f1)
  if [[ $prefix_pct_int -lt 70 ]]; then
    finding_items="${finding_items}\"Only ${prefix_pct}% of non-PR commits use a recognized prefix — convention compliance is low\","
  elif [[ $prefix_pct_int -ge 95 ]]; then
    finding_items="${finding_items}\"${prefix_pct}% prefix compliance on non-PR commits — excellent convention adherence\","
  fi
elif [[ $NON_PR_TOTAL -eq 0 && $TOTAL -gt 0 ]]; then
  finding_items="${finding_items}\"All ${TOTAL} commits are PR squash-merges — no non-PR commits to measure prefix compliance\","
fi

if [[ $TOTAL -gt 0 && $((long_subjects * 100 / TOTAL)) -gt 30 ]]; then
  finding_items="${finding_items}\"${long_subjects} of ${TOTAL} commit subjects exceed 50 characters — keep first lines concise\","
fi

if [[ "$branch_pct" != "null" ]]; then
  branch_pct_int=$(echo "$branch_pct" | cut -d. -f1)
  if [[ $branches_total -gt 2 && $branch_pct_int -lt 50 ]]; then
    finding_items="${finding_items}\"Only ${branch_pct}% of active branches follow date-prefix naming convention\","
  fi
fi

if [[ -n "$finding_items" ]]; then
  findings="[${finding_items%,}]"
else
  findings="[]"
fi

# ---- Output JSON -------------------------------------------------------------
cat <<EOJSON
{
  "analyzer": "compliance",
  "schema_version": 1,
  "skipped": false,
  "metrics": {
    "total_commits": $TOTAL,
    "pr_squash_merges": $PR_TOTAL,
    "non_pr_commits": $NON_PR_TOTAL,
    "commits_with_prefix": $with_prefix,
    "commits_without_prefix": $without_prefix,
    "prefix_compliance_pct": $prefix_pct,
    "avg_subject_length": $avg_length,
    "long_subjects": $long_subjects,
    "commits_with_body": $with_body,
    "branches_total": $branches_total,
    "branches_compliant": $branches_compliant,
    "branch_naming_compliance_pct": ${branch_pct}
  },
  "findings": $findings
}
EOJSON

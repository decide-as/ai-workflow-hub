#!/usr/bin/env bash
#
# Retro analyzer: Technical Debt
#
# Identifies hotspot files (high churn), TODO/FIXME counts,
# and stale branches.
#
# Usage:
#   bash retro-debt.sh --since 2026-03-01 --until 2026-03-17
#
# Output: JSON to stdout. Info/errors to stderr.
# Compatible with bash 3.2+ (macOS default).

set -euo pipefail

# Escape a string for safe embedding in JSON values
json_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g; s/	/\\t/g' | tr -d '\n\r'
}

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

echo "[--] Analyzing technical debt from $SINCE to $UNTIL" >&2

# ---- Check for commits in window ---------------------------------------------
commit_count=$(git log --oneline --since="$SINCE" --until="$UNTIL" --no-merges 2>/dev/null | wc -l | tr -d ' ')

if [[ "$commit_count" -eq 0 ]]; then
  cat <<'EOJSON'
{"analyzer":"debt","schema_version":1,"skipped":true,"reason":"No commits in window","metrics":{},"findings":[]}
EOJSON
  exit 0
fi

# ---- Hotspot files (most frequently changed) ---------------------------------
hotspot_items=""
high_churn=0

while IFS= read -r line; do
  [[ -z "$line" ]] && continue
  count=$(echo "$line" | awk '{print $1}')
  file=$(echo "$line" | awk '{$1=""; print substr($0,2)}')
  [[ -z "$file" ]] && continue
  # Skip deleted files
  [[ -f "$file" ]] || continue
  hotspot_items="${hotspot_items}{\"file\":\"$(json_escape "$file")\",\"changes\":${count}},"
  if [[ $count -ge 5 ]]; then
    high_churn=$((high_churn + 1))
  fi
done < <(
  git log --name-only --format="" --since="$SINCE" --until="$UNTIL" --no-merges 2>/dev/null \
    | grep -v '^$' | sort | uniq -c | sort -rn | head -10 || true
)

if [[ -n "$hotspot_items" ]]; then
  hotspot_json="[${hotspot_items%,}]"
else
  hotspot_json="[]"
fi

# ---- TODO/FIXME count --------------------------------------------------------
# Only count TODOs in actual source code files, not documentation, templates,
# schemas, or config files that *reference* TODO/FIXME as concepts.
todo_current=0
src_dirs=""

for dir in src lib app; do
  [[ -d "$dir" ]] && src_dirs="$src_dirs $dir"
done

# Source code extensions — excludes .md, .j2, .json, .yaml, .toml, .txt, .sh, etc.
# Shell scripts (.sh) are excluded because bundled scripts (e.g., retro-debt.sh
# itself) contain "TODO" in grep patterns and comments, producing false positives.
SRC_INCLUDES='--include=*.py --include=*.js --include=*.ts --include=*.jsx --include=*.tsx --include=*.go --include=*.rs --include=*.rb --include=*.java'

if [[ -n "$src_dirs" ]]; then
  # shellcheck disable=SC2086
  todo_current=$( (grep -rn $SRC_INCLUDES 'TODO\|FIXME' $src_dirs 2>/dev/null || true) | wc -l | tr -d ' ')
else
  # shellcheck disable=SC2086
  todo_current=$( (grep -rn --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=.venv --exclude-dir=__pycache__ $SRC_INCLUDES 'TODO\|FIXME' . 2>/dev/null || true) | wc -l | tr -d ' ')
fi

# Try to get TODO count at start of window using git grep
# git grep doesn't support --include, so filter by extension with pathspec globs
todo_start="null"
todo_delta="null"
if [[ $commit_count -lt 100 ]]; then
  first_commit=$(git log --format="%H" --since="$SINCE" --until="$UNTIL" --no-merges --reverse 2>/dev/null | head -1 || true)
  if [[ -n "$first_commit" ]]; then
    # Build pathspec list from source dirs (or root) × source extensions
    git_pathspecs=""
    pathspec_dirs="${src_dirs:-.}"
    for d in $pathspec_dirs; do
      for ext in '*.py' '*.js' '*.ts' '*.jsx' '*.tsx' '*.go' '*.rs' '*.rb' '*.java'; do
        git_pathspecs="$git_pathspecs $d/$ext"
      done
    done
    # shellcheck disable=SC2086
    todo_start=$(git grep -c 'TODO\|FIXME' "$first_commit" -- $git_pathspecs 2>/dev/null \
      | grep -v 'Binary' \
      | awk -F: '{s+=$NF} END {print s+0}' || true)
    # Ensure single integer: take last line (the awk summary), strip whitespace
    todo_start=$(echo "$todo_start" | tail -1 | tr -d '[:space:]')
    if [[ -z "$todo_start" || "$todo_start" == "0" ]]; then todo_start=0; fi
    todo_delta=$((todo_current - todo_start))
  fi
fi

# ---- Stale branches ----------------------------------------------------------
stale_items=""
stale_count=0
now_epoch=$(date +%s)
thirty_days=$((30 * 86400))

while IFS= read -r branch; do
  [[ -z "$branch" ]] && continue
  branch=$(echo "$branch" | sed 's/^[*+ ]*//')
  [[ "$branch" == "master" || "$branch" == "main" ]] && continue

  last_commit_epoch=$(git log -1 --format="%at" "$branch" 2>/dev/null || echo 0)
  if [[ $last_commit_epoch -gt 0 && $((now_epoch - last_commit_epoch)) -gt $thirty_days ]]; then
    last_date=$(git log -1 --format="%ad" --date=short "$branch" 2>/dev/null || echo "unknown")
    stale_items="${stale_items}\"$(json_escape "$branch") (last: ${last_date})\","
    stale_count=$((stale_count + 1))
  fi
done < <(git branch --list 2>/dev/null || true)

if [[ -n "$stale_items" ]]; then
  stale_json="[${stale_items%,}]"
else
  stale_json="[]"
fi

# ---- Findings ----------------------------------------------------------------
finding_items=""

if [[ $high_churn -gt 0 ]]; then
  finding_items="${finding_items}\"${high_churn} file(s) changed 5+ times — potential hotspots worth refactoring or splitting\","
fi

if [[ "$todo_delta" != "null" && $todo_delta -gt 5 ]]; then
  finding_items="${finding_items}\"TODO/FIXME count grew by ${todo_delta} — debt is accumulating faster than it's being resolved\","
elif [[ "$todo_delta" != "null" && $todo_delta -lt -3 ]]; then
  abs_delta=$(( -todo_delta ))
  finding_items="${finding_items}\"TODO/FIXME count decreased by ${abs_delta} — good progress on resolving debt\","
fi

if [[ $stale_count -gt 3 ]]; then
  finding_items="${finding_items}\"${stale_count} stale branches (no activity in 30+ days) — consider cleanup\","
fi

if [[ -n "$finding_items" ]]; then
  findings="[${finding_items%,}]"
else
  findings="[]"
fi

# ---- Output JSON -------------------------------------------------------------
cat <<EOJSON
{
  "analyzer": "debt",
  "schema_version": 1,
  "skipped": false,
  "metrics": {
    "hotspot_files": $hotspot_json,
    "high_churn_files": $high_churn,
    "todo_count_current": $todo_current,
    "todo_count_start": $todo_start,
    "todo_delta": $todo_delta,
    "stale_branches": $stale_json,
    "stale_branch_count": $stale_count
  },
  "findings": $findings
}
EOJSON

#!/usr/bin/env bash
#
# Retro analyzer: Strategic Alignment
#
# Maps work to project areas, computes focus score, and checks
# for PRD linkage and prioritization alignment.
#
# Usage:
#   bash retro-alignment.sh --since 2026-03-01 --until 2026-03-17
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

echo "[--] Analyzing alignment from $SINCE to $UNTIL" >&2

# ---- Check for commits in window ---------------------------------------------
commit_count=$(git log --oneline --since="$SINCE" --until="$UNTIL" --no-merges 2>/dev/null | wc -l | tr -d ' ')

if [[ "$commit_count" -eq 0 ]]; then
  cat <<'EOJSON'
{"analyzer":"alignment","schema_version":1,"skipped":true,"reason":"No commits in window","metrics":{},"findings":[]}
EOJSON
  exit 0
fi

# ---- Directory distribution --------------------------------------------------
# Count file changes per top-level directory using sort/uniq (no associative arrays)
tmp_dirs=$(mktemp /tmp/retro_alignment_XXXXXX.txt)
trap 'rm -f "$tmp_dirs"' EXIT

git log --name-only --format="" --since="$SINCE" --until="$UNTIL" --no-merges 2>/dev/null \
  | grep -v '^$' \
  | sed 's|/.*||' \
  | grep -v '^\.' \
  | sort | uniq -c | sort -rn > "$tmp_dirs" || true

total_file_refs=$(awk '{s+=$1} END {print s+0}' "$tmp_dirs")

# Build JSON arrays from sorted output
dir_json="{"
top_areas_json="["
rank=0
top2_count=0
first=true

while IFS= read -r line; do
  [[ -z "$line" ]] && continue
  count=$(echo "$line" | awk '{print $1}')
  dir=$(echo "$line" | awk '{print $2}')
  [[ -z "$dir" ]] && continue
  rank=$((rank + 1))

  if [[ $rank -le 2 ]]; then
    top2_count=$((top2_count + count))
  fi

  if [[ "$first" == "true" ]]; then
    first=false
  else
    dir_json="${dir_json},"
    top_areas_json="${top_areas_json},"
  fi
  dir_json="${dir_json}\"$(json_escape "$dir")\":${count}"
  top_areas_json="${top_areas_json}{\"directory\":\"$(json_escape "$dir")\",\"file_changes\":${count},\"rank\":${rank}}"
done < <(head -15 "$tmp_dirs")

dir_json="${dir_json}}"
top_areas_json="${top_areas_json}]"

# ---- Focus score -------------------------------------------------------------
if [[ $total_file_refs -gt 0 ]]; then
  focus_score=$(awk "BEGIN {printf \"%.1f\", $top2_count * 100 / $total_file_refs}")
else
  focus_score="0"
fi

# ---- PRD linkage -------------------------------------------------------------
prd_linked=0
prd_exists="false"

if [[ -d "docs/prds" ]]; then
  prd_count=0
  for f in docs/prds/prd-*.md; do
    [[ -f "$f" ]] && prd_count=$((prd_count + 1))
  done
  if [[ $prd_count -gt 0 ]]; then
    prd_exists="true"
    prd_linked_raw=$(git log --format="%s %b" --since="$SINCE" --until="$UNTIL" --no-merges 2>/dev/null \
      | grep -ci 'prd-[0-9]' || true)
    prd_linked=$(echo "$prd_linked_raw" | tr -d '[:space:]')
    if [[ -z "$prd_linked" ]]; then prd_linked=0; fi
  fi
fi

# ---- Prioritization alignment ------------------------------------------------
has_prioritization="false"
if [[ -d "docs/prioritization" ]]; then
  pri_count=0
  for f in docs/prioritization/*.yaml docs/prioritization/*.yml; do
    [[ -f "$f" ]] && pri_count=$((pri_count + 1))
  done
  if [[ $pri_count -gt 0 ]]; then
    has_prioritization="true"
  fi
fi

# ---- Findings ----------------------------------------------------------------
finding_items=""

focus_int=$(echo "$focus_score" | cut -d. -f1)
if [[ $focus_int -lt 40 && $rank -gt 3 ]]; then
  finding_items="${finding_items}\"Focus score is ${focus_score}% — work is spread across many areas. Consider concentrating on fewer priorities\","
elif [[ $focus_int -ge 70 ]]; then
  finding_items="${finding_items}\"Focus score is ${focus_score}% — strong concentration on core areas\","
fi

if [[ "$prd_exists" == "true" && "$prd_linked" -eq 0 ]]; then
  finding_items="${finding_items}\"PRDs exist but no commits reference them — consider linking work to planned outcomes\","
fi

if [[ "$has_prioritization" == "true" ]]; then
  finding_items="${finding_items}\"Prioritization docs found — review alignment of top work areas against scored initiatives\","
fi

if [[ -n "$finding_items" ]]; then
  findings="[${finding_items%,}]"
else
  findings="[]"
fi

# ---- Output JSON -------------------------------------------------------------
cat <<EOJSON
{
  "analyzer": "alignment",
  "schema_version": 1,
  "skipped": false,
  "metrics": {
    "directory_distribution": $dir_json,
    "focus_score": $focus_score,
    "total_file_changes": $total_file_refs,
    "top_areas": $top_areas_json,
    "prd_linked_commits": $prd_linked,
    "has_prds": $prd_exists,
    "has_prioritization": $has_prioritization
  },
  "findings": $findings
}
EOJSON

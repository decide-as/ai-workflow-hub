#!/usr/bin/env bash
#
# Retro analyzer: Delivery
#
# Categorizes commits by type (feature, fix, maintenance, test, doc)
# and computes delivery ratio. Auto-detects TLA vs conventional commit
# prefix conventions.
#
# Usage:
#   bash retro-delivery.sh --since 2026-03-01 --until 2026-03-17
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

echo "[--] Analyzing delivery from $SINCE to $UNTIL" >&2

# ---- Collect commit subjects to temp file ------------------------------------
tmp_subjects=$(mktemp /tmp/retro_delivery_XXXXXX.txt)
trap 'rm -f "$tmp_subjects"' EXIT

git log --format="%s" --since="$SINCE" --until="$UNTIL" --no-merges 2>/dev/null > "$tmp_subjects" || true

TOTAL=$(wc -l < "$tmp_subjects" | tr -d ' ')

if [[ "$TOTAL" -eq 0 ]]; then
  cat <<'EOJSON'
{"analyzer":"delivery","schema_version":1,"skipped":true,"reason":"No commits in window","metrics":{},"findings":[]}
EOJSON
  exit 0
fi

# ---- Detect convention (TLA vs conventional commits) -------------------------
tla_count=0
cc_count=0
sample_size=$TOTAL
if [[ $sample_size -gt 20 ]]; then
  sample_size=20
fi

line_num=0
while IFS= read -r subj; do
  line_num=$((line_num + 1))
  [[ $line_num -gt $sample_size ]] && break

  # Check TLA pattern: 2-4 uppercase letters followed by space
  tla_prefix=$(echo "$subj" | grep -oE '^[A-Z]{2,4}' || true)
  if [[ -n "$tla_prefix" ]] && echo "$subj" | grep -qE '^[A-Z]{2,4}[[:space:]]'; then
    tla_count=$((tla_count + 1))
  fi

  # Check conventional commit pattern
  cc_prefix=$(echo "$subj" | grep -oE '^(feat|fix|refactor|test|chore|docs|ci|perf|build|style)' || true)
  if [[ -n "$cc_prefix" ]] && echo "$subj" | grep -qE '^(feat|fix|refactor|test|chore|docs|ci|perf|build|style)(\(.+\))?:'; then
    cc_count=$((cc_count + 1))
  fi
done < "$tmp_subjects"

if [[ $((tla_count * 100 / sample_size)) -ge 60 ]]; then
  CONVENTION="tla"
elif [[ $((cc_count * 100 / sample_size)) -ge 60 ]]; then
  CONVENTION="conventional"
else
  CONVENTION="mixed"
fi

echo "[--] Detected convention: $CONVENTION (TLA=$tla_count CC=$cc_count in $sample_size samples)" >&2

# ---- Categorize commits -----------------------------------------------------
feature=0
fix=0
maintenance=0
test_commits=0
doc=0
other=0

while IFS= read -r subj; do
  if [[ "$CONVENTION" == "tla" ]]; then
    prefix=$(echo "$subj" | grep -oE '^[A-Z]{2,4}' || true)
    case "$prefix" in
      ENH|API)   feature=$((feature + 1)) ;;
      BUG)       fix=$((fix + 1)) ;;
      MAINT|STY|BLD|DEV|REV|DEP) maintenance=$((maintenance + 1)) ;;
      TST)       test_commits=$((test_commits + 1)) ;;
      DOC)       doc=$((doc + 1)) ;;
      DAT|REL|WIP) other=$((other + 1)) ;;
      *)         other=$((other + 1)) ;;
    esac
  elif [[ "$CONVENTION" == "conventional" ]]; then
    prefix=$(echo "$subj" | grep -oE '^(feat|fix|refactor|test|chore|docs|ci|perf|build|style)' || true)
    case "$prefix" in
      feat)            feature=$((feature + 1)) ;;
      fix)             fix=$((fix + 1)) ;;
      refactor|chore|ci|perf|build|style) maintenance=$((maintenance + 1)) ;;
      test)            test_commits=$((test_commits + 1)) ;;
      docs)            doc=$((doc + 1)) ;;
      *)               other=$((other + 1)) ;;
    esac
  else
    subj_lower=$(echo "$subj" | tr '[:upper:]' '[:lower:]')
    case "$subj_lower" in
      *fix*|*bug*)       fix=$((fix + 1)) ;;
      *add*|*feat*|*enh*|*implement*) feature=$((feature + 1)) ;;
      *test*)            test_commits=$((test_commits + 1)) ;;
      *doc*|*readme*)    doc=$((doc + 1)) ;;
      *refactor*|*clean*|*maint*|*rename*) maintenance=$((maintenance + 1)) ;;
      *)                 other=$((other + 1)) ;;
    esac
  fi
done < "$tmp_subjects"

# ---- Delivery ratio ----------------------------------------------------------
denom=$((feature + fix))
if [[ $denom -gt 0 ]]; then
  delivery_ratio=$(awk "BEGIN {printf \"%.2f\", $feature / $denom}")
else
  delivery_ratio="null"
fi

# ---- PRD completion check ----------------------------------------------------
prd_json="[]"
if [[ -d "docs/prds" ]]; then
  prd_entries=""
  for prd_file in docs/prds/prd-*.md; do
    [[ -f "$prd_file" ]] || continue
    prd_id=$(basename "$prd_file" .md)
    prd_status=$(grep -m1 '^status:' "$prd_file" 2>/dev/null | sed 's/^status:[[:space:]]*//' || echo "unknown")
    prd_entries="${prd_entries}{\"id\":\"$(json_escape "$prd_id")\",\"status\":\"$(json_escape "$prd_status")\"},"
  done
  if [[ -n "$prd_entries" ]]; then
    prd_json="[${prd_entries%,}]"
  fi
fi

# ---- Findings ----------------------------------------------------------------
findings="[]"
finding_items=""

if [[ $denom -gt 0 ]]; then
  ratio_pct=$(awk "BEGIN {printf \"%.0f\", $feature * 100 / $denom}")
  if [[ $ratio_pct -lt 30 ]]; then
    finding_items="${finding_items}\"Delivery ratio is ${ratio_pct}% — mostly fixing, little forward progress\","
  elif [[ $ratio_pct -gt 80 ]]; then
    finding_items="${finding_items}\"Delivery ratio is ${ratio_pct}% — strong forward momentum, ensure bug debt isn't accumulating\","
  fi
fi

if [[ $((other * 100 / TOTAL)) -gt 40 ]]; then
  finding_items="${finding_items}\"${other} of ${TOTAL} commits ($(( other * 100 / TOTAL ))%) lack a recognized prefix — consider standardizing commit messages\","
fi

if [[ -n "$finding_items" ]]; then
  findings="[${finding_items%,}]"
fi

# ---- Output JSON -------------------------------------------------------------
cat <<EOJSON
{
  "analyzer": "delivery",
  "schema_version": 1,
  "skipped": false,
  "metrics": {
    "total_commits": $TOTAL,
    "feature_commits": $feature,
    "fix_commits": $fix,
    "maintenance_commits": $maintenance,
    "test_commits": $test_commits,
    "doc_commits": $doc,
    "other_commits": $other,
    "delivery_ratio": $delivery_ratio,
    "convention_detected": "$CONVENTION"
  },
  "prd_completion": $prd_json,
  "findings": $findings
}
EOJSON

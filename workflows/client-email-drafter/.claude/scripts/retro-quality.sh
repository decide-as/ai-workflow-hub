#!/usr/bin/env bash
#
# Retro analyzer: Quality
#
# Checks test coverage (if coverage.json exists), lint issues
# (if ruff is available), and test-to-code change ratio.
#
# Usage:
#   bash retro-quality.sh --since 2026-03-01 --until 2026-03-17
#
# Output: JSON to stdout. Info/errors to stderr.
# Compatible with bash 3.2+ (macOS default).

set -euo pipefail

# ---- Activate local venv if present ------------------------------------------
if [[ -d ".venv/bin" ]]; then
  export PATH="$PWD/.venv/bin:$PATH"
elif _git_root=$(git rev-parse --show-toplevel 2>/dev/null) && [[ -d "$_git_root/.venv/bin" ]]; then
  export PATH="$_git_root/.venv/bin:$PATH"
elif [[ -n "${VIRTUAL_ENV:-}" ]] && [[ -x "${VIRTUAL_ENV}/bin/python3" ]]; then
  export PATH="$VIRTUAL_ENV/bin:$PATH"
fi

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

echo "[--] Analyzing quality from $SINCE to $UNTIL" >&2

# ---- Check for commits in window ---------------------------------------------
commit_count=$(git log --oneline --since="$SINCE" --until="$UNTIL" --no-merges 2>/dev/null | wc -l | tr -d ' ')

if [[ "$commit_count" -eq 0 ]]; then
  cat <<'EOJSON'
{"analyzer":"quality","schema_version":1,"skipped":true,"reason":"No commits in window","metrics":{},"findings":[]}
EOJSON
  exit 0
fi

# ---- Coverage (from coverage.json if it exists) ------------------------------
coverage_current="null"
coverage_delta="null"

if [[ -f "coverage.json" ]]; then
  echo "[--] Found coverage.json" >&2
  coverage_current=$(python3 -c "
import json, sys
try:
    with open('coverage.json') as f:
        data = json.load(f)
    total = data.get('totals', {}).get('percent_covered', None)
    if total is not None:
        print(f'{total:.1f}')
    else:
        print('null')
except Exception:
    print('null')
" 2>/dev/null || echo "null")
else
  echo "[--] No coverage.json found — skipping coverage metrics" >&2
fi

# ---- Lint issues (ruff if available) -----------------------------------------
lint_current="null"

if command -v ruff &>/dev/null; then
  echo "[--] Running ruff check" >&2
  lint_output=$(ruff check . --statistics 2>/dev/null || true)
  if [[ -n "$lint_output" ]]; then
    lint_current=$(echo "$lint_output" | tail -1 | grep -oE '^[0-9]+' || echo "0")
  else
    lint_current="0"
  fi
  if [[ -z "$lint_current" ]]; then
    lint_current="0"
  fi
else
  echo "[--] ruff not available — skipping lint metrics" >&2
fi

# ---- Test-to-code ratio (git-based, always available) ------------------------
test_lines=0
code_lines=0

while IFS= read -r line; do
  [[ -z "$line" ]] && continue
  added=$(echo "$line" | awk '{print $1}')
  file=$(echo "$line" | awk '{print $3}')
  [[ -z "$file" ]] && continue
  [[ "$added" == "-" ]] && continue
  lines=$((added + 0))
  case "$file" in
    tests/*|test/*) test_lines=$((test_lines + lines)) ;;
    src/*|lib/*|app/*) code_lines=$((code_lines + lines)) ;;
  esac
done < <(
  git log --numstat --format="" --since="$SINCE" --until="$UNTIL" --no-merges 2>/dev/null || true
)

if [[ $code_lines -gt 0 ]]; then
  test_to_code=$(awk "BEGIN {printf \"%.2f\", $test_lines / $code_lines}")
else
  test_to_code="null"
fi

# ---- Findings ----------------------------------------------------------------
finding_items=""

if [[ "$coverage_current" != "null" ]]; then
  cov_int=$(echo "$coverage_current" | cut -d. -f1)
  if [[ $cov_int -lt 60 ]]; then
    finding_items="${finding_items}\"Test coverage is ${coverage_current}% — below the 60% basic gate\","
  elif [[ $cov_int -ge 80 ]]; then
    finding_items="${finding_items}\"Test coverage is ${coverage_current}% — strong\","
  fi
fi

if [[ "$lint_current" != "null" && "$lint_current" != "0" ]]; then
  if [[ $lint_current -gt 20 ]]; then
    finding_items="${finding_items}\"${lint_current} lint issues detected — consider a cleanup pass\","
  fi
fi

if [[ "$test_to_code" != "null" ]]; then
  low_ratio=$(awk "BEGIN {print ($test_to_code < 0.3) ? 1 : 0}")
  if [[ "$low_ratio" == "1" && $code_lines -gt 50 ]]; then
    finding_items="${finding_items}\"Test-to-code ratio is ${test_to_code} — less than 0.3 lines of test per line of code changed\","
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
  "analyzer": "quality",
  "schema_version": 1,
  "skipped": false,
  "metrics": {
    "coverage_current": $coverage_current,
    "coverage_delta": $coverage_delta,
    "lint_issues_current": $lint_current,
    "test_lines_changed": $test_lines,
    "code_lines_changed": $code_lines,
    "test_to_code_ratio": ${test_to_code}
  },
  "findings": $findings
}
EOJSON

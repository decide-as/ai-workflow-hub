#!/usr/bin/env bash
#
# Check test coverage for source files changed in this PR branch.
#
# Runs the full test suite with coverage, then extracts per-file results
# for changed files only.  Fails if any changed file falls below the
# minimum coverage threshold.
#
# Usage:
#   bash .claude/scripts/check-pr-coverage.sh [OPTIONS]
#
# Options:
#   --min-coverage N       Minimum coverage percentage for changed files (default: 65)
#   --target BRANCH        Target branch to diff against (default: master)
#   --reuse-coverage SHA   Reuse existing coverage.json if HEAD matches SHA.
#                          Falls back to full pytest run if SHA differs or
#                          coverage.json is missing/corrupt.

set -euo pipefail

# ---- Activate local venv if present ------------------------------------------
if [[ -d ".venv/bin" ]]; then
  export PATH="$PWD/.venv/bin:$PATH"
elif _git_root=$(git rev-parse --show-toplevel 2>/dev/null) && [[ -d "$_git_root/.venv/bin" ]]; then
  export PATH="$_git_root/.venv/bin:$PATH"
elif [[ -n "${VIRTUAL_ENV:-}" ]] && [[ -x "${VIRTUAL_ENV}/bin/python3" ]]; then
  export PATH="$VIRTUAL_ENV/bin:$PATH"
fi

# Derive package slug from project-meta.yaml or src/ layout
if [ -f project-meta.yaml ] && command -v python3 &>/dev/null; then
    PKG_SLUG=$(python3 -c "import yaml; print(yaml.safe_load(open('project-meta.yaml'))['project_slug'])" 2>/dev/null || true)
fi
if [ -z "${PKG_SLUG:-}" ]; then
    PKG_SLUG=$(ls -d src/*/ 2>/dev/null | grep -v '\.egg-info/' | head -1 | sed 's|src/||;s|/||')
fi
if [ -z "${PKG_SLUG:-}" ]; then
    echo "[!!] Cannot determine package slug. Set project_slug in project-meta.yaml." >&2
    exit 1
fi

# ---- Defaults ----------------------------------------------------------------
MIN_COVERAGE=65
TARGET_BRANCH="master"
REUSE_SHA=""

# ---- Parse arguments ---------------------------------------------------------
while [[ $# -gt 0 ]]; do
  case "$1" in
    --min-coverage)    MIN_COVERAGE="$2"; shift 2 ;;
    --target)          TARGET_BRANCH="$2"; shift 2 ;;
    --reuse-coverage)  REUSE_SHA="$2"; shift 2 ;;
    *)                 echo "[!!] Unknown argument: $1" >&2; exit 1 ;;
  esac
done

# ---- Ensure we are inside a Git repository -----------------------------------
if ! GIT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null); then
  echo "[!!] Not inside a Git repository." >&2
  exit 1
fi
cd "$GIT_ROOT"

# ---- Identify changed Python source files -----------------------------------
MERGE_BASE=$(git merge-base HEAD "origin/$TARGET_BRANCH" 2>/dev/null) || {
  echo "[!!] Could not find merge base with origin/$TARGET_BRANCH." >&2
  echo "[--] Fetch the target branch first: git fetch origin $TARGET_BRANCH" >&2
  exit 1
}

# Added, Copied, Modified, Renamed — exclude Deleted.  Exclude tests/, scripts/, and docs/ directories.
CHANGED_FILES=$(git diff --name-only --diff-filter=ACMR "$MERGE_BASE" HEAD -- '*.py' \
  | grep -v '^tests/' | grep -v '/scripts/' | grep -v '^scripts/' | grep -v '^docs/' || true)

if [[ -z "$CHANGED_FILES" ]]; then
  echo "[ok] No Python source files changed — coverage gate passes."
  exit 0
fi

echo "[--] Changed source files:"
echo "$CHANGED_FILES" | sed 's/^/     /'
echo ""

# ---- Run test suite with coverage (or reuse cached) -------------------------
REUSED=false

if [[ -n "$REUSE_SHA" ]]; then
  CURRENT_SHA=$(git rev-parse HEAD)
  if [[ "$REUSE_SHA" == "$CURRENT_SHA" ]] && [[ -f "coverage.json" ]]; then
    # Validate coverage.json is parseable before trusting it
    if python3 -c "import json; f=open('coverage.json'); json.load(f); f.close()" 2>/dev/null; then
      echo "[ok] Reusing coverage.json from ci-preflight (HEAD=$CURRENT_SHA matches)"
      REUSED=true
      COV_OUTPUT=""
    else
      echo "[--] coverage.json is corrupt — falling back to full test run"
    fi
  else
    if [[ "$REUSE_SHA" != "$CURRENT_SHA" ]]; then
      echo "[--] HEAD changed since ci-preflight ($REUSE_SHA → $CURRENT_SHA) — running full test suite"
    else
      echo "[--] coverage.json not found — running full test suite"
    fi
  fi
fi

if [[ "$REUSED" == "false" ]]; then
  echo "[--] Running test suite with coverage..."
  COV_OUTPUT=$(python3 -m pytest tests/ --cov=${PKG_SLUG} --cov-report=term-missing --cov-report=json 2>&1) || true

  # Verify we got coverage data
  if ! echo "$COV_OUTPUT" | grep -q '^TOTAL'; then
    echo "[!!] Coverage run produced no TOTAL line.  Test output:" >&2
    echo "$COV_OUTPUT" >&2
    exit 1
  fi
fi

# ---- Check per-file coverage for changed files ------------------------------
FAIL=0
CHECKED=0

echo "[--] Coverage for changed files (minimum: ${MIN_COVERAGE}%):"
echo ""

# Helper: look up coverage percentage for a file.
# Prefers coverage.json (absolute paths — works reliably in worktrees).
# Falls back to parsing terminal output when coverage.json is unavailable.
_lookup_coverage() {
  local file="$1"

  # Prefer coverage.json — its absolute paths match regardless of CWD.
  if [[ -f "coverage.json" ]]; then
    local pct
    pct=$(python3 -c "
import json, sys
with open('coverage.json') as f:
    data = json.load(f)
suffix = '/${file}'
for key, info in data.get('files', {}).items():
    if key.endswith(suffix) or key == '${file}':
        print(info['summary']['percent_covered_display'].split('.')[0])
        sys.exit(0)
sys.exit(1)
" 2>/dev/null) && { echo "$pct"; return 0; }
  fi

  # Fallback: grep the terminal output with progressive suffix stripping.
  # Not available when reusing cached coverage.json.
  [[ -z "$COV_OUTPUT" ]] && return 1
  local cov_line="" search="$file"
  while [[ "$search" == */* ]]; do
    cov_line=$(echo "$COV_OUTPUT" | grep "^${search} " | head -1 || true)
    [[ -n "$cov_line" ]] && break
    search="${search#*/}"
  done
  if [[ -z "$cov_line" ]]; then
    cov_line=$(echo "$COV_OUTPUT" | grep "^${search} " | head -1 || true)
  fi
  [[ -z "$cov_line" ]] && return 1

  local pct
  pct=$(echo "$cov_line" | awk '{for(i=1;i<=NF;i++) if($i ~ /%$/) {gsub(/%/,"",$i); print $i; exit}}')
  [[ -n "$pct" ]] && { echo "$pct"; return 0; }
  return 1
}

while IFS= read -r file; do
  [[ -z "$file" ]] && continue

  pct=$(_lookup_coverage "$file") || {
    echo "  [??] $file — not found in coverage report (no tests cover it)"
    FAIL=1
    continue
  }

  CHECKED=$((CHECKED + 1))

  if (( pct < MIN_COVERAGE )); then
    echo "  [!!] $file — ${pct}% (BELOW ${MIN_COVERAGE}%)"
    FAIL=1
  else
    echo "  [ok] $file — ${pct}%"
  fi
done <<< "$CHANGED_FILES"

echo ""
echo "[--] Checked $CHECKED file(s)."
echo ""

if (( FAIL )); then
  echo "[!!] Coverage gate FAILED — some changed files are below ${MIN_COVERAGE}%."
  echo "[--] Write tests for uncovered code, or re-run with --min-coverage <N> to override."
  exit 1
fi

echo "[ok] All changed files meet the ${MIN_COVERAGE}% coverage threshold."

# ---- Tiered coverage check --------------------------------------------------
# If coverage_tiers module is available and coverage.json was generated, run
# per-module tier enforcement (T1: 90%, T2: 80%, etc.) to match CI.
if [[ -f "coverage.json" ]]; then
  echo ""
  # Derive quality gate from project metadata (explicit or phase-based)
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  GATE=$(bash "$SCRIPT_DIR/read-quality-gate.sh" 2>/dev/null || echo "basic")
  echo "[--] Running tiered coverage check (gate=$GATE)..."
  # Check if the tiered coverage module is available before running
  if ! python3 -c "import code_practices.quality.coverage_tiers" 2>/dev/null; then
    echo "[--] Tiered coverage module not available — skipping tiered check."
  elif python3 -m code_practices.quality.coverage_tiers --check coverage.json --gate "$GATE" 2>/dev/null; then
    echo "[ok] Tiered coverage gate passed."
  else
    echo "[!!] Tiered coverage gate FAILED — a module is below its tier threshold."
    echo "[--] Run: python -m code_practices.quality.coverage_tiers --check coverage.json --gate $GATE"
    exit 1
  fi
fi

exit 0

#!/usr/bin/env bash
#
# Risk Assessment Orchestrator
#
# Runs deterministic risk checks (pytest), tool checks (ruff, bandit, pip-audit),
# and produces a structured sign-off log showing per-dimension PASS/FAIL.
#
# Usage:
#   bash .claude/scripts/check-risk-assessment.sh [OPTIONS]
#
# Options:
#   --phase PHASE              Override phase for tier calculation (e.g., mvp, alpha)
#   --pkg PKG                  Python package directory to scan (default: auto-detect)
#   --trust-tool-checks SHA    Skip tool checks (ruff, mypy, bandit, pip-audit) if
#                              HEAD matches SHA, trusting that ci-preflight already
#                              verified them. Falls back to running all tool checks
#                              if SHA differs (code changed since ci-preflight).

set -uo pipefail

# ---- Defaults ----------------------------------------------------------------
PHASE_OVERRIDE=""
PKG=""
TRUST_SHA=""

# ---- Parse arguments ---------------------------------------------------------
while [[ $# -gt 0 ]]; do
  case "$1" in
    --phase)             PHASE_OVERRIDE="$2"; shift 2 ;;
    --pkg)               PKG="$2"; shift 2 ;;
    --trust-tool-checks) TRUST_SHA="$2"; shift 2 ;;
    *)                   echo "[!!] Unknown argument: $1" >&2; exit 1 ;;
  esac
done

# ---- Ensure we are inside a Git repository -----------------------------------
if ! GIT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null); then
  echo "[!!] Not inside a Git repository." >&2
  exit 1
fi
cd "$GIT_ROOT"

# ---- Activate local venv if present ------------------------------------------
if [[ -d ".venv/bin" ]]; then
  export PATH="$PWD/.venv/bin:$PATH"
elif _git_root=$(git rev-parse --show-toplevel 2>/dev/null) && [[ -d "$_git_root/.venv/bin" ]]; then
  export PATH="$_git_root/.venv/bin:$PATH"
elif [[ -n "${VIRTUAL_ENV:-}" ]] && [[ -x "${VIRTUAL_ENV}/bin/python3" ]]; then
  export PATH="$VIRTUAL_ENV/bin:$PATH"
fi

# ---- Read project metadata ---------------------------------------------------
if [[ ! -f "project-meta.yaml" ]]; then
  echo "[!!] project-meta.yaml not found in project root." >&2
  exit 1
fi

PROJECT_NAME=$(python3 -c "import yaml; print(yaml.safe_load(open('project-meta.yaml'))['name'])" 2>/dev/null || echo "unknown")

VALID_PHASES="discovery poc prototype mvp alpha beta pilot validation production"

if [[ -n "$PHASE_OVERRIDE" ]]; then
  # Validate phase against whitelist
  if ! echo "$VALID_PHASES" | grep -qw "$PHASE_OVERRIDE"; then
    echo "[!!] Invalid phase: $PHASE_OVERRIDE" >&2
    echo "     Valid phases: $VALID_PHASES" >&2
    exit 1
  fi
  PHASE="$PHASE_OVERRIDE"
else
  PHASE=$(python3 -c "import yaml; print(yaml.safe_load(open('project-meta.yaml')).get('phase', 'discovery'))" 2>/dev/null || echo "discovery")
fi

# Map phase to tier (uses Python dict lookup with validated phase)
TIER=$(python3 -c "
import sys
tiers = {'discovery':0,'poc':0,'prototype':1,'mvp':2,'alpha':3,'beta':4,'pilot':4,'validation':5,'production':5}
print(tiers.get(sys.argv[1], 0))
" "$PHASE" 2>/dev/null || echo "0")

# Auto-detect package directory
if [[ -z "$PKG" ]]; then
  if [[ -d "src" ]]; then
    PKG=$(find src -maxdepth 1 -type d ! -name src ! -name __pycache__ ! -name "*.egg-info" | head -1)
  fi
fi

DATE=$(date +%Y-%m-%d)

# ---- Header ------------------------------------------------------------------
cat <<HEADER

═══════════════════════════════════════════════════════
 RISK ASSESSMENT SIGN-OFF LOG
 Project: $PROJECT_NAME
 Phase: $PHASE  |  Tier: $TIER
 Date: $DATE
═══════════════════════════════════════════════════════
HEADER

# ---- Deterministic checks (pytest) ------------------------------------------
echo ""
echo " DETERMINISTIC CHECKS (hard gate)"
echo "─────────────────────────────────────────────────────"

DET_PASS=0
DET_FAIL=0
DET_TOTAL=0

# Run pytest risk assessment tests with verbose output
# Capture exit code separately — do not mask with || true
set +e
RISK_TEST=$(find tests -name test_risk_assessment.py -type f | head -1)
PYTEST_OUTPUT=$(pytest "$RISK_TEST" -v --tb=short 2>&1)
PYTEST_EXIT=$?
set -e

# Parse individual test results
while IFS= read -r line; do
  if echo "$line" | grep -qE "PASSED|FAILED|SKIPPED"; then
    test_name=$(echo "$line" | sed -E 's/.*::([^ ]+).*/\1/')
    if echo "$line" | grep -q "PASSED"; then
      # Extract risk ID from test class name if possible
      risk_desc=$(echo "$test_name" | sed 's/test_//' | tr '_' ' ')
      echo " [PASS] $risk_desc"
      DET_PASS=$((DET_PASS + 1))
      DET_TOTAL=$((DET_TOTAL + 1))
    elif echo "$line" | grep -q "FAILED"; then
      risk_desc=$(echo "$test_name" | sed 's/test_//' | tr '_' ' ')
      echo " [FAIL] $risk_desc"
      DET_FAIL=$((DET_FAIL + 1))
      DET_TOTAL=$((DET_TOTAL + 1))
    elif echo "$line" | grep -q "SKIPPED"; then
      risk_desc=$(echo "$test_name" | sed 's/test_//' | tr '_' ' ')
      echo " [SKIP] $risk_desc (tier < required)"
    fi
  fi
done <<< "$PYTEST_OUTPUT"

# If no tests were parsed, show raw output and treat as failure
if [[ $DET_TOTAL -eq 0 ]]; then
  echo " [??] Could not parse pytest output (exit code: $PYTEST_EXIT)"
  echo "$PYTEST_OUTPUT" | tail -5
  if [[ $PYTEST_EXIT -ne 0 ]]; then
    DET_FAIL=$((DET_FAIL + 1))
  fi
fi

# If pytest reported failures that were not captured in individual parsing, count them
if [[ $PYTEST_EXIT -ne 0 && $DET_FAIL -eq 0 ]]; then
  DET_FAIL=$((DET_FAIL + 1))
fi

# ---- Tool checks -------------------------------------------------------------
echo ""
echo " TOOL CHECKS"
echo "─────────────────────────────────────────────────────"

TOOL_PASS=0
TOOL_FAIL=0
TOOLS_TRUSTED=false

# Check if we can trust ci-preflight results (SHA-based verification)
if [[ -n "$TRUST_SHA" ]]; then
  CURRENT_SHA=$(git rev-parse HEAD)
  if [[ "$TRUST_SHA" == "$CURRENT_SHA" ]]; then
    echo " [ok] Trusting ci-preflight tool checks (HEAD=$CURRENT_SHA matches)"
    echo " [PASS] Ruff lint (verified by ci-preflight)"
    echo " [PASS] Ruff format (verified by ci-preflight)"
    TOOL_PASS=2
    if [[ $TIER -ge 2 ]]; then
      echo " [PASS] Mypy type check (verified by ci-preflight)"
      TOOL_PASS=$((TOOL_PASS + 1))
    else
      echo " [SKIP] Mypy (tier < 2)"
    fi
    if [[ $TIER -ge 4 ]]; then
      echo " [PASS] Bandit security scan (verified by ci-preflight)"
      echo " [PASS] pip-audit dependency scan (verified by ci-preflight)"
      TOOL_PASS=$((TOOL_PASS + 2))
    else
      echo " [SKIP] Bandit (tier < 4)"
      echo " [SKIP] pip-audit (tier < 4)"
    fi
    TOOLS_TRUSTED=true
  else
    echo " [--] HEAD changed since ci-preflight ($TRUST_SHA → $CURRENT_SHA) — running tool checks"
  fi
fi

if [[ "$TOOLS_TRUSTED" == "false" ]]; then
  # Ruff lint (always run if available — checks entire repo to match CI)
  if command -v ruff &>/dev/null; then
    if ruff check . --quiet 2>/dev/null; then
      echo " [PASS] Ruff lint"
      TOOL_PASS=$((TOOL_PASS + 1))
    else
      echo " [FAIL] Ruff lint"
      TOOL_FAIL=$((TOOL_FAIL + 1))
    fi
  else
    echo " [SKIP] Ruff lint (not installed)"
  fi

  # Ruff format (always run if available — checks entire repo to match CI)
  if command -v ruff &>/dev/null; then
    if ruff format --check . --quiet 2>/dev/null; then
      echo " [PASS] Ruff format"
      TOOL_PASS=$((TOOL_PASS + 1))
    else
      echo " [FAIL] Ruff format"
      TOOL_FAIL=$((TOOL_FAIL + 1))
    fi
  else
    echo " [SKIP] Ruff format (not installed)"
  fi

  # Mypy (tier >= 2, Python only)
  if [[ $TIER -ge 2 ]]; then
    if command -v mypy &>/dev/null && [[ -n "$PKG" ]]; then
      MYPY_ARGS="$PKG"
      if [[ $TIER -ge 4 ]]; then
        MYPY_ARGS="$PKG --strict"
      fi
      if mypy $MYPY_ARGS --no-error-summary 2>/dev/null; then
        echo " [PASS] Mypy type check"
        TOOL_PASS=$((TOOL_PASS + 1))
      else
        echo " [FAIL] Mypy type check"
        TOOL_FAIL=$((TOOL_FAIL + 1))
      fi
    else
      echo " [SKIP] Mypy (not installed or no package dir)"
    fi
  else
    echo " [SKIP] Mypy (tier < 2)"
  fi

  # Bandit (tier >= 4 only)
  if [[ $TIER -ge 4 ]]; then
    if command -v bandit &>/dev/null && [[ -n "$PKG" ]]; then
      BANDIT_ARGS=(-r "$PKG" -q)
      [[ -f pyproject.toml ]] && BANDIT_ARGS+=(-c pyproject.toml)
      if bandit "${BANDIT_ARGS[@]}" 2>/dev/null; then
        echo " [PASS] Bandit security scan"
        TOOL_PASS=$((TOOL_PASS + 1))
      else
        echo " [FAIL] Bandit security scan"
        TOOL_FAIL=$((TOOL_FAIL + 1))
      fi
    else
      echo " [SKIP] Bandit (not installed or no package dir)"
    fi
  else
    echo " [SKIP] Bandit (tier < 4)"
  fi

  # pip-audit (tier >= 4 only)
  if [[ $TIER -ge 4 ]]; then
    if command -v pip-audit &>/dev/null; then
      PIPAUDIT_ARGS=()
      if [[ -f .pip-audit-known-vulnerabilities ]]; then
        while IFS= read -r cve; do
          [[ -n "$cve" && "$cve" != \#* ]] && PIPAUDIT_ARGS+=(--ignore-vuln "$cve")
        done < .pip-audit-known-vulnerabilities
      fi
      if pip-audit "${PIPAUDIT_ARGS[@]}" >/dev/null 2>&1; then
        echo " [PASS] pip-audit dependency scan"
        TOOL_PASS=$((TOOL_PASS + 1))
      else
        echo " [FAIL] pip-audit dependency scan"
        TOOL_FAIL=$((TOOL_FAIL + 1))
      fi
    else
      echo " [SKIP] pip-audit (not installed)"
    fi
  else
    echo " [SKIP] pip-audit (tier < 4)"
  fi
fi

# ---- Summary -----------------------------------------------------------------
echo ""
echo " SUMMARY"
echo "─────────────────────────────────────────────────────"
echo " Deterministic: $DET_PASS/$DET_TOTAL PASS, $DET_FAIL FAIL"
echo " Tools: $TOOL_PASS PASS, $TOOL_FAIL FAIL"

TOTAL_FAIL=$((DET_FAIL + TOOL_FAIL))

if [[ $TOTAL_FAIL -gt 0 ]]; then
  echo " Overall: FAIL ($TOTAL_FAIL blocking issue(s))"
else
  echo " Overall: PASS"
fi

# ---- Filtered risk checklist -------------------------------------------------
echo ""
echo " APPLICABLE RISKS (filtered by project metadata)"
echo "─────────────────────────────────────────────────────"

# Generate filtered risk list using the applicability registry.
# Uses the full code_practices module when available.
# Falls back to the standalone filter-risks.py script if the module is unavailable.
FILTER_OUTPUT=$(python3 -c "
import sys, yaml
sys.path.insert(0, 'src')
from code_practices.quality.risk_checks import PHASE_TO_TIER
from code_practices.quality.risk_filter import load_applicability_registry, filter_applicable_risks, summarize_filter
meta = yaml.safe_load(open('project-meta.yaml'))
registry = load_applicability_registry()
phase = sys.argv[1]
tier = PHASE_TO_TIER.get(phase, 0)
applicable = filter_applicable_risks(registry, meta, tier=tier)
print(summarize_filter(applicable, len(registry), tier, phase))
" "$PHASE" 2>&1) || FILTER_OUTPUT=$(python3 "$(dirname "$0")/filter-risks.py" "$PHASE" 2>&1) || true

if [[ -n "$FILTER_OUTPUT" ]]; then
  echo "$FILTER_OUTPUT"
else
  echo " [!!] Could not generate filtered risk list."
  echo "      Falling back to full evaluation."
  echo "      Read docs/risk/risk-matrix.md and docs/risk/ai-risk-controls.md"
fi

echo ""
echo " Evaluate ONLY the risks listed above during semantic review."
echo " See .claude/rules/risk-assessment.md for the evaluation process."
echo ""
echo "═══════════════════════════════════════════════════════"

# ---- Exit code ---------------------------------------------------------------
if [[ $TOTAL_FAIL -gt 0 ]]; then
  exit 1
else
  exit 0
fi

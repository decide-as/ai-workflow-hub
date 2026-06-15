#!/usr/bin/env bash
#
# Run pytest-cov and update the coverage badge in README.md
# with the actual measured percentage.

set -euo pipefail

# ---- Activate local venv if present ------------------------------------------
if [[ -d ".venv/bin" ]]; then
  export PATH="$PWD/.venv/bin:$PATH"
elif _git_root=$(git rev-parse --show-toplevel 2>/dev/null) && [[ -d "$_git_root/.venv/bin" ]]; then
  export PATH="$_git_root/.venv/bin:$PATH"
elif [[ -n "${VIRTUAL_ENV:-}" ]] && [[ -x "${VIRTUAL_ENV}/bin/python3" ]]; then
  export PATH="$VIRTUAL_ENV/bin:$PATH"
fi

# --- Ensure we're inside a Git repository ---------------------------------
if ! GIT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null); then
  echo "[!!] Not inside a Git repository." >&2
  exit 1
fi
cd "$GIT_ROOT"

README="README.md"
if [[ ! -f "$README" ]]; then
  echo "[!!] No README.md found at project root." >&2
  exit 1
fi

# --- Detect the source package for --cov targeting -------------------------
COV_TARGET=""
if [[ -f "pyproject.toml" ]]; then
  PKG=$(python3 -c "
import tomllib, pathlib, sys
data = tomllib.loads(pathlib.Path('pyproject.toml').read_text())
# Prefer explicit coverage source config (most accurate)
src = data.get('tool',{}).get('coverage',{}).get('run',{}).get('source',[''])
if src and src[0]: print(src[0]); sys.exit()
# Fallback to project name
name = data.get('project',{}).get('name','')
if name: print(name.replace('-','_')); sys.exit()
" 2>/dev/null || true)
  if [[ -n "$PKG" ]]; then
    COV_TARGET="--cov=$PKG"
  fi
fi
# Fallback: look for src/<package>/ directory
if [[ -z "$COV_TARGET" ]] && [[ -d "src" ]]; then
  for d in src/*/; do
    if [[ -f "${d}__init__.py" ]]; then
      PKG=$(basename "$d")
      COV_TARGET="--cov=$PKG"
      break
    fi
  done
fi

# --- Run pytest-cov and read coverage from coverage.json ------------------
echo "[--] Running coverage..."
pytest tests/ $COV_TARGET --cov-report=json --cov-report=term-missing 2>&1 || true

# Read coverage percentage from coverage.json (single source of truth, one-decimal precision)
if [[ -f "coverage.json" ]]; then
  COVERAGE=$(python3 -c "
import json, pathlib
data = json.loads(pathlib.Path('coverage.json').read_text())
print(f\"{data['totals']['percent_covered']:.1f}\")
" 2>/dev/null || true)
fi

if [[ -z "${COVERAGE:-}" ]]; then
  echo "[!!] Could not read coverage from coverage.json." >&2
  echo "     Ensure pytest-cov is installed and tests ran successfully." >&2
  exit 1
fi

# --- Cross-platform sed in-place helper -------------------------------------
sedi() {
  if [[ "$(uname)" == "Darwin" ]]; then
    sed -i '' "$@"
  else
    sed -i "$@"
  fi
}

# --- Read badge color from project-meta.yaml ----------------------------------
BADGE_COLOR="d4bc9a"
META="project-meta.yaml"
if [[ -f "$META" ]]; then
  META_COLOR=$(python3 -c "
import yaml
with open('$META') as f:
    m = yaml.safe_load(f)
print(m.get('badge_color', '') or '')
" 2>/dev/null || true)
  if [[ -n "$META_COLOR" ]]; then
    BADGE_COLOR="$META_COLOR"
  fi
fi

# --- Cross-platform sed extended regex helper --------------------------------
sedi_ext() {
  if [[ "$(uname)" == "Darwin" ]]; then
    sed -i '' -E "$@"
  else
    sed -i -E "$@"
  fi
}

# --- Update the coverage badge in README.md -----------------------------------
if grep -qE 'coverage-[0-9]+(\.[0-9]+)?%25-[a-fA-F0-9]{6}' "$README"; then
  sedi_ext "s/coverage-[0-9]+(\.[0-9]+)?%25-[a-fA-F0-9]{6}/coverage-${COVERAGE}%25-${BADGE_COLOR}/g" "$README"
  echo "[ok] Coverage badge updated to ${COVERAGE}%."
else
  echo "[--] No coverage badge found in README.md — skipping."
fi

# --- Compute and update the TQS badge in README.md ---------------------------
TQS_VALUE=""
if [[ -d "tests/.analytics" ]]; then
  TQS_VALUE=$(python3 -c "
import json, pathlib, sys
analytics_dir = pathlib.Path('tests/.analytics')
records = []
for sidecar in sorted(analytics_dir.rglob('*.json')):
    try:
        data = json.loads(sidecar.read_text())
        records.extend(v for v in data.values() if isinstance(v, dict))
    except Exception:
        pass
if not records:
    sys.exit(0)
tqs = sum(r['total_score'] / 32.0 for r in records) / len(records)
print(f'{tqs * 100:.1f}')
" 2>/dev/null || true)
fi

if [[ -n "$TQS_VALUE" ]]; then
  if grep -qE 'test_quality-[0-9]+(\.[0-9]+)?%25-[a-fA-F0-9]{6}' "$README"; then
    sedi_ext "s/test_quality-[0-9]+(\.[0-9]+)?%25-[a-fA-F0-9]{6}/test_quality-${TQS_VALUE}%25-${BADGE_COLOR}/g" "$README"
    echo "[ok] Test quality badge updated to ${TQS_VALUE}%."
  else
    echo "[--] No TQS badge found in README.md — skipping."
  fi
else
  echo "[--] No TQS analytics data found — skipping TQS badge update."
fi

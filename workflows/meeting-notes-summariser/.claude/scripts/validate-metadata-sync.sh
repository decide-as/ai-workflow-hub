#!/usr/bin/env bash
#
# Compare project-meta.yaml against pyproject.toml and README.md
# to catch metadata drift. Exit 0 if all checks pass, 1 otherwise.

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

META="project-meta.yaml"
PYPROJECT="pyproject.toml"
README="README.md"

if [[ ! -f "$META" ]]; then
  echo "[!!] No project-meta.yaml found at project root." >&2
  exit 1
fi

ERRORS=0

# --- Detect if this is a feature branch with deferred versioning -------------
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
SKIP_VERSION_CHECK=false

if [[ "$CURRENT_BRANCH" != "master" && "$CURRENT_BRANCH" != "main" ]]; then
  if [[ -d "changelog.d" ]]; then
    FRAGMENT_COUNT=$(find changelog.d -maxdepth 1 -name '*.md' ! -name 'README.md' 2>/dev/null | wc -l | tr -d ' ')
    if [[ "$FRAGMENT_COUNT" -gt 0 ]]; then
      SKIP_VERSION_CHECK=true
      echo "[--] Feature branch with changelog fragments — skipping version checks"
    fi
  fi
fi

# --- Helper: extract a YAML value (simple single-line fields only) --------
meta_val() {
  python3 -c "
import yaml, sys
with open('$META') as f:
    m = yaml.safe_load(f)
keys = '$1'.split('.')
v = m
for k in keys:
    if isinstance(v, dict):
        v = v.get(k, '')
    else:
        v = ''
        break
print(v if v else '')
"
}

# --- Helper: extract a TOML value from pyproject.toml ---------------------
pyproject_val() {
  python3 -c "
import sys
try:
    import tomllib
except ImportError:
    import tomli as tomllib
with open('$PYPROJECT', 'rb') as f:
    d = tomllib.load(f)
keys = '$1'.split('.')
v = d
for k in keys:
    if isinstance(v, dict):
        v = v.get(k, '')
    else:
        v = ''
        break
# Handle PEP 639 license table: {text: 'MIT'} -> 'MIT'
if isinstance(v, dict) and 'text' in v:
    v = v['text']
print(v if v else '')
"
}

# --- Check: version -------------------------------------------------------
if [[ -f "$PYPROJECT" ]]; then
  META_VERSION=$(meta_val "version")
  PYPROJECT_VERSION=$(pyproject_val "project.version")

  if [[ "$SKIP_VERSION_CHECK" == true ]]; then
    echo "[--] Skipping version sync check (deferred versioning)"
  elif [[ -n "$META_VERSION" && -n "$PYPROJECT_VERSION" ]]; then
    if [[ "$META_VERSION" != "$PYPROJECT_VERSION" ]]; then
      echo "[!!] Version mismatch: project-meta.yaml=$META_VERSION, pyproject.toml=$PYPROJECT_VERSION"
      ERRORS=$((ERRORS + 1))
    else
      echo "[ok] Version in sync: $META_VERSION"
    fi
  fi

  # --- Check: license -----------------------------------------------------
  META_LICENSE=$(meta_val "license")
  PYPROJECT_LICENSE=$(pyproject_val "project.license")

  if [[ -n "$META_LICENSE" && -n "$PYPROJECT_LICENSE" ]]; then
    if [[ "$META_LICENSE" != "$PYPROJECT_LICENSE" ]]; then
      echo "[!!] License mismatch: project-meta.yaml=$META_LICENSE, pyproject.toml=$PYPROJECT_LICENSE"
      ERRORS=$((ERRORS + 1))
    else
      echo "[ok] License in sync: $META_LICENSE"
    fi
  fi

  # --- Check: Python version ----------------------------------------------
  META_PYVER=$(meta_val "language_version")
  PYPROJECT_PYVER=$(pyproject_val "project.requires-python")

  if [[ -n "$META_PYVER" && -n "$PYPROJECT_PYVER" ]]; then
    if [[ "$META_PYVER" != "$PYPROJECT_PYVER" ]]; then
      echo "[!!] Python version mismatch: project-meta.yaml=$META_PYVER, pyproject.toml=$PYPROJECT_PYVER"
      ERRORS=$((ERRORS + 1))
    else
      echo "[ok] Python version in sync: $META_PYVER"
    fi
  fi
fi

# --- Check: README badges -------------------------------------------------
if [[ -f "$README" ]]; then
  BADGE_COLOR=$(meta_val "badge_color")
  BADGE_COLOR="${BADGE_COLOR:-d4bc9a}"

  if [[ "$SKIP_VERSION_CHECK" == true ]]; then
    echo "[--] Skipping README version badge check (deferred versioning)"
  else
    META_VERSION=$(meta_val "version")
    if [[ -n "$META_VERSION" ]] && ! grep -q "version-${META_VERSION}-${BADGE_COLOR}" "$README"; then
      echo "[!!] README version badge does not match project-meta.yaml version ($META_VERSION)"
      ERRORS=$((ERRORS + 1))
    else
      echo "[ok] README version badge matches"
    fi
  fi

  META_PHASE=$(meta_val "phase")
  if [[ -n "$META_PHASE" ]] && ! grep -q "phase-${META_PHASE}-${BADGE_COLOR}" "$README"; then
    echo "[!!] README phase badge does not match project-meta.yaml phase ($META_PHASE)"
    ERRORS=$((ERRORS + 1))
  else
    echo "[ok] README phase badge matches"
  fi

  META_STAGE=$(meta_val "stage")
  if [[ -n "$META_STAGE" ]] && grep -qE "stage-.+-[a-fA-F0-9]{6}" "$README"; then
    if ! grep -q "stage-${META_STAGE}-${BADGE_COLOR}" "$README"; then
      echo "[!!] README stage badge does not match project-meta.yaml stage ($META_STAGE)"
      ERRORS=$((ERRORS + 1))
    else
      echo "[ok] README stage badge matches"
    fi
  fi

  META_CATEGORY=$(meta_val "category")
  if [[ -n "$META_CATEGORY" ]] && grep -qE "category-.+-[a-fA-F0-9]{6}" "$README"; then
    if ! grep -q "category-${META_CATEGORY}-${BADGE_COLOR}" "$README"; then
      echo "[!!] README category badge does not match project-meta.yaml category ($META_CATEGORY)"
      ERRORS=$((ERRORS + 1))
    else
      echo "[ok] README category badge matches"
    fi
  fi

  META_LICENSE=$(meta_val "license")
  if [[ -n "$META_LICENSE" ]] && grep -qE "license-.+-[a-fA-F0-9]{6}" "$README"; then
    if [[ "$META_LICENSE" == "All Rights Reserved" ]]; then
      LICENSE_BADGE="proprietary"
    else
      LICENSE_BADGE="${META_LICENSE// /%20}"
    fi
    if ! grep -q "license-${LICENSE_BADGE}-${BADGE_COLOR}" "$README"; then
      echo "[!!] README license badge does not match project-meta.yaml license ($META_LICENSE)"
      ERRORS=$((ERRORS + 1))
    else
      echo "[ok] README license badge matches"
    fi
  fi

  META_LANGUAGE=$(meta_val "language")
  META_LANGVER=$(meta_val "language_version")
  if [[ "$META_LANGUAGE" == "python" && -n "$META_LANGVER" ]] && grep -q 'python-[0-9]' "$README"; then
    LANGVER_LABEL=$(echo "$META_LANGVER" | sed 's/^>=//;s/^>//')
    if ! grep -q "python-${LANGVER_LABEL}+-${BADGE_COLOR}" "$README"; then
      echo "[!!] README Python version badge does not match project-meta.yaml language_version ($META_LANGVER)"
      ERRORS=$((ERRORS + 1))
    else
      echo "[ok] README Python version badge matches"
    fi
  fi

  META_GATE=$(meta_val "quality_gate")
  if [[ -n "$META_GATE" && "$META_GATE" != "none" ]] && grep -qE "quality_gate-.+-[a-fA-F0-9]{6}" "$README"; then
    if ! grep -q "quality_gate-${META_GATE}-" "$README"; then
      echo "[!!] README quality gate badge does not match project-meta.yaml quality_gate ($META_GATE)"
      ERRORS=$((ERRORS + 1))
    else
      echo "[ok] README quality gate badge matches"
    fi
  fi
fi

# --- Result ---------------------------------------------------------------
if [[ "$ERRORS" -gt 0 ]]; then
  echo ""
  echo "[!!] $ERRORS metadata sync issue(s) found."
  exit 1
else
  echo ""
  echo "[ok] All metadata in sync."
  exit 0
fi

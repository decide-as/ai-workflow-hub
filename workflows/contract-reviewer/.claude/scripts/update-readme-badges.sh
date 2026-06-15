#!/usr/bin/env bash
#
# Update all metadata-derived badges in README.md from project-meta.yaml.
# Coverage badge is NOT touched — use update-coverage-badge.sh for that.

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
README="README.md"

if [[ ! -f "$META" ]]; then
  echo "[!!] No project-meta.yaml found at project root." >&2
  exit 1
fi

if [[ ! -f "$README" ]]; then
  echo "[!!] No README.md found at project root." >&2
  exit 1
fi

# --- Read metadata values ---------------------------------------------------
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

VERSION=$(meta_val "version")
STAGE=$(meta_val "stage")
PHASE=$(meta_val "phase")
LICENSE=$(meta_val "license")
CATEGORY=$(meta_val "category")
LANGUAGE=$(meta_val "language")
LANGUAGE_VERSION=$(meta_val "language_version")
QUALITY_GATE=$(meta_val "quality_gate")
BADGE_COLOR=$(meta_val "badge_color")
BADGE_LABEL_COLOR=$(meta_val "badge_label_color")
BADGE_COLOR="${BADGE_COLOR:-d4bc9a}"
BADGE_LABEL_COLOR="${BADGE_LABEL_COLOR:-2a2a2a}"

# Hex pattern to match any existing badge color
HEX="[a-fA-F0-9]\{6\}"
HEX_EXT="[a-fA-F0-9]{6}"

# --- Cross-platform sed in-place helper -------------------------------------
sedi() {
  if [[ "$(uname)" == "Darwin" ]]; then
    sed -i '' "$@"
  else
    sed -i "$@"
  fi
}

sedi_ext() {
  if [[ "$(uname)" == "Darwin" ]]; then
    sed -i '' -E "$@"
  else
    sed -i -E "$@"
  fi
}

CHANGES=0

# --- Update version badge ---------------------------------------------------
if [[ -n "$VERSION" ]] && grep -qE "version-.+-${HEX_EXT}" "$README"; then
  sedi_ext "s/version-[^-]*-${HEX_EXT}/version-${VERSION}-${BADGE_COLOR}/g" "$README"
  echo "[ok] Version badge → $VERSION"
  CHANGES=$((CHANGES + 1))
fi

# --- Update stage badge -----------------------------------------------------
if [[ -n "$STAGE" ]] && grep -qE "stage-.+-${HEX_EXT}" "$README"; then
  sedi_ext "s/stage-[^-]*-${HEX_EXT}/stage-${STAGE}-${BADGE_COLOR}/g" "$README"
  echo "[ok] Stage badge → $STAGE"
  CHANGES=$((CHANGES + 1))
fi

# --- Update phase badge -----------------------------------------------------
if [[ -n "$PHASE" ]] && grep -qE "phase-.+-${HEX_EXT}" "$README"; then
  sedi_ext "s/phase-[^-]*-${HEX_EXT}/phase-${PHASE}-${BADGE_COLOR}/g" "$README"
  echo "[ok] Phase badge → $PHASE"
  CHANGES=$((CHANGES + 1))
fi

# --- Update license badge ---------------------------------------------------
if [[ -n "$LICENSE" ]]; then
  # "All Rights Reserved" renders as "proprietary" on the badge for brevity
  if [[ "$LICENSE" == "All Rights Reserved" ]]; then
    LICENSE_BADGE="proprietary"
  else
    LICENSE_BADGE="${LICENSE// /%20}"
  fi
  if grep -qE "license-.+-${HEX_EXT}" "$README"; then
    sedi_ext "s/license-[^-]*(%20[^-]*)*-${HEX_EXT}/license-${LICENSE_BADGE}-${BADGE_COLOR}/g" "$README"
    echo "[ok] License badge → $LICENSE_BADGE"
    CHANGES=$((CHANGES + 1))
  fi
fi

# --- Update category badge --------------------------------------------------
if [[ -n "$CATEGORY" ]] && grep -qE "category-.+-${HEX_EXT}" "$README"; then
  sedi_ext "s/category-[^-]*-${HEX_EXT}/category-${CATEGORY}-${BADGE_COLOR}/g" "$README"
  echo "[ok] Category badge → $CATEGORY"
  CHANGES=$((CHANGES + 1))
fi

# --- Update language version badge ------------------------------------------
if [[ "$LANGUAGE" == "python" && -n "$LANGUAGE_VERSION" ]]; then
  # Strip >= or > prefix and append +
  VERSION_LABEL=$(echo "$LANGUAGE_VERSION" | sed 's/^>=//;s/^>//')
  if grep -qE "python-[0-9][0-9.+]*-${HEX_EXT}" "$README"; then
    sedi_ext "s/python-[0-9][0-9.+]*-${HEX_EXT}/python-${VERSION_LABEL}+-${BADGE_COLOR}/g" "$README"
    echo "[ok] Python version badge → ${VERSION_LABEL}+"
    CHANGES=$((CHANGES + 1))
  fi
elif [[ "$LANGUAGE" == "node" && -n "$LANGUAGE_VERSION" ]]; then
  VERSION_LABEL=$(echo "$LANGUAGE_VERSION" | sed 's/^>=//;s/^>//')
  if grep -qE "node-[0-9][0-9.+]*-${HEX_EXT}" "$README"; then
    sedi_ext "s/node-[0-9][0-9.+]*-${HEX_EXT}/node-${VERSION_LABEL}+-${BADGE_COLOR}/g" "$README"
    echo "[ok] Node version badge → ${VERSION_LABEL}+"
    CHANGES=$((CHANGES + 1))
  fi
fi

# --- Update quality gate badge ----------------------------------------------
if [[ -n "$QUALITY_GATE" && "$QUALITY_GATE" != "none" ]]; then
  if grep -qE "quality_gate-.+-${HEX_EXT}" "$README"; then
    sedi_ext "s/quality_gate-[^-]*-${HEX_EXT}/quality_gate-${QUALITY_GATE}-${BADGE_COLOR}/g" "$README"
    echo "[ok] Quality gate badge → $QUALITY_GATE"
    CHANGES=$((CHANGES + 1))
  fi
fi

# --- Update badge label color -----------------------------------------------
if grep -qE "labelColor=${HEX_EXT}" "$README"; then
  sedi_ext "s/labelColor=${HEX_EXT}/labelColor=${BADGE_LABEL_COLOR}/g" "$README"
  echo "[ok] Badge label color → #${BADGE_LABEL_COLOR}"
  CHANGES=$((CHANGES + 1))
fi

# --- Summary ----------------------------------------------------------------
if [[ "$CHANGES" -eq 0 ]]; then
  echo "[--] All badges already in sync (or no matching badges found)."
else
  echo ""
  echo "[ok] Updated $CHANGES badge(s) in README.md."
fi

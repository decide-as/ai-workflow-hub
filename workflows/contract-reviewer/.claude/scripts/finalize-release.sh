#!/usr/bin/env bash
#
# Release finalization.
#
# Determines the next version, collects changelog fragments,
# and updates version numbers across all metadata files.
#
# This script does NOT commit, push, or tag. The caller (GitHub Actions
# release workflow or Claude Code PR workflow) handles the REL commit
# and tagging.
#
# Usage:
#   bash .claude/scripts/finalize-release.sh [--major|--minor|--patch|--auto-bump] [--branch <name>] [--version-file <path>]
#
# Arguments:
#   --major                Bump major version (X+1.0.0)
#   --minor                Bump minor version (X.Y+1.0)   [default]
#   --patch                Bump patch version (X.Y.Z+1)
#   --auto-bump            Detect bump type from changelog fragment frontmatter.
#                          Fragments declare bump type via YAML frontmatter
#                          (e.g., "bump: minor"). The highest bump across all
#                          collected fragments wins (major > minor > patch).
#                          Falls back to minor if no fragments have frontmatter.
#   --branch <name>        Only collect changelog.d/<name>.md (optional)
#   --version-file <path>  Write the new version to this file (avoids subshell capture)
#   --phase-file <path>    Write the detected phase transition to this file (empty if none)
#
# Output:
#   Prints the new version number to stdout as the last line.
#   If --version-file is given, also writes it to that file.
#   If --phase-file is given, writes the phase name if a transition was detected.

set -euo pipefail

# ---- Activate local venv if present ------------------------------------------
if [[ -d ".venv/bin" ]]; then
  export PATH="$PWD/.venv/bin:$PATH"
elif _git_root=$(git rev-parse --show-toplevel 2>/dev/null) && [[ -d "$_git_root/.venv/bin" ]]; then
  export PATH="$_git_root/.venv/bin:$PATH"
elif [[ -n "${VIRTUAL_ENV:-}" ]] && [[ -x "${VIRTUAL_ENV}/bin/python3" ]]; then
  export PATH="$VIRTUAL_ENV/bin:$PATH"
fi

# --- Ensure we're inside a Git repository -----------------------------------
if ! GIT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null); then
  echo "[!!] Not inside a Git repository." >&2
  exit 1
fi
cd "$GIT_ROOT"

# --- Parse arguments ---------------------------------------------------------
BUMP_TYPE="minor"
BUMP_EXPLICIT=false
AUTO_BUMP=false
BRANCH_NAME=""
VERSION_FILE=""
PHASE_FILE=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --major) BUMP_TYPE="major"; BUMP_EXPLICIT=true; shift ;;
    --minor) BUMP_TYPE="minor"; BUMP_EXPLICIT=true; shift ;;
    --patch) BUMP_TYPE="patch"; BUMP_EXPLICIT=true; shift ;;
    --auto-bump) AUTO_BUMP=true; shift ;;
    --branch)
      if [[ $# -lt 2 ]]; then
        echo "[!!] --branch requires a branch name argument." >&2
        exit 1
      fi
      BRANCH_NAME="$2"; shift 2
      ;;
    --version-file)
      if [[ $# -lt 2 ]]; then
        echo "[!!] --version-file requires a path argument." >&2
        exit 1
      fi
      VERSION_FILE="$2"; shift 2
      ;;
    --phase-file)
      if [[ $# -lt 2 ]]; then
        echo "[!!] --phase-file requires a path argument." >&2
        exit 1
      fi
      PHASE_FILE="$2"; shift 2
      ;;
    *) echo "[!!] Unknown argument: $1" >&2; exit 1 ;;
  esac
done

# --- Fetch tags --------------------------------------------------------------
git fetch origin --tags 2>/dev/null || true

# --- Read current version from project-meta.yaml ------------------------------
META="project-meta.yaml"
if [[ ! -f "$META" ]]; then
  echo "[!!] No project-meta.yaml found." >&2
  exit 1
fi

CURRENT_VERSION=$(python3 -c "
import yaml
with open('$META') as f:
    m = yaml.safe_load(f)
print(m.get('version', ''))
")

if [[ -z "$CURRENT_VERSION" ]]; then
  echo "[!!] No version field in project-meta.yaml." >&2
  exit 1
fi

echo "[--] Current version: $CURRENT_VERSION" >&2

# --- Read latest tag ---------------------------------------------------------
LATEST_TAG=$(git tag -l 'v*' --sort=-v:refname | head -1 || true)
if [[ -n "$LATEST_TAG" ]]; then
  LATEST_TAG_VERSION="${LATEST_TAG#v}"
  echo "[--] Latest tag: $LATEST_TAG (version $LATEST_TAG_VERSION)" >&2
else
  LATEST_TAG_VERSION="$CURRENT_VERSION"
  echo "[--] No tags found, using current version as base." >&2
fi

# --- Validate --auto-bump is not combined with explicit bump flags -----------
if [[ "$AUTO_BUMP" == true ]] && [[ "$BUMP_EXPLICIT" == true ]]; then
  echo "[!!] --auto-bump cannot be combined with --major, --minor, or --patch." >&2
  exit 1
fi

# --- Auto-detect bump type from fragment frontmatter -------------------------
# This duplicates the frontmatter parsing from collect-changelog-fragments.sh
# intentionally: finalize-release.sh needs the bump type BEFORE calling collect
# (to compute the version number), and collect cannot be used as a dry-run
# detector because it always consumes fragments.
# --- Detect bump type and phase transition from fragment frontmatter ---------
# Both results are written to global variables (not stdout) to avoid subshell
# issues — $() would discard DETECTED_PHASE since subshells cannot modify the
# parent shell's variables.
DETECTED_BUMP="minor"
DETECTED_PHASE=""

_scan_fragment_frontmatter() {
  local FRAGMENT_DIR="changelog.d"
  local HIGHEST_BUMP=0

  DETECTED_BUMP="minor"
  DETECTED_PHASE=""

  [[ -d "$FRAGMENT_DIR" ]] || return

  for fragment in "$FRAGMENT_DIR"/*.md; do
    [[ -f "$fragment" ]] || continue
    [[ "$(basename "$fragment")" == "README.md" ]] && continue

    local IN_FRONTMATTER=false
    local FRONTMATTER_STARTED=false

    while IFS= read -r line; do
      if [[ "$FRONTMATTER_STARTED" == false ]] && [[ "$line" == "---" ]]; then
        FRONTMATTER_STARTED=true
        IN_FRONTMATTER=true
        continue
      fi
      if [[ "$IN_FRONTMATTER" == true ]] && [[ "$line" == "---" ]]; then
        break
      fi
      if [[ "$IN_FRONTMATTER" == true ]]; then
        if [[ "$line" =~ ^bump:[[:space:]]*(.+)$ ]]; then
          case "${BASH_REMATCH[1]}" in
            major) [[ 3 -gt "$HIGHEST_BUMP" ]] && HIGHEST_BUMP=3 ;;
            minor) [[ 2 -gt "$HIGHEST_BUMP" ]] && HIGHEST_BUMP=2 ;;
            patch) [[ 1 -gt "$HIGHEST_BUMP" ]] && HIGHEST_BUMP=1 ;;
          esac
        fi
        if [[ "$line" =~ ^phase:[[:space:]]*(.+)$ ]]; then
          DETECTED_PHASE="${BASH_REMATCH[1]}"
        fi
      fi
    done < "$fragment"
  done

  case "$HIGHEST_BUMP" in
    3) DETECTED_BUMP="major" ;;
    1) DETECTED_BUMP="patch" ;;
    *) DETECTED_BUMP="minor" ;;
  esac
}

_scan_fragment_frontmatter

if [[ "$AUTO_BUMP" == true ]]; then
  BUMP_TYPE="$DETECTED_BUMP"
  echo "[--] Auto-detected bump type: $BUMP_TYPE" >&2
fi

if [[ -n "$DETECTED_PHASE" ]]; then
  echo "[--] Phase transition detected: $DETECTED_PHASE" >&2
fi

# --- Compute next version ----------------------------------------------------
IFS='.' read -r MAJOR MINOR PATCH <<< "$LATEST_TAG_VERSION"

case "$BUMP_TYPE" in
  major) MAJOR=$((MAJOR + 1)); MINOR=0; PATCH=0 ;;
  minor) MINOR=$((MINOR + 1)); PATCH=0 ;;
  patch) PATCH=$((PATCH + 1)) ;;
esac

NEW_VERSION="${MAJOR}.${MINOR}.${PATCH}"
echo "[--] New version: $NEW_VERSION ($BUMP_TYPE bump)" >&2

# --- Get today's date --------------------------------------------------------
TODAY=$(date +%Y-%m-%d)

# --- Collect changelog fragments ---------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BRANCH_ARGS=()
if [[ -n "$BRANCH_NAME" ]]; then
  BRANCH_ARGS=("--branch" "$BRANCH_NAME")
fi
if [[ -f "$SCRIPT_DIR/collect-changelog-fragments.sh" ]]; then
  bash "$SCRIPT_DIR/collect-changelog-fragments.sh" "$NEW_VERSION" "$TODAY" ${BRANCH_ARGS[@]+"${BRANCH_ARGS[@]}"} >&2
else
  echo "[!!] collect-changelog-fragments.sh not found at $SCRIPT_DIR" >&2
  exit 1
fi

# --- Update version in project-meta.yaml --------------------------------------
python3 -c "
import yaml

with open('$META') as f:
    content = f.read()

# Simple string replacement to preserve formatting
content = content.replace('version: $CURRENT_VERSION', 'version: $NEW_VERSION', 1)

with open('$META', 'w') as f:
    f.write(content)
"
echo "[ok] Updated project-meta.yaml version to $NEW_VERSION" >&2

# --- Update version in pyproject.toml ---------------------------------------
PYPROJECT="pyproject.toml"
if [[ -f "$PYPROJECT" ]]; then
  # Cross-platform sed
  if [[ "$(uname)" == "Darwin" ]]; then
    sed -i '' "s/^version = \"${CURRENT_VERSION}\"/version = \"${NEW_VERSION}\"/" "$PYPROJECT"
  else
    sed -i "s/^version = \"${CURRENT_VERSION}\"/version = \"${NEW_VERSION}\"/" "$PYPROJECT"
  fi
  echo "[ok] Updated pyproject.toml version to $NEW_VERSION" >&2
fi

# --- Update README.md version badge -----------------------------------------
if [[ -f "$SCRIPT_DIR/update-readme-badges.sh" ]]; then
  bash "$SCRIPT_DIR/update-readme-badges.sh" >&2
else
  # Fallback: update version badge directly
  README="README.md"
  if [[ -f "$README" ]]; then
    # Read badge color from metadata
    FB_COLOR=$(python3 -c "
import yaml
with open('$META') as f:
    m = yaml.safe_load(f)
print(m.get('badge_color', '') or 'd4bc9a')
" 2>/dev/null || echo "d4bc9a")
    if [[ "$(uname)" == "Darwin" ]]; then
      sed -i '' -E "s/version-[^-]*-[a-fA-F0-9]{6}/version-${NEW_VERSION}-${FB_COLOR}/g" "$README"
    else
      sed -i -E "s/version-[^-]*-[a-fA-F0-9]{6}/version-${NEW_VERSION}-${FB_COLOR}/g" "$README"
    fi
    echo "[ok] Updated README.md version badge to $NEW_VERSION" >&2
  fi
fi

# --- Write version to file if requested --------------------------------------
if [[ -n "$VERSION_FILE" ]]; then
  echo "$NEW_VERSION" > "$VERSION_FILE"
  echo "[ok] Version written to $VERSION_FILE" >&2
fi

# --- Write phase to file if requested ---------------------------------------
if [[ -n "$PHASE_FILE" ]]; then
  echo "$DETECTED_PHASE" > "$PHASE_FILE"
  if [[ -n "$DETECTED_PHASE" ]]; then
    echo "[ok] Phase transition written to $PHASE_FILE: $DETECTED_PHASE" >&2
  fi
fi

# --- Output the new version (last line to stdout) ----------------------------
echo "$NEW_VERSION"

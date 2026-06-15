#!/usr/bin/env bash
#
# Collect changelog fragments from changelog.d/ into CHANGELOG.md.
#
# Merges fragment files by subsection (Added, Changed, etc.), prepends
# a version heading, and inserts the assembled block into CHANGELOG.md.
# Processed fragment files are removed after collection.
#
# When --branch is specified, only that branch's fragment is collected.
# Other fragments are left untouched. This prevents one branch's release
# from accidentally sweeping another branch's changelog entries.
#
# Fragments may contain YAML frontmatter with a bump type (major, minor,
# patch). The highest bump type across all collected fragments is reported
# via --bump-file. Fragments without frontmatter default to minor.
#
# Usage:
#   bash .claude/scripts/collect-changelog-fragments.sh <version> <date> [--branch <name>] [--bump-file <path>]
#
# Arguments:
#   version              The version number (e.g., 0.13.1)
#   date                 The release date (e.g., 2026-03-13)
#   --branch <name>      Only collect changelog.d/<name>.md (optional)
#   --bump-file <path>   Write the highest bump type to this file (optional)
#
# Examples:
#   bash .claude/scripts/collect-changelog-fragments.sh 0.13.1 2026-03-13
#   bash .claude/scripts/collect-changelog-fragments.sh 0.14.0 2026-03-14 --branch 2026-03-14-feature
#   bash .claude/scripts/collect-changelog-fragments.sh 0.14.0 2026-03-14 --bump-file /tmp/bump_type.txt

set -euo pipefail

# --- Ensure we're inside a Git repository -----------------------------------
if ! GIT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null); then
  echo "[!!] Not inside a Git repository." >&2
  exit 1
fi
cd "$GIT_ROOT"

# --- Validate arguments ------------------------------------------------------
if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <version> <date> [--branch <name>] [--bump-file <path>]" >&2
  exit 1
fi

VERSION="$1"
DATE="$2"
shift 2

# --- Parse optional flags ----------------------------------------------------
BRANCH_NAME=""
BUMP_FILE=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --branch)
      if [[ $# -lt 2 ]]; then
        echo "[!!] --branch requires a branch name argument." >&2
        exit 1
      fi
      BRANCH_NAME="$2"
      shift 2
      ;;
    --bump-file)
      if [[ $# -lt 2 ]]; then
        echo "[!!] --bump-file requires a path argument." >&2
        exit 1
      fi
      BUMP_FILE="$2"
      shift 2
      ;;
    *) echo "[!!] Unknown argument: $1" >&2; exit 1 ;;
  esac
done

if [[ -z "$VERSION" ]]; then
  echo "[!!] Version cannot be empty." >&2
  exit 1
fi

if [[ -z "$DATE" ]]; then
  echo "[!!] Date cannot be empty." >&2
  exit 1
fi

# --- Validate version format -------------------------------------------------
if ! echo "$VERSION" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+$'; then
  echo "[!!] Version must be in semver format (X.Y.Z): $VERSION" >&2
  exit 1
fi

# --- Validate date format ----------------------------------------------------
if ! echo "$DATE" | grep -qE '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'; then
  echo "[!!] Date must be in YYYY-MM-DD format: $DATE" >&2
  exit 1
fi

# --- Find fragment files -----------------------------------------------------
FRAGMENT_DIR="changelog.d"
if [[ ! -d "$FRAGMENT_DIR" ]]; then
  echo "[--] No changelog.d/ directory found. Nothing to collect."
  exit 0
fi

# Collect fragment files — either a single branch or all
FRAGMENTS=()
if [[ -n "$BRANCH_NAME" ]]; then
  # Single-branch mode: only collect the named fragment (sanitize slashes)
  SAFE_NAME="${BRANCH_NAME//\//-}"
  TARGET_FRAGMENT="$FRAGMENT_DIR/${SAFE_NAME}.md"
  if [[ -f "$TARGET_FRAGMENT" ]]; then
    FRAGMENTS+=("$TARGET_FRAGMENT")
  else
    echo "[--] No fragment found for branch '$BRANCH_NAME' at $TARGET_FRAGMENT. Nothing to collect."
    exit 0
  fi
else
  # All-fragments mode: collect every .md except README.md
  while IFS= read -r -d '' file; do
    FRAGMENTS+=("$file")
  done < <(find "$FRAGMENT_DIR" -maxdepth 1 -name '*.md' ! -name 'README.md' -print0 | sort -z)
fi

if [[ ${#FRAGMENTS[@]} -eq 0 ]]; then
  echo "[--] No changelog fragments found. Nothing to collect."
  exit 0
fi

echo "[--] Found ${#FRAGMENTS[@]} fragment(s) to collect."

# --- Parse bump types from fragment frontmatter ------------------------------
# Track the highest bump type: major (3) > minor (2) > patch (1)
# Fragments without frontmatter default to minor.
HIGHEST_BUMP=0  # 0 = none seen yet

bump_priority() {
  case "$1" in
    major) echo 3 ;;
    minor) echo 2 ;;
    patch) echo 1 ;;
    *) echo 2 ;;  # default to minor for unknown values
  esac
}

for fragment in "${FRAGMENTS[@]}"; do
  FRAGMENT_BUMP=""
  IN_FRONTMATTER=false
  FRONTMATTER_STARTED=false

  while IFS= read -r line; do
    if [[ "$FRONTMATTER_STARTED" == false ]] && [[ "$line" == "---" ]]; then
      FRONTMATTER_STARTED=true
      IN_FRONTMATTER=true
      continue
    fi
    if [[ "$IN_FRONTMATTER" == true ]] && [[ "$line" == "---" ]]; then
      IN_FRONTMATTER=false
      break
    fi
    if [[ "$IN_FRONTMATTER" == true ]]; then
      # Parse bump: <type> from frontmatter
      if [[ "$line" =~ ^bump:[[:space:]]*(.+)$ ]]; then
        FRAGMENT_BUMP="${BASH_REMATCH[1]}"
      fi
    fi
  done < "$fragment"

  # Default to minor if no bump type found
  if [[ -z "$FRAGMENT_BUMP" ]]; then
    FRAGMENT_BUMP="minor"
  fi

  PRIORITY=$(bump_priority "$FRAGMENT_BUMP")
  if [[ "$PRIORITY" -gt "$HIGHEST_BUMP" ]]; then
    HIGHEST_BUMP="$PRIORITY"
  fi
done

# Convert priority back to name
case "$HIGHEST_BUMP" in
  3) DETECTED_BUMP="major" ;;
  1) DETECTED_BUMP="patch" ;;
  *) DETECTED_BUMP="minor" ;;
esac

echo "[--] Detected bump type: $DETECTED_BUMP"

# Write bump type to file if requested
if [[ -n "$BUMP_FILE" ]]; then
  echo "$DETECTED_BUMP" > "$BUMP_FILE"
  echo "[ok] Bump type written to $BUMP_FILE"
fi

# --- Define subsection order (Keep a Changelog standard) ---------------------
SECTIONS=("Added" "Changed" "Deprecated" "Removed" "Fixed" "Security")

# --- Merge fragments by subsection (bash 3 compatible) -----------------------
# Use temporary files instead of associative arrays for macOS bash 3 compat.
MERGE_DIR=$(mktemp -d)
trap 'rm -rf "$MERGE_DIR"' EXIT

for section in "${SECTIONS[@]}"; do
  : > "$MERGE_DIR/$section"
done

for fragment in "${FRAGMENTS[@]}"; do
  current_section=""
  in_frontmatter=false
  frontmatter_started=false

  while IFS= read -r line; do
    # Skip YAML frontmatter
    if [[ "$frontmatter_started" == false ]] && [[ "$line" == "---" ]]; then
      frontmatter_started=true
      in_frontmatter=true
      continue
    fi
    if [[ "$in_frontmatter" == true ]] && [[ "$line" == "---" ]]; then
      in_frontmatter=false
      continue
    fi
    if [[ "$in_frontmatter" == true ]]; then
      continue
    fi

    # Check if this is a subsection heading
    for section in "${SECTIONS[@]}"; do
      if [[ "$line" == "### $section" ]]; then
        current_section="$section"
        continue 2
      fi
    done

    # If we're in a section, accumulate non-empty content lines
    if [[ -n "$current_section" ]]; then
      # Skip empty lines at the start of an empty section file
      if [[ -z "$line" ]] && [[ ! -s "$MERGE_DIR/$current_section" ]]; then
        continue
      fi
      echo "$line" >> "$MERGE_DIR/$current_section"
    fi
  done < "$fragment"
done

# --- Build the assembled changelog entry -------------------------------------
ENTRY="## [$VERSION] - $DATE"

SECTIONS_FOUND=0
for section in "${SECTIONS[@]}"; do
  if [[ -s "$MERGE_DIR/$section" ]]; then
    content=$(cat "$MERGE_DIR/$section")
    ENTRY="$ENTRY

### $section

$content"
    SECTIONS_FOUND=$((SECTIONS_FOUND + 1))
  fi
done

# Add trailing newline
ENTRY="$ENTRY
"

if [[ "$SECTIONS_FOUND" -eq 0 ]]; then
  echo "[!!] Fragments contained no valid subsection entries." >&2
  exit 1
fi

# --- Insert into CHANGELOG.md -----------------------------------------------
CHANGELOG="CHANGELOG.md"

if [[ ! -f "$CHANGELOG" ]]; then
  echo "[!!] CHANGELOG.md not found. Cannot insert entry." >&2
  exit 1
fi

# Find the line number of the first ## heading (existing version entry)
# `|| true` guards set -e/pipefail: on a first release there are no version
# headings so grep exits 1, which would kill the script before the fallback.
FIRST_HEADING_LINE=$(grep -n '^## \[' "$CHANGELOG" | head -1 | cut -d: -f1 || true)
FIRST_RELEASE=false

if [[ -z "$FIRST_HEADING_LINE" ]]; then
  # No existing version headings — append after the header block
  FIRST_RELEASE=true
  # Find the last line of the preamble (blank line after "adheres to" line)
  PREAMBLE_END=$(grep -n 'Semantic Versioning' "$CHANGELOG" | head -1 | cut -d: -f1 || true)
  if [[ -n "$PREAMBLE_END" ]]; then
    FIRST_HEADING_LINE=$((PREAMBLE_END + 2))
  else
    FIRST_HEADING_LINE=3
  fi
fi

# Split the file and insert the new entry
{
  head -n $((FIRST_HEADING_LINE - 1)) "$CHANGELOG"
  if [[ "$FIRST_RELEASE" == true ]]; then echo ""; fi
  echo "$ENTRY"
  tail -n +"$FIRST_HEADING_LINE" "$CHANGELOG"
} > "${CHANGELOG}.tmp"

mv "${CHANGELOG}.tmp" "$CHANGELOG"

echo "[ok] Inserted [$VERSION] - $DATE entry into CHANGELOG.md"

# --- Remove processed fragments ---------------------------------------------
for fragment in "${FRAGMENTS[@]}"; do
  rm "$fragment"
  echo "[ok] Removed $(basename "$fragment")"
done

echo "[ok] Collected ${#FRAGMENTS[@]} fragment(s) into CHANGELOG.md"

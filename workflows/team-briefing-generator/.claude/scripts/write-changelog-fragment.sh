#!/usr/bin/env bash
#
# Write a changelog fragment for the current branch.
#
# Creates a file in changelog.d/<branch-name>.md containing Keep a Changelog
# subsection entries. The fragment does NOT include a version heading — that
# is added by collect-changelog-fragments.sh during the post-merge release.
#
# Usage:
#   bash .claude/scripts/write-changelog-fragment.sh <branch-name> --stdin [--bump <type>] <<'EOF'
#   ### Added
#   - New feature
#   EOF
#
#   bash .claude/scripts/write-changelog-fragment.sh <branch-name> --file <path> [--bump <type>]
#   bash .claude/scripts/write-changelog-fragment.sh <branch-name> <content> [--bump <type>]
#
# Arguments:
#   branch-name       The branch name (used as the fragment filename)
#   --stdin           Read content from stdin (preferred — no temp files needed)
#   --file <path>     Read content from a file (avoids subshell in the caller)
#   content           The changelog entries in Keep a Changelog subsection format
#                     (### Added, ### Changed, ### Fixed, etc.)
#   --bump <type>     Semver bump type: major, minor, or patch (default: minor)
#                     Written as YAML frontmatter in the fragment file.
#                     Used by collect-changelog-fragments.sh to determine version bump.
#   --phase <name>    Phase transition marker (e.g., beta, mvp, production).
#                     Written as YAML frontmatter in the fragment file.
#                     Used by release.yml to create a phase/<name> tag.
#
# Examples:
#   # Stdin-based with bump type (preferred — single command, no temp files):
#   bash .claude/scripts/write-changelog-fragment.sh 2026-03-13-my-feature --stdin --bump minor <<'EOF'
#   ### Added
#   - New feature
#   EOF
#
#   # File-based with bump type:
#   bash .claude/scripts/write-changelog-fragment.sh 2026-03-13-my-feature --file /tmp/changelog.txt --bump minor
#
#   # File-based without bump type (defaults to minor):
#   bash .claude/scripts/write-changelog-fragment.sh 2026-03-13-my-feature --file /tmp/changelog.txt
#
#   # Inline content (legacy — requires subshell for multiline):
#   bash .claude/scripts/write-changelog-fragment.sh 2026-03-13-my-feature "content"

set -euo pipefail

# --- Ensure we're inside a Git repository -----------------------------------
if ! GIT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null); then
  echo "[!!] Not inside a Git repository." >&2
  exit 1
fi
cd "$GIT_ROOT"

# --- Parse arguments ---------------------------------------------------------
if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <branch-name> {--stdin | --file <path> | <content>} [--bump <type>]" >&2
  exit 1
fi

BRANCH_NAME="$1"
shift

if [[ -z "$BRANCH_NAME" ]]; then
  echo "[!!] Branch name cannot be empty." >&2
  exit 1
fi

BUMP_TYPE=""
PHASE=""
CONTENT=""
CONTENT_FILE=""
READ_STDIN=false

# Parse remaining arguments (order-independent for --stdin, --file, --bump, and content)
while [[ $# -gt 0 ]]; do
  case "$1" in
    --stdin)
      READ_STDIN=true
      shift
      ;;
    --file)
      if [[ $# -lt 2 ]]; then
        echo "[!!] --file requires a path argument." >&2
        exit 1
      fi
      CONTENT_FILE="$2"
      shift 2
      ;;
    --bump)
      if [[ $# -lt 2 ]]; then
        echo "[!!] --bump requires a type argument (major, minor, or patch)." >&2
        exit 1
      fi
      BUMP_TYPE="$2"
      shift 2
      ;;
    --phase)
      if [[ $# -lt 2 ]]; then
        echo "[!!] --phase requires a phase name argument." >&2
        exit 1
      fi
      PHASE="$2"
      shift 2
      ;;
    *)
      # Positional content argument (legacy mode)
      CONTENT="$1"
      shift
      ;;
  esac
done

# Validate mutual exclusivity of --stdin and --file
if [[ "$READ_STDIN" == true ]] && [[ -n "$CONTENT_FILE" ]]; then
  echo "[!!] Cannot combine --stdin and --file. Use one or the other." >&2
  exit 1
fi

# Read content from stdin if --stdin was specified
if [[ "$READ_STDIN" == true ]]; then
  CONTENT=$(cat)
# Read content from file if --file was specified
elif [[ -n "$CONTENT_FILE" ]]; then
  if [[ ! -f "$CONTENT_FILE" ]]; then
    echo "[!!] Content file not found: $CONTENT_FILE" >&2
    exit 1
  fi
  CONTENT=$(cat "$CONTENT_FILE")
fi

if [[ -z "$CONTENT" ]]; then
  echo "[!!] Content cannot be empty." >&2
  exit 1
fi

# --- Validate bump type ------------------------------------------------------
if [[ -n "$BUMP_TYPE" ]]; then
  case "$BUMP_TYPE" in
    major|minor|patch) ;;
    *)
      echo "[!!] Invalid bump type: $BUMP_TYPE (must be major, minor, or patch)" >&2
      exit 1
      ;;
  esac
fi

# --- Validate content has at least one subsection heading --------------------
if ! echo "$CONTENT" | grep -qE '^### (Added|Changed|Deprecated|Removed|Fixed|Security)'; then
  echo "[!!] Content must contain at least one Keep a Changelog subsection heading" >&2
  echo "     (### Added, ### Changed, ### Deprecated, ### Removed, ### Fixed, ### Security)" >&2
  exit 1
fi

# --- Ensure changelog.d/ exists ---------------------------------------------
mkdir -p changelog.d

# --- Sanitize branch name for use as filename --------------------------------
SAFE_NAME="${BRANCH_NAME//\//-}"

# --- Write the fragment ------------------------------------------------------
FRAGMENT_FILE="changelog.d/${SAFE_NAME}.md"

{
  # Write YAML frontmatter with bump type and/or phase if specified
  if [[ -n "$BUMP_TYPE" ]] || [[ -n "$PHASE" ]]; then
    echo "---"
    if [[ -n "$BUMP_TYPE" ]]; then
      echo "bump: $BUMP_TYPE"
    fi
    if [[ -n "$PHASE" ]]; then
      echo "phase: $PHASE"
    fi
    echo "---"
    echo ""
  fi
  echo "$CONTENT"
} > "$FRAGMENT_FILE"

# Ensure file ends with a newline
if [[ -n "$(tail -c 1 "$FRAGMENT_FILE")" ]]; then
  echo "" >> "$FRAGMENT_FILE"
fi

MSG="[ok] Changelog fragment written to $FRAGMENT_FILE"
if [[ -n "$BUMP_TYPE" ]]; then
  MSG="$MSG (bump: $BUMP_TYPE)"
fi
if [[ -n "$PHASE" ]]; then
  MSG="$MSG (phase: $PHASE)"
fi
echo "$MSG"

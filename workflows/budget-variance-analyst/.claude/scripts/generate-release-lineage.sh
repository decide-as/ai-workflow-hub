#!/usr/bin/env bash
#
# Generate a release lineage manifest mapping version → PRs → modules.
#
# Produces a YAML file that enables downstream-first error tracing:
#   error → release version → constituent PRs → affected modules → root cause
#
# Usage:
#   bash .claude/scripts/generate-release-lineage.sh <version> [--output <path>]
#
# Arguments:
#   version          The release version (e.g., 0.39.0)
#   --output <path>  Write manifest to this path (default: /tmp/release-lineage.yaml)
#
# The script reads:
#   - Git log since the previous tag to find constituent commits
#   - changelog.d/ fragments (if any remain) for bump types and content
#   - Git diff-tree per commit for affected modules
#
# Output format (YAML):
#   version: "0.39.0"
#   tag: "v0.39.0"
#   date: "2026-03-18"
#   previous_tag: "v0.38.1"
#   aggregate_bump: "minor"
#   commits:
#     - hash: "abc1234"
#       subject: "ENH Add promotion-aware PR workflow (#116)"
#       author: "Christian Braathen"
#       date: "2026-03-18"
#       modules:
#         - ".claude/skills/pr/SKILL.md"
#         - "src/<pkg>/scripts/get-pr-commit-log.sh"
#   fragments:
#     - name: "2026-03-18-feat-promotion-pr-workflow.md"
#       bump: "minor"

set -euo pipefail

# --- Ensure we're inside a Git repository --------------------------------
if ! GIT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null); then
  echo "[!!] Not inside a Git repository." >&2
  exit 1
fi
cd "$GIT_ROOT"

# --- Parse arguments ------------------------------------------------------
if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <version> [--output <path>]" >&2
  exit 1
fi

VERSION="$1"
shift

OUTPUT="/tmp/release-lineage.yaml"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --output)
      if [[ $# -lt 2 ]]; then
        echo "[!!] --output requires a path argument." >&2
        exit 1
      fi
      OUTPUT="$2"
      shift 2
      ;;
    *) echo "[!!] Unknown argument: $1" >&2; exit 1 ;;
  esac
done

# --- Find the previous tag ------------------------------------------------
PREV_TAG=$(git describe --tags --abbrev=0 HEAD^ 2>/dev/null || true)
if [[ -z "$PREV_TAG" ]]; then
  # No previous tag — use root commit
  RANGE="HEAD"
  PREV_TAG="(none)"
else
  RANGE="${PREV_TAG}..HEAD"
fi

# --- Get current date -----------------------------------------------------
RELEASE_DATE=$(date +%Y-%m-%d)

# --- Start YAML output ----------------------------------------------------
{
  echo "version: \"$VERSION\""
  echo "tag: \"v$VERSION\""
  echo "date: \"$RELEASE_DATE\""
  echo "previous_tag: \"$PREV_TAG\""

  # --- Collect fragment info before they're deleted ------------------------
  # (This script runs before finalize-release deletes fragments)
  AGGREGATE_BUMP="patch"
  echo "fragments:"

  if [[ -d "changelog.d" ]]; then
    for frag in changelog.d/*.md; do
      [[ -f "$frag" ]] || continue
      basename_frag=$(basename "$frag")
      [[ "$basename_frag" == "README.md" ]] && continue

      # Extract bump type from YAML frontmatter
      bump=$(sed -n '/^---$/,/^---$/{ /^bump:/{ s/^bump: *//; p; } }' "$frag" 2>/dev/null || echo "minor")
      [[ -z "$bump" ]] && bump="minor"

      echo "  - name: \"$basename_frag\""
      echo "    bump: \"$bump\""

      # Track highest bump
      case "$bump" in
        major) AGGREGATE_BUMP="major" ;;
        minor) [[ "$AGGREGATE_BUMP" != "major" ]] && AGGREGATE_BUMP="minor" ;;
      esac
    done
  else
    echo "  []"
  fi

  echo "aggregate_bump: \"$AGGREGATE_BUMP\""

  # --- Collect constituent commits -----------------------------------------
  echo "commits:"

  if [[ "$RANGE" == "HEAD" ]]; then
    COMMITS=$(git log --format="%H" HEAD)
  else
    COMMITS=$(git log --format="%H" "$RANGE" --no-merges)
  fi

  if [[ -z "$COMMITS" ]]; then
    echo "  []"
  else
    while IFS= read -r commit_hash; do
      short_hash=$(git log -1 --format="%h" "$commit_hash")
      subject=$(git log -1 --format="%s" "$commit_hash")
      author=$(git log -1 --format="%an" "$commit_hash")
      commit_date=$(git log -1 --format="%ad" --date=short "$commit_hash")

      # Escape quotes in subject and author for YAML
      subject="${subject//\"/\\\"}"
      author="${author//\"/\\\"}"

      echo "  - hash: \"$short_hash\""
      echo "    subject: \"$subject\""
      echo "    author: \"$author\""
      echo "    date: \"$commit_date\""

      # Get affected modules
      modules=$(git diff-tree --no-commit-id --name-only -r "$commit_hash" 2>/dev/null || true)
      if [[ -n "$modules" ]]; then
        echo "    modules:"
        while IFS= read -r mod; do
          echo "      - \"$mod\""
        done <<< "$modules"
      else
        echo "    modules: []"
      fi
    done <<< "$COMMITS"
  fi
} > "$OUTPUT"

echo "[ok] Release lineage manifest written to $OUTPUT"
echo "$OUTPUT"

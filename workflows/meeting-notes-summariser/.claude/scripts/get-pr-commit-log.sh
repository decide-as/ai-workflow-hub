#!/usr/bin/env bash
#
# Collect branch commit history and recent base-branch commits
# for generating a PR description. Writes output to a temporary file.
#
# Usage:
#   bash .claude/scripts/get-pr-commit-log.sh                # full PR log
#   bash .claude/scripts/get-pr-commit-log.sh --since-tag     # commits since latest tag
#   bash .claude/scripts/get-pr-commit-log.sh --aggregate     # promotion PR: all commits since last tag on target

set -euo pipefail

# --- Ensure we're inside a Git repository --------------------------------
if ! GIT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null); then
  echo "Not inside a Git repository." >&2
  exit 1
fi

export LC_ALL=C.UTF-8

# --- Handle --since-tag mode ---
if [[ "${1:-}" == "--since-tag" ]]; then
  latest_tag=$(git describe --tags --abbrev=0 2>/dev/null || true)
  if [ -z "$latest_tag" ]; then
    echo "[!!] No tags found in repository." >&2
    exit 1
  fi
  git log --oneline "${latest_tag}..HEAD"
  exit 0
fi

# --- Handle --aggregate mode (promotion PRs) ---
if [[ "${1:-}" == "--aggregate" ]]; then
  # Clean up stale files from previous runs
  rm -f /tmp/pr_commit_log.*.txt
  tmp_file=$(mktemp /tmp/pr_commit_log.XXXXXX.txt)
  target_branch="${2:-master}"

  {
    repo_url=$(git config --get remote.origin.url | sed -E 's#git@([^:]+):#https://\1/#; s/\.git$//')

    printf "\n# ===================================\n# REPOSITORY URL\n# ===================================\n\n**%s**\n" "$repo_url"

    # Find the last release tag on the target branch
    latest_tag=$(git describe --tags --abbrev=0 "origin/${target_branch}" 2>/dev/null || true)

    if [ -n "$latest_tag" ]; then
      range="${latest_tag}..HEAD"
      printf "\n# ===================================\n# COMMITS SINCE LAST RELEASE TAG: %s\n# (These are the bundled changes for the promotion PR)\n# ===================================\n\n" "$latest_tag"
    else
      range="HEAD"
      printf "\n# ===================================\n# ALL COMMITS ON BRANCH\n# (No release tags found — showing full history)\n# ===================================\n\n"
    fi

    git log "$range" --no-merges --pretty=format:"%h %ad %B%n=========================%n"

    # List changelog fragments
    printf "\n\n# ===================================\n# CHANGELOG FRAGMENTS IN changelog.d/\n# ===================================\n\n"
    if [ -d "changelog.d" ]; then
      for frag in changelog.d/*.md; do
        [ -f "$frag" ] || continue
        basename_frag=$(basename "$frag")
        [ "$basename_frag" = "README.md" ] && continue
        # Extract bump type from YAML frontmatter
        bump=$(sed -n '/^---$/,/^---$/{ /^bump:/{ s/^bump: *//; p; } }' "$frag" 2>/dev/null || echo "unknown")
        printf "- %s (bump: %s)\n" "$basename_frag" "$bump"
      done
    else
      printf "(no changelog.d/ directory found)\n"
    fi

    printf "\n\n# ===================================\n# LATEST COMMITS ON TARGET BRANCH: %s\n# ===================================\n\n" "$target_branch"

    git log "origin/${target_branch}" \
            -n 10 --pretty=format:"%h %ad %B%n=========================%n"
  } > "$tmp_file"

  echo "$tmp_file"
  exit 0
fi

# Clean up stale files from previous runs
rm -f /tmp/pr_commit_log.*.txt
tmp_file=$(mktemp /tmp/pr_commit_log.XXXXXX.txt)

{
  repo_url=$(git config --get remote.origin.url | sed -E 's#git@([^:]+):#https://\1/#; s/\.git$//')
  # Resolve the default branch — fall back to master if origin/HEAD is not set
  if git symbolic-ref refs/remotes/origin/HEAD >/dev/null 2>&1; then
    root_branch=$(git symbolic-ref refs/remotes/origin/HEAD | sed 's@^refs/remotes/origin/@@')
  else
    # Try to auto-detect and set origin/HEAD
    git remote set-head origin --auto >/dev/null 2>&1 || true
    if git symbolic-ref refs/remotes/origin/HEAD >/dev/null 2>&1; then
      root_branch=$(git symbolic-ref refs/remotes/origin/HEAD | sed 's@^refs/remotes/origin/@@')
    else
      root_branch="master"
    fi
  fi
  branch_name=$(git rev-parse --abbrev-ref HEAD)

  printf "\n# ===================================\n# REPOSITORY URL\n# ===================================\n\n**%s**\n" "$repo_url"

  printf "\n# ===================================\n# THE COMMIT HISTORY ON THIS BRANCH\n# ===================================\n\n"
  git cherry -v "$root_branch" "$branch_name" \
    | awk '{print $2}' \
    | while read -r c; do
        git show -s --format="%h %ad %B%n=========================%n" "$c"
      done

  printf "\n\n# ===================================\n# THE LATEST COMMITS ON THE %s BRANCH THAT\n# IT WILL BE MERGED AGAINST.\n# WHEN MAKING YOUR CONSIDERATIONS OF WHAT IS ADDED/FIXED/ETC,\n# IT MIGHT BE WISE TO TAKE INTO ACCOUNT RECENT WORK\n# ON THAT BRANCH FOR CONTEXT.\n# ===================================\n\n" "$root_branch"

  git log "$root_branch" \
          -n 25 --pretty=format:"%h %ad %B%n=========================%n"
} > "$tmp_file"

echo "$tmp_file"

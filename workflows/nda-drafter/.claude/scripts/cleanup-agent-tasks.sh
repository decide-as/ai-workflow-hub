#!/usr/bin/env bash
#
# Clean up stale background agent task output files from /private/tmp.
#
# Claude Code stores agent transcripts in:
#   /private/tmp/claude-501/<project-slug>/<session-id>/tasks/<task-id>.output
#
# These accumulate across sessions and can trigger permission prompts
# from hooks that inspect them. This script removes completed task outputs.
#
# Usage:
#   bash .claude/scripts/cleanup-agent-tasks.sh                 # current session only
#   bash .claude/scripts/cleanup-agent-tasks.sh --all           # all sessions for this project
#   bash .claude/scripts/cleanup-agent-tasks.sh --dry-run       # show what would be deleted
#   bash .claude/scripts/cleanup-agent-tasks.sh --all --dry-run # both flags
#

set -euo pipefail

DRY_RUN=false
ALL_SESSIONS=false

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --all) ALL_SESSIONS=true ;;
    *) echo "Usage: $0 [--all] [--dry-run]" >&2; exit 1 ;;
  esac
done

# Derive the project slug from the main repo root path.
# In a worktree, --show-toplevel returns the worktree, not the main checkout.
# Use the git common dir to find the main repo's .git, then derive the root.
GIT_COMMON=$(git rev-parse --git-common-dir 2>/dev/null || echo "")
if [[ -n "$GIT_COMMON" && "$GIT_COMMON" != ".git" ]]; then
  # Worktree: common dir is <main-repo>/.git — strip /.git to get repo root
  REPO_ROOT=$(cd "$GIT_COMMON/.." && pwd)
else
  REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
fi
PROJECT_SLUG=$(echo "$REPO_ROOT" | sed 's|^/||; s|[/_]|-|g')

# macOS uses /private/tmp, Linux uses /tmp. Claude Code uses the uid.
TASK_BASE=""
for base in "/private/tmp" "/tmp"; do
  candidate="${base}/claude-$(id -u)/-${PROJECT_SLUG}"
  if [[ -d "$candidate" ]]; then
    TASK_BASE="$candidate"
    break
  fi
done

if [[ -z "$TASK_BASE" ]]; then
  echo "[--] No task output directory found for this project"
  exit 0
fi

count=0

if [[ "$ALL_SESSIONS" == true ]]; then
  # Clean all sessions
  for session_dir in "$TASK_BASE"/*/tasks; do
    [[ -d "$session_dir" ]] || continue
    for f in "$session_dir"/*.output; do
      [[ -f "$f" ]] || continue
      if [[ "$DRY_RUN" == true ]]; then
        echo "[dry-run] Would remove: $f"
      else
        rm -f "$f"
      fi
      count=$((count + 1))
    done
    # Remove empty tasks/ dir
    if [[ "$DRY_RUN" == false ]] && [[ -d "$session_dir" ]]; then
      rmdir "$session_dir" 2>/dev/null || true
    fi
  done
  # Remove empty session dirs
  if [[ "$DRY_RUN" == false ]]; then
    for session_dir in "$TASK_BASE"/*/; do
      [[ -d "$session_dir" ]] || continue
      rmdir "$session_dir" 2>/dev/null || true
    done
  fi
else
  # Clean current session only — requires CLAUDE_SESSION_ID
  if [[ -z "${CLAUDE_SESSION_ID:-}" ]]; then
    echo "[!!] CLAUDE_SESSION_ID not set — use --all to clean all sessions"
    exit 1
  fi
  TASKS_DIR="$TASK_BASE/$CLAUDE_SESSION_ID/tasks"
  if [[ ! -d "$TASKS_DIR" ]]; then
    echo "[--] No task outputs for current session"
    exit 0
  fi
  for f in "$TASKS_DIR"/*.output; do
    [[ -f "$f" ]] || continue
    if [[ "$DRY_RUN" == true ]]; then
      echo "[dry-run] Would remove: $f"
    else
      rm -f "$f"
    fi
    count=$((count + 1))
  done
  if [[ "$DRY_RUN" == false ]] && [[ -d "$TASKS_DIR" ]]; then
    rmdir "$TASKS_DIR" 2>/dev/null || true
    rmdir "$TASK_BASE/$CLAUDE_SESSION_ID" 2>/dev/null || true
  fi
fi

if [[ "$DRY_RUN" == true ]]; then
  echo "[--] Would remove $count task output file(s)"
else
  echo "[ok] Removed $count task output file(s)"
fi

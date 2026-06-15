#!/usr/bin/env bash
# lean-claude.sh — Run a Claude CLI call from /tmp to avoid loading any project
# CLAUDE.md, .claude/rules/, or other project context. Useful for small, focused
# tasks (scoring, formatting, classification, extraction) where the full project
# system prompt would waste tokens.
#
# Usage:
#   lean-claude.sh [options] "prompt"
#   echo "context" | lean-claude.sh [options] --stdin "prompt"
#
# Options:
#   -s, --system SYSTEM_PROMPT   Override default system prompt
#                                  (default: "You are a helpful assistant. Return only what is requested, with no explanation.")
#   -m, --model MODEL            Model to use (default: claude-haiku-4-5-20251001)
#   -f, --format FORMAT          Output format: text|json (default: text)
#       --stdin                  Read stdin and prepend it to the prompt as context
#   -h, --help                   Show this help
#
# Models and when to use them:
#   claude-haiku-4-5-20251001  (default) — fastest and cheapest. Use for extraction,
#                              classification, scoring, format conversion, and any task
#                              where the output shape is well-defined and short.
#
#   claude-sonnet-4-6          — balanced speed and reasoning. Use for summarization,
#                              light analysis, structured generation where Haiku
#                              makes mistakes, or multi-step instructions in one shot.
#
#   claude-opus-4-6            — strongest reasoning. Use for ambiguous judgment calls,
#                              nuanced evaluation, complex multi-criteria scoring, or
#                              when output quality matters more than cost/speed.
#
# Examples:
#   lean-claude.sh "Return JSON: {\"ok\":true}"
#   echo '{"score":42}' | lean-claude.sh --stdin "Extract the score value as a plain number"
#   lean-claude.sh --system "You are a JSON scorer." --format json "Score this: foo"
#   lean-claude.sh --model claude-sonnet-4-6 "Summarize in one sentence: ..."

set -euo pipefail

SYSTEM_PROMPT="You are a helpful assistant. Return only what is requested, with no explanation."
MODEL="claude-haiku-4-5-20251001"
FORMAT="text"
READ_STDIN=0
PROMPT=""

usage() {
  grep '^#' "$0" | grep -v '#!/' | sed 's/^# \{0,1\}//'
  exit 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -s|--system)   SYSTEM_PROMPT="$2"; shift 2 ;;
    -m|--model)    MODEL="$2"; shift 2 ;;
    -f|--format)   FORMAT="$2"; shift 2 ;;
    --stdin)       READ_STDIN=1; shift ;;
    -h|--help)     usage ;;
    --)            shift; PROMPT="$*"; break ;;
    -*)            echo "Unknown option: $1" >&2; exit 1 ;;
    *)             PROMPT="${PROMPT}${PROMPT:+ }$1"; shift ;;
  esac
done

if [[ -z "$PROMPT" ]]; then
  echo "Error: prompt is required." >&2
  echo "Usage: lean-claude.sh [options] \"prompt\"" >&2
  exit 1
fi

if [[ "$FORMAT" != "text" && "$FORMAT" != "json" ]]; then
  echo "Error: --format must be 'text' or 'json', got: $FORMAT" >&2
  exit 1
fi

# Build full prompt: optionally prepend stdin context
if [[ "$READ_STDIN" -eq 1 ]]; then
  STDIN_CONTENT=$(cat)
  FULL_PROMPT="${STDIN_CONTENT}

${PROMPT}"
else
  FULL_PROMPT="$PROMPT"
fi

# Verify claude CLI is available before changing directory
command -v claude >/dev/null 2>&1 || { echo "Error: claude CLI not found in PATH" >&2; exit 1; }

# Print model to stderr so it is visible but does not pollute captured output
echo "[lean-claude] model: ${MODEL}" >&2

# Run from /tmp so no project CLAUDE.md or .claude/ directory is picked up.
# --system-prompt replaces the default system prompt entirely.
# --tools "" disables all tool access for speed and safety on lean tasks.
# Prompt is piped via stdin (required by --print mode).
cd /tmp && printf '%s' "$FULL_PROMPT" | exec claude \
  --print \
  --system-prompt "$SYSTEM_PROMPT" \
  --model "$MODEL" \
  --output-format "$FORMAT" \
  --tools ""

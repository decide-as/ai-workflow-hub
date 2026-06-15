#!/usr/bin/env bash
# run-in-venv.sh — Run a command with .venv/bin prepended to PATH.
#
# Usage:
#   bash .claude/scripts/run-in-venv.sh <command> [args...]
#   make venv-run CMD="mypy src/<pkg>/risk_checks.py --warn-unused-ignores"
#
# Examples:
#   bash .claude/scripts/run-in-venv.sh mypy src/<pkg>/scaffold.py
#   bash .claude/scripts/run-in-venv.sh pytest tests/test_metadata.py -v --tb=short
#   bash .claude/scripts/run-in-venv.sh ruff check src/<pkg>/
#
# This script exists so Claude Code never needs to construct
# PATH="$(pwd)/.venv/bin:$PATH" or PATH=".venv/bin:$PATH" prefixes,
# which break the worktree auto-approval hook (subshell expansion
# or unrecognized command prefix).

set -euo pipefail

if [ $# -eq 0 ]; then
    echo "[!!] Usage: run-in-venv.sh <command> [args...]" >&2
    exit 1
fi

# Find .venv relative to the script's working directory
if [ -d ".venv/bin" ]; then
    export PATH=".venv/bin:$PATH"
elif [ -d "$(git rev-parse --show-toplevel 2>/dev/null)/.venv/bin" ]; then
    export PATH="$(git rev-parse --show-toplevel)/.venv/bin:$PATH"
else
    echo "[!!] No .venv/bin found in current directory or repo root" >&2
    exit 1
fi

exec "$@"

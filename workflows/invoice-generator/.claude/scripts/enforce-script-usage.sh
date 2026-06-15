#!/usr/bin/env bash
# enforce-script-usage.sh — PreToolUse hook that blocks manual temp file
# patterns for commits, changelog fragments, and PR bodies. Redirects
# Claude to the correct stdin-based wrapper script.
#
# Blocked patterns and their replacements:
#   mktemp /tmp/commit_msg*     → bash .claude/scripts/commit-staged.sh <<'EOF'
#   cat > /tmp/commit_msg*      → bash .claude/scripts/commit-staged.sh <<'EOF'
#   git commit -F /tmp/*        → bash .claude/scripts/commit-staged.sh <<'EOF'
#   mktemp /tmp/changelog*      → write-changelog-fragment.sh --stdin <<'EOF'
#   cat > /tmp/changelog*       → write-changelog-fragment.sh --stdin <<'EOF'
#   mktemp /tmp/pr_body*        → create-pr.sh --body-stdin <<'EOF'
#   cat > /tmp/pr_body*         → create-pr.sh --body-stdin <<'EOF'
#   gh pr create                → bash .github/scripts/create-pr.sh --body-stdin
#   python3 -c *risk_filter*    → bash .claude/scripts/run-risk-summary.sh
#   for f in docs/prds/prd-*    → bash .claude/scripts/check-active-prds.sh
#   create-pr.sh --body-file    → create-pr.sh --body-stdin
#   PATH=*/.venv/bin:* <cmd>    → bash .claude/scripts/run-in-venv.sh <cmd>
#   source .venv/bin/activate   → bash .claude/scripts/run-in-venv.sh <cmd>
#   python3 -c *import yaml*    → bash .claude/scripts/read-project-meta.sh <fields>
#   python3 -c *pr-cache*       → bash .claude/scripts/write-pr-cache.sh <file>
#   python3 -c *write_text*     → bash .claude/scripts/write-pr-cache.sh <file>
#   python3 -c *coverage.json*  → bash .claude/scripts/read-coverage-percent.sh
#   python3 -c *README*replace* → bash .claude/scripts/update-coverage-badge.sh
#   make update-analytics-stats → make refresh-stats  (for staleness; full audit requires explicit user request)
#
# All pattern matching uses cmd_prefix (the command text before any heredoc
# delimiter) to prevent false positives from heredoc content that mentions
# blocked keywords.
#
# Exit codes:
#   0 — allow (no match or not a Bash tool call)
#   2 — block with guidance message
#
# Stdin: JSON from Claude Code hook system

set -euo pipefail

input=$(cat)

# Require jq; fall through if unavailable.
if ! command -v jq &>/dev/null; then
    exit 0
fi

command=$(echo "$input" | jq -r '.tool_input.command // empty')
if [ -z "$command" ]; then
    exit 0
fi

# Extract the command prefix before any heredoc delimiter (<<'EOF', <<EOF, etc.)
# This prevents false positives from heredoc content mentioning blocked patterns.
# Uses pure bash to avoid SIGPIPE issues with pipefail when command is multi-line.
first_line="${command%%$'\n'*}"
cmd_prefix="${first_line%%<<*}"
if [ -z "$cmd_prefix" ]; then
    cmd_prefix="$first_line"
fi

# --- Pattern: mktemp /tmp/commit_msg* ---
if [[ "$cmd_prefix" == *"mktemp /tmp/commit_msg"* ]] || [[ "$cmd_prefix" == *"mktemp"*"commit_msg"* ]]; then
    echo "BLOCKED: Do not create temp files for commit messages."
    echo ""
    echo "Use the stdin-based wrapper instead:"
    echo ""
    echo "  bash .claude/scripts/commit-staged.sh <<'EOF'"
    echo "  TLA Short summary"
    echo ""
    echo "  Description of changes:"
    echo "  - What changed and why"
    echo "  EOF"
    echo ""
    echo "See .claude/rules/04-git.md Step 3."
    exit 2
fi

# --- Pattern: cat > /tmp/commit_msg* (writing to temp commit msg file) ---
if [[ "$cmd_prefix" == *"cat"*"/tmp/commit_msg"* ]] || [[ "$cmd_prefix" == *"cat"*"/tmp/commit_message"* ]]; then
    echo "BLOCKED: Do not write commit messages to temp files."
    echo ""
    echo "Use the stdin-based wrapper instead:"
    echo ""
    echo "  bash .claude/scripts/commit-staged.sh <<'EOF'"
    echo "  TLA Short summary"
    echo "  EOF"
    echo ""
    echo "See .claude/rules/04-git.md Step 3."
    exit 2
fi

# --- Pattern: git commit -F /tmp/* ---
if [[ "$cmd_prefix" == *"git commit -F /tmp/"* ]] || [[ "$cmd_prefix" == *"git commit -F \"/tmp/"* ]]; then
    echo "BLOCKED: Do not use 'git commit -F' with temp files."
    echo ""
    echo "Use the stdin-based wrapper instead:"
    echo ""
    echo "  bash .claude/scripts/commit-staged.sh <<'EOF'"
    echo "  TLA Short summary"
    echo "  EOF"
    echo ""
    echo "See .claude/rules/04-git.md Step 3."
    exit 2
fi

# --- Pattern: mktemp /tmp/changelog* ---
if [[ "$cmd_prefix" == *"mktemp /tmp/changelog"* ]] || [[ "$cmd_prefix" == *"mktemp"*"changelog"* ]]; then
    echo "BLOCKED: Do not create temp files for changelog fragments."
    echo ""
    echo "Use the stdin-based wrapper instead:"
    echo ""
    echo "  bash .claude/scripts/write-changelog-fragment.sh \"<branch>\" --stdin --bump <type> <<'EOF'"
    echo "  ### Added"
    echo "  - Description"
    echo "  EOF"
    echo ""
    echo "See PR SKILL.md Step 5."
    exit 2
fi

# --- Pattern: cat > /tmp/changelog* (writing to temp changelog file) ---
if [[ "$cmd_prefix" == *"cat"*"/tmp/changelog"* ]]; then
    echo "BLOCKED: Do not write changelog fragments to temp files."
    echo ""
    echo "Use the stdin-based wrapper instead:"
    echo ""
    echo "  bash .claude/scripts/write-changelog-fragment.sh \"<branch>\" --stdin --bump <type> <<'EOF'"
    echo "  ### Added"
    echo "  - Description"
    echo "  EOF"
    echo ""
    echo "See PR SKILL.md Step 5."
    exit 2
fi

# --- Pattern: mktemp /tmp/pr_body* ---
if [[ "$cmd_prefix" == *"mktemp /tmp/pr_body"* ]] || [[ "$cmd_prefix" == *"mktemp"*"pr_body"* ]]; then
    echo "BLOCKED: Do not create temp files for PR descriptions."
    echo ""
    echo "Use the stdin-based wrapper instead:"
    echo ""
    echo "  bash .github/scripts/create-pr.sh --title \"<title>\" --body-stdin <<'EOF'"
    echo "  <PR description here>"
    echo "  EOF"
    echo ""
    echo "See PR SKILL.md Step 9."
    exit 2
fi

# --- Pattern: cat > /tmp/pr_body* (writing to temp PR body file) ---
if [[ "$cmd_prefix" == *"cat"*"/tmp/pr_body"* ]]; then
    echo "BLOCKED: Do not write PR descriptions to temp files."
    echo ""
    echo "Use the stdin-based wrapper instead:"
    echo ""
    echo "  bash .github/scripts/create-pr.sh --title \"<title>\" --body-stdin <<'EOF'"
    echo "  <PR description here>"
    echo "  EOF"
    echo ""
    echo "See PR SKILL.md Step 9."
    exit 2
fi

# --- Pattern: gh pr create (direct, bypassing create-pr.sh) ---
# Allow "gh pr checks", "gh pr merge", "gh pr view", etc. — only block "gh pr create".
if [[ "$cmd_prefix" == *"gh pr create"* ]] && [[ "$cmd_prefix" != *"create-pr.sh"* ]]; then
    echo "BLOCKED: Do not call 'gh pr create' directly."
    echo ""
    echo "Use the validated wrapper instead:"
    echo ""
    echo "  bash .github/scripts/create-pr.sh --title \"<title>\" --body-stdin <<'EOF'"
    echo "  <PR description here>"
    echo "  EOF"
    echo ""
    echo "The wrapper validates the PR description before creating. See PR SKILL.md Step 9."
    exit 2
fi

# --- Pattern: make update-analytics-stats (full LLM re-evaluation misused as freshness fix) ---
# Allow only when the user has explicitly requested a full audit in their message.
# Stale STATS/PLOT markers are fixed by `make refresh-stats` — no LLM needed.
if [[ "$cmd_prefix" == *"update-analytics-stats"* ]]; then
    echo "BLOCKED: Do not run 'make update-analytics-stats' to fix staleness failures."
    echo ""
    echo "This re-evaluates the ENTIRE test suite via LLM (~15 min, expensive)."
    echo ""
    echo "For stale STATS/PLOT markers (test_all_stats_are_fresh, check-stats):"
    echo "  make refresh-stats        ← correct fix, no LLM calls"
    echo ""
    echo "For new/edited test functions (test_analytics_sync, body hash drift):"
    echo "  python scripts/evaluate_test_file.py <file>   ← evaluates one file"
    echo "  make test-analytics                           ← drains the queue"
    echo ""
    echo "Only run 'make update-analytics-stats' when the user explicitly asks"
    echo "for a full re-evaluation audit of all tests."
    exit 2
fi

# --- Pattern: python3 -c with risk_filter (inline risk summary) ---
if [[ "$cmd_prefix" == *"python3 -c"* ]] && [[ "$cmd_prefix" == *"risk_filter"* ]]; then
    echo "BLOCKED: Do not inline risk filter Python code."
    echo ""
    echo "Use the wrapper script instead:"
    echo ""
    echo "  bash .claude/scripts/run-risk-summary.sh"
    echo ""
    echo "See PR SKILL.md Step 7."
    exit 2
fi

# --- Pattern: inline PRD check loop (for f in docs/prds/prd-*) ---
if [[ "$cmd_prefix" == *"for f in"*"docs/prds/prd-"* ]] || [[ "$cmd_prefix" == *"for f in"*"docs/prds/"*".md"* ]]; then
    echo "BLOCKED: Do not inline PRD check loops."
    echo ""
    echo "Use the wrapper script instead:"
    echo ""
    echo "  bash .claude/scripts/check-active-prds.sh"
    echo ""
    echo "See PR SKILL.md Step 7."
    exit 2
fi

# --- Pattern: create-pr.sh --body-file (should use --body-stdin) ---
if [[ "$cmd_prefix" == *"create-pr.sh"*"--body-file"* ]]; then
    echo "BLOCKED: Do not use --body-file with create-pr.sh."
    echo ""
    echo "Use --body-stdin instead to pipe content directly:"
    echo ""
    echo "  bash .github/scripts/create-pr.sh --title \"<title>\" --body-stdin <<'EOF'"
    echo "  <PR description here>"
    echo "  EOF"
    echo ""
    echo "See PR SKILL.md Step 9."
    exit 2
fi

# --- Pattern: PATH=*/.venv/bin:$PATH (PATH manipulation to reach venv tools) ---
if [[ "$cmd_prefix" == *"PATH="*".venv/bin:"* ]]; then
    echo "BLOCKED: Do not use PATH manipulation to reach venv tools."
    echo ""
    echo "Use the wrapper script instead:"
    echo ""
    echo "  bash .claude/scripts/run-in-venv.sh <command> [args...]"
    echo "  make venv-run CMD=\"<command> [args...]\""
    echo ""
    echo "Examples:"
    echo "  bash .claude/scripts/run-in-venv.sh mypy src/<pkg>/scaffold.py"
    echo "  make venv-run CMD=\"pytest tests/ -v --tb=short\""
    echo ""
    echo "See CLAUDE.md Dev utilities table."
    exit 2
fi

# --- Pattern: source .venv/bin/activate (unnecessary venv activation before scripts) ---
if [[ "$cmd_prefix" == *"source"*".venv/bin/activate"* ]]; then
    echo "BLOCKED: Do not source .venv/bin/activate before running scripts."
    echo ""
    echo "Scripts handle their own PATH. Run them directly, or use:"
    echo ""
    echo "  bash .claude/scripts/run-in-venv.sh <command> [args...]"
    echo ""
    echo "See CLAUDE.md Dev utilities table."
    exit 2
fi

# --- Pattern: python3 -c with yaml + project-meta (inline metadata reads) ---
if [[ "$cmd_prefix" == *"python3 -c"* ]] && [[ "$cmd_prefix" == *"yaml"* ]] && [[ "$cmd_prefix" == *"project-meta"* ]]; then
    echo "BLOCKED: Do not inline Python to read project-meta.yaml."
    echo ""
    echo "Use the wrapper script instead:"
    echo ""
    echo "  bash .claude/scripts/read-project-meta.sh <field> [field...]"
    echo "  make read-meta FIELDS=\"<field> [field...]\""
    echo ""
    echo "Examples:"
    echo "  bash .claude/scripts/read-project-meta.sh language phase branching_complexity"
    echo "  make read-meta FIELDS=\"language phase\""
    echo ""
    echo "See CLAUDE.md Dev utilities table."
    exit 2
fi

# --- Pattern: python3 -c writing to .pr-cache/ (inline cache writes) ---
if [[ "$cmd_prefix" == *"python3 -c"* ]] && { [[ "$cmd_prefix" == *"pr-cache"* ]] || [[ "$cmd_prefix" == *".pr-cache"* ]] || [[ "$cmd_prefix" == *"write_text"* ]]; }; then
    echo "BLOCKED: Do not use python3 -c to write PR cache files."
    echo ""
    echo "Use the stdin-based wrapper instead:"
    echo ""
    echo "  bash .claude/scripts/write-pr-cache.sh <filename> <<'EOF'"
    echo "  ### Risk Assessment"
    echo "  **Phase:** alpha | **Tier:** basic"
    echo "  EOF"
    echo ""
    echo "Supported filenames: risk.md, review.md, diff-review.md, coverage.md"
    exit 2
fi

# --- Pattern: python3 -c reading coverage.json ---
if [[ "$cmd_prefix" == *"python3 -c"* ]] && [[ "$cmd_prefix" == *"coverage.json"* ]]; then
    echo "BLOCKED: Do not use python3 -c to read coverage.json."
    echo ""
    echo "Use the wrapper script instead:"
    echo ""
    echo "  bash .claude/scripts/read-coverage-percent.sh [coverage.json]"
    echo ""
    echo "Output: the coverage percentage (e.g., '77')."
    exit 2
fi

# --- Pattern: python3 -c editing README badge ---
if [[ "$cmd_prefix" == *"python3 -c"* ]] && [[ "$cmd_prefix" == *"README"* ]] && [[ "$cmd_prefix" == *"replace"* ]]; then
    echo "BLOCKED: Do not use python3 -c to update README badges."
    echo ""
    echo "Use the wrapper script instead:"
    echo ""
    echo "  bash .claude/scripts/update-coverage-badge.sh"
    echo ""
    echo "The script runs coverage and updates the badge automatically."
    echo "Or use the Edit tool to modify README.md directly."
    exit 2
fi

# --- Pattern: python3 -c editing source files (should use Edit tool) ---
if [[ "$cmd_prefix" == *"python3 -c"* ]] && [[ "$cmd_prefix" == *"import re"* ]] && [[ "$cmd_prefix" == *".py"* ]]; then
    echo "BLOCKED: Do not use python3 -c to edit source files."
    echo ""
    echo "Use the Edit tool (Claude Code built-in) instead."
    echo "The Edit tool is pre-approved, supports targeted replacements,"
    echo "and shows clear diffs for review."
    exit 2
fi

# No match — allow
exit 0

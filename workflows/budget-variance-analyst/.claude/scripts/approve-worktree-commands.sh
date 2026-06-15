#!/usr/bin/env bash
# approve-worktree-commands.sh — Global PreToolUse hook that auto-approves
# Bash commands targeting a registered worktree, but ONLY if every segment
# of the command matches an allowed Bash(...) pattern from the project's settings.
#
# Handles two patterns:
#   1. cd <worktree-path> && <command>   (Claude Code's worktree prefix)
#   2. <command> <worktree-path>/...     (direct path references)
#
# Security hardening:
#   - Splits piped/chained commands (|, &&, ||, ;) and validates each segment
#   - Rejects subshell expansions ($(), backticks, process substitution)
#   - Strips I/O redirections before matching
#
# Registry: <project-root>/.claude/worktree-paths.txt (one path per line).

set -euo pipefail

# --- Helper: strip I/O redirections from a command segment ---
strip_redirections() {
    local seg="$1"
    # Remove: N>>file, N>&M, N>file, <file (with optional spaces after operator)
    seg=$(printf '%s' "$seg" | sed -E \
        's/[0-9]*>>[[:space:]]*[^[:space:]|;&]*//g' \
    | sed -E \
        's/[0-9]*>&[0-9]+//g' \
    | sed -E \
        's/[0-9]*>[[:space:]]*[^[:space:]|;&]*//g' \
    | sed -E \
        's/<[[:space:]]*[^[:space:]|;&]*//g')
    # Trim leading/trailing whitespace
    seg="${seg#"${seg%%[![:space:]]*}"}"
    seg="${seg%"${seg##*[![:space:]]}"}"
    printf '%s' "$seg"
}

# --- Helper: split command on unquoted shell operators (|, &&, ||, ;) ---
# Outputs one segment per line. Tracks quote state and $() nesting depth
# so operators inside subshell expansions are not treated as split points.
split_on_shell_operators() {
    local cmd="$1"
    local current="" in_single=0 in_double=0 paren_depth=0 i=0 len=${#cmd}

    while (( i < len )); do
        local ch="${cmd:i:1}"

        # Quote tracking
        if (( !in_single )) && [[ "$ch" == '"' ]]; then
            in_double=$(( 1 - in_double ))
            current+="$ch"
            (( i++ )) || true
            continue
        fi
        if (( !in_double )) && [[ "$ch" == "'" ]]; then
            in_single=$(( 1 - in_single ))
            current+="$ch"
            (( i++ )) || true
            continue
        fi

        # Subshell nesting: track $( and ) outside quotes
        if (( !in_single && !in_double )); then
            if [[ "${cmd:i:2}" == '$(' ]]; then
                (( paren_depth++ )) || true
                current+='$('
                (( i += 2 )) || true
                continue
            fi
            if [[ "$ch" == ")" ]] && (( paren_depth > 0 )); then
                (( paren_depth-- )) || true
                current+="$ch"
                (( i++ )) || true
                continue
            fi
        fi

        # Only split when outside quotes AND outside subshell expansions
        if (( !in_single && !in_double && paren_depth == 0 )); then
            # Check for && or ||
            if [[ "${cmd:i:2}" == "&&" ]] || [[ "${cmd:i:2}" == "||" ]]; then
                printf '%s\n' "$current"
                current=""
                (( i += 2 )) || true
                continue
            fi
            # Check for | or ;
            if [[ "$ch" == "|" ]] || [[ "$ch" == ";" ]]; then
                printf '%s\n' "$current"
                current=""
                (( i++ )) || true
                continue
            fi
        fi

        current+="$ch"
        (( i++ )) || true
    done
    printf '%s\n' "$current"
}

# --- Read the command from hook JSON on stdin ---
input=$(cat)

# Require jq; fall through if unavailable.
if ! command -v jq &>/dev/null; then
    exit 0
fi

command=$(echo "$input" | jq -r '.tool_input.command // empty')
if [ -z "$command" ]; then
    exit 0
fi

# --- Find project root and registry ---
repo_root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [ -z "$repo_root" ]; then
    exit 0
fi

registry="${repo_root}/.claude/worktree-paths.txt"
if [ ! -f "$registry" ]; then
    exit 0
fi

# --- Determine the command to validate ---
inner_command=""

# Pattern 1: cd <path> && <rest>
if [[ "$command" =~ ^cd[[:space:]]+(\"([^\"]+)\"|([^[:space:]&]+))[[:space:]]+\&\&[[:space:]]+(.*) ]]; then
    target_dir="${BASH_REMATCH[2]:-${BASH_REMATCH[3]}}"
    # Resolve relative paths to absolute for registry lookup
    if [ -d "$target_dir" ]; then
        target_dir="$(cd "$target_dir" && pwd)"
    fi
    if grep -qxF "$target_dir" "$registry" || [ "$target_dir" = "$repo_root" ]; then
        inner_command="${BASH_REMATCH[4]}"
    fi
fi

# Pattern 2: command references a registered worktree path directly
if [ -z "$inner_command" ]; then
    while IFS= read -r wt_path; do
        [ -z "$wt_path" ] && continue
        if [[ "$command" == *"$wt_path"* ]]; then
            inner_command="$command"
            break
        fi
    done < "$registry"
fi

if [ -z "$inner_command" ]; then
    exit 0
fi

# --- Collect allowed Bash(...) patterns from project settings ---
patterns=""
for settings_file in "${repo_root}/.claude/settings.json" "${repo_root}/.claude/settings.local.json"; do
    if [ -f "$settings_file" ]; then
        file_patterns=$(jq -r '.permissions.allow // [] | .[]' "$settings_file" 2>/dev/null \
            | grep '^Bash(' \
            | sed 's/^Bash(//;s/)$//' \
            || true)
        if [ -n "$file_patterns" ]; then
            if [ -n "$patterns" ]; then
                patterns="${patterns}"$'\n'"${file_patterns}"
            else
                patterns="$file_patterns"
            fi
        fi
    fi
done

if [ -z "$patterns" ]; then
    exit 0
fi

# --- Phase A: Reject subshell expansions (cannot validate statically) ---
# Only check the command portion before any heredoc delimiter, since heredoc
# body content is user data (commit messages, changelog entries) that may
# legitimately contain $() syntax in prose.
heredoc_prefix="${inner_command%%$'\n'*}"
heredoc_prefix="${heredoc_prefix%%<<*}"
if [ -z "$heredoc_prefix" ]; then
    heredoc_prefix="${inner_command%%$'\n'*}"
fi

# Phase A0: Strip variable-assignment segments before the subshell check.
# VAR=$(cmd) is safe — the $() assigns to a variable, it cannot inject into
# other commands. Split on && and remove segments that are pure assignments
# (NAME=...) so they don't trigger the blanket $( rejection.
phase_a_check="$heredoc_prefix"
phase_a_stripped=""
while IFS= read -r _a0_seg; do
    _a0_seg="${_a0_seg#"${_a0_seg%%[![:space:]]*}"}"
    _a0_seg="${_a0_seg%"${_a0_seg##*[![:space:]]}"}"
    [ -z "$_a0_seg" ] && continue
    if [[ "$_a0_seg" =~ ^[A-Za-z_][A-Za-z_0-9]*= ]]; then
        continue  # Variable assignment — safe, skip it
    fi
    phase_a_stripped="$phase_a_stripped $_a0_seg"
done <<< "${phase_a_check//&&/$'\n'}"

if [[ "$phase_a_stripped" == *'$('* ]] || [[ "$phase_a_stripped" == *'`'* ]] \
    || [[ "$phase_a_stripped" == *'<('* ]] || [[ "$phase_a_stripped" == *'>('* ]]; then
    exit 0
fi

# --- Phase A2: Strip heredoc body before splitting ---
# Heredoc bodies (<<'EOF' ... EOF or <<EOF ... EOF) contain user data like
# commit messages and changelog entries. These may include shell operators
# (|, ;, &&) in prose (e.g., "str | None") that would confuse the splitter.
# Strip heredoc bodies so only the command portion is validated.
strip_command="$inner_command"
if [[ "$inner_command" == *'<<'* ]]; then
    # Extract the first line (command with <<DELIM) and discard the rest (body)
    first_line="${inner_command%%$'\n'*}"
    strip_command="$first_line"
    # Remove the heredoc redirection itself (<<'EOF', <<"EOF", <<EOF)
    strip_command=$(printf '%s' "$strip_command" | sed -E "s/<<-?[[:space:]]*['\"]?[A-Za-z_]+['\"]?//g")
fi

# --- Phase B+C: Split into segments, strip redirections, match every segment ---
segments=$(split_on_shell_operators "$strip_command")

all_match=true
while IFS= read -r segment; do
    # Trim whitespace
    segment="${segment#"${segment%%[![:space:]]*}"}"
    segment="${segment%"${segment##*[![:space:]]}"}"
    [ -z "$segment" ] && continue

    # Strip I/O redirections
    segment=$(strip_redirections "$segment")
    [ -z "$segment" ] && continue

    # Phase D: Allow bare variable assignments (e.g., PR_NUMBER=150, GATE=strict).
    # These cannot execute code. Subshell expansions in values were already
    # validated by Phase A0 (assignment values with $() are safe). Only match
    # NAME=VALUE where the entire segment is a simple assignment — not
    # "NAME=VALUE command" (env prefix).
    if [[ "$segment" =~ ^[A-Za-z_][A-Za-z_0-9]*= ]]; then
        # Extract everything after the first =
        local_value="${segment#*=}"
        # Strip surrounding quotes if present
        local_value="${local_value%\"}"
        local_value="${local_value#\"}"
        local_value="${local_value%\'}"
        local_value="${local_value#\'}"
        # Allow $(...) command substitution as the value — Phase A0 already
        # validated that $() inside assignments is safe. The whole $(...)
        # expression is a single value, even if it contains spaces.
        if [[ "$local_value" =~ ^\$\(.*\)$ ]]; then
            continue
        fi
        # Safe if the value contains no unquoted spaces (which would mean
        # "VAR=value command" — an env-prefix execution, not a bare assignment)
        if [[ ! "$local_value" =~ [[:space:]] ]]; then
            continue
        fi
    fi

    seg_matched=false
    while IFS= read -r pattern; do
        # shellcheck disable=SC2053
        if [[ "$segment" == $pattern ]]; then
            seg_matched=true
            break
        fi
    done <<< "$patterns"

    if [[ "$seg_matched" != true ]]; then
        all_match=false
        break
    fi
done <<< "$segments"

if [[ "$all_match" == true ]]; then
    echo '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow"}}'
    exit 0
fi

# No match — let the normal permission system handle it.
exit 0

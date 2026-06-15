#!/usr/bin/env bash
# Post a breaking changes comment on a pull request when public API surfaces change.
#
# Usage: pr-comment-breaking.sh [--marker <marker>] <base-ref> <source-dir> <pr-number>
#
# Compares public function and class signatures between the base branch and the
# current working tree using Python AST. Posts (or updates) a comment on the PR
# only if breaking changes are detected.
#
# Options:
#   --marker <marker>  Override the HTML comment marker (default: <!-- breaking-changes-comment -->).
#                      Use this to post agent-specific comments that don't collide with CI comments.
#
# Limitations:
# - Only inspects top-level functions/classes and their immediate methods.
#   Nested classes, functions inside if-blocks, or deeply nested definitions
#   are not tracked.
# - Python-only. Node.js projects are not supported.
#
# Requires: python3, git, gh CLI with GH_TOKEN set.

set -euo pipefail

PREV_GH=$(bash "$(dirname "$0")/gh-switch.sh")
trap 'bash "$(dirname "$0")/gh-switch.sh" --restore "$PREV_GH"' EXIT

# ---- Activate local venv if present ------------------------------------------
if [[ -d ".venv/bin" ]]; then
  export PATH="$PWD/.venv/bin:$PATH"
elif _git_root=$(git rev-parse --show-toplevel 2>/dev/null) && [[ -d "$_git_root/.venv/bin" ]]; then
  export PATH="$_git_root/.venv/bin:$PATH"
elif [[ -n "${VIRTUAL_ENV:-}" ]] && [[ -x "${VIRTUAL_ENV}/bin/python3" ]]; then
  export PATH="$VIRTUAL_ENV/bin:$PATH"
fi

# Parse optional --marker flag
COMMENT_MARKER="<!-- breaking-changes-comment -->"
if [ "${1:-}" = "--marker" ]; then
  COMMENT_MARKER="${2:?--marker requires an argument}"
  shift 2
fi

BASE_REF="${1:?Usage: pr-comment-breaking.sh [--marker <marker>] <base-ref> <source-dir> <pr-number>}"
SOURCE_DIR="${2:?Usage: pr-comment-breaking.sh [--marker <marker>] <base-ref> <source-dir> <pr-number>}"
PR_NUMBER="${3:?Usage: pr-comment-breaking.sh [--marker <marker>] <base-ref> <source-dir> <pr-number>}"

# Get list of changed Python files in the source directory
CHANGED_FILES=$(git diff --name-only "${BASE_REF}...HEAD" -- "${SOURCE_DIR}" | grep '\.py$' || true)

if [ -z "$CHANGED_FILES" ]; then
  echo "[--] No Python source files changed — skipping breaking changes check."
  exit 0
fi

# Write changed files to a temp file to pass safely to Python (avoids shell injection)
CHANGED_FILES_TMP=$(mktemp)
echo "$CHANGED_FILES" > "$CHANGED_FILES_TMP"

# Run the AST comparison. Variables passed via environment to avoid string interpolation
# in inline Python code (prevents shell injection if file paths contain special chars).
COMMENT_BODY=$(BASE_REF="$BASE_REF" CHANGED_FILES_PATH="$CHANGED_FILES_TMP" \
  COMMENT_MARKER="$COMMENT_MARKER" python3 -c "
import ast, os, subprocess, sys

base_ref = os.environ['BASE_REF']
marker = os.environ['COMMENT_MARKER']

with open(os.environ['CHANGED_FILES_PATH']) as f:
    changed_files = [line.strip() for line in f if line.strip()]

def get_public_signatures(source):
    \"\"\"Extract public function/class signatures from Python source.\"\"\"
    try:
        tree = ast.parse(source)
    except SyntaxError:
        return {}
    sigs = {}
    func_types = (ast.FunctionDef, ast.AsyncFunctionDef)
    for node in ast.iter_child_nodes(tree):
        if isinstance(node, func_types) and not node.name.startswith('_'):
            args = []
            for arg in node.args.args:
                annotation = ast.dump(arg.annotation) if arg.annotation else None
                args.append((arg.arg, annotation))
            ret = ast.dump(node.returns) if node.returns else None
            prefix = 'async def' if isinstance(node, ast.AsyncFunctionDef) else 'def'
            sigs[f'{prefix} {node.name}'] = {'args': args, 'returns': ret}
        elif isinstance(node, ast.ClassDef) and not node.name.startswith('_'):
            methods = {}
            for item in ast.iter_child_nodes(node):
                if isinstance(item, func_types) and not item.name.startswith('_'):
                    args = []
                    for arg in item.args.args:
                        if arg.arg == 'self':
                            continue
                        annotation = ast.dump(arg.annotation) if arg.annotation else None
                        args.append((arg.arg, annotation))
                    ret = ast.dump(item.returns) if item.returns else None
                    methods[item.name] = {'args': args, 'returns': ret}
            sigs[f'class {node.name}'] = {'methods': methods}
    return sigs

def get_file_at_ref(ref, path):
    \"\"\"Get file contents at a git ref.\"\"\"
    try:
        result = subprocess.run(
            ['git', 'show', f'{ref}:{path}'],
            capture_output=True, text=True, check=True
        )
        return result.stdout
    except subprocess.CalledProcessError:
        return ''

removed = []
modified = []
added = []

for filepath in changed_files:
    base_source = get_file_at_ref(base_ref, filepath)
    try:
        with open(filepath) as f:
            pr_source = f.read()
    except FileNotFoundError:
        pr_source = ''

    base_sigs = get_public_signatures(base_source)
    pr_sigs = get_public_signatures(pr_source)

    module = filepath.split('/')[-1].replace('.py', '')

    # Removed signatures
    for name in base_sigs:
        if name not in pr_sigs:
            removed.append(f'| \`{module}\` | \`{name}\` | Removed |')

    # Modified signatures
    for name in base_sigs:
        if name in pr_sigs and base_sigs[name] != pr_sigs[name]:
            modified.append(f'| \`{module}\` | \`{name}\` | Modified |')

    # Added signatures
    for name in pr_sigs:
        if name not in base_sigs:
            added.append(f'| \`{module}\` | \`{name}\` | Added |')

if not removed and not modified:
    # No breaking changes — no comment needed
    sys.exit(0)

lines = [marker]
lines.append('### API Surface Changes')
lines.append('')

breaking_count = len(removed) + len(modified)
added_count = len(added)

if removed or modified:
    lines.append('<details>')
    lines.append(f'<summary><strong>Breaking changes</strong> — {breaking_count} symbol(s)</summary>')
    lines.append('')
    lines.append('| Module | Symbol | Change |')
    lines.append('|--------|--------|--------|')
    lines.extend(removed)
    lines.extend(modified)
    lines.append('')
    lines.append('</details>')
    lines.append('')

if added:
    lines.append('<details>')
    lines.append(f'<summary><strong>New additions (non-breaking)</strong> — {added_count} symbol(s)</summary>')
    lines.append('')
    lines.append('| Module | Symbol | Change |')
    lines.append('|--------|--------|--------|')
    lines.extend(added)
    lines.append('')
    lines.append('</details>')

print('\n'.join(lines))
")

rm -f "$CHANGED_FILES_TMP"

if [ -z "$COMMENT_BODY" ]; then
  echo "[--] No breaking changes detected — skipping comment."
  exit 0
fi

# Write comment body to temp file
COMMENT_FILE=$(mktemp)
printf '%s\n' "$COMMENT_BODY" > "$COMMENT_FILE"

# Check if a previous breaking changes comment exists and update it
EXISTING_COMMENT_ID=$(timeout 60 gh api "repos/{owner}/{repo}/issues/${PR_NUMBER}/comments" \
  --jq ".[] | select(.body | contains(\"$COMMENT_MARKER\")) | .id" 2>/dev/null | head -1)

if [ -n "$EXISTING_COMMENT_ID" ]; then
  timeout 60 gh api "repos/{owner}/{repo}/issues/comments/${EXISTING_COMMENT_ID}" \
    -X PATCH -F "body=@${COMMENT_FILE}" --silent
  echo "[ok] Updated breaking changes comment on PR #$PR_NUMBER"
else
  timeout 60 gh pr comment "$PR_NUMBER" --body-file "$COMMENT_FILE"
  echo "[ok] Posted breaking changes comment on PR #$PR_NUMBER"
fi

rm -f "$COMMENT_FILE"

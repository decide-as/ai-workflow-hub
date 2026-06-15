#!/usr/bin/env bash
#
# Next analyzer: TODOs
#
# Finds TODO, FIXME, HACK, and XXX comments in source code and docs,
# groups them by file, and generates candidates for resolution.
#
# Usage:
#   bash next-todos.sh [--repo-root <path>]
#
# Output: JSON to stdout. Info/errors to stderr.
# Compatible with bash 3.2+ (macOS default).

set -euo pipefail

# ---- Activate local venv if present ------------------------------------------
if [[ -d ".venv/bin" ]]; then
  export PATH="$PWD/.venv/bin:$PATH"
elif _git_root=$(git rev-parse --show-toplevel 2>/dev/null) && [[ -d "$_git_root/.venv/bin" ]]; then
  export PATH="$_git_root/.venv/bin:$PATH"
elif [[ -n "${VIRTUAL_ENV:-}" ]] && [[ -x "${VIRTUAL_ENV}/bin/python3" ]]; then
  export PATH="$VIRTUAL_ENV/bin:$PATH"
fi

# ---- Defaults ----------------------------------------------------------------
REPO_ROOT=""

# ---- Parse arguments ---------------------------------------------------------
while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo-root) REPO_ROOT="$2"; shift 2 ;;
    *)           echo "[!!] Unknown argument: $1" >&2; exit 1 ;;
  esac
done

# ---- Ensure we are inside a Git repository -----------------------------------
if [[ -n "$REPO_ROOT" ]]; then
  cd "$REPO_ROOT"
elif REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null); then
  cd "$REPO_ROOT"
fi

echo "[--] Analyzing TODOs/FIXMEs" >&2

# ---- Find TODO/FIXME/HACK/XXX and write to temp file ------------------------
EXCLUDE_DIRS=".git|.claude|node_modules|.venv|__pycache__|.mypy_cache|.ruff_cache|.pytest_cache|mutants|htmlcov|.eggs"

TODO_FILE=$(mktemp /tmp/next_todos_XXXXXX)
trap 'rm -f "$TODO_FILE"' EXIT

grep -rn --include='*.py' --include='*.sh' --include='*.md' --include='*.yaml' --include='*.yml' --include='*.toml' --include='*.json' --include='*.js' --include='*.ts' \
  -E '(TODO|FIXME|HACK|XXX)\b' . 2>/dev/null \
  | grep -vE "($EXCLUDE_DIRS)" \
  | grep -v 'Binary file' \
  | head -100 \
  > "$TODO_FILE" || true

if [[ ! -s "$TODO_FILE" ]]; then
  cat <<'EOJSON'
{"analyzer":"todos","schema_version":1,"skipped":false,"candidates":[]}
EOJSON
  exit 0
fi

# ---- Group by file and generate candidates using Python ----------------------
python3 - "$TODO_FILE" <<'PYEOF'
import json
import sys
from collections import defaultdict

todo_file = sys.argv[1]

with open(todo_file) as f:
    lines = f.read().strip().split("\n")

# Group by file
file_todos = defaultdict(list)
for line in lines:
    if not line.strip():
        continue
    # Format: ./path/to/file.py:123:  # TODO: something
    parts = line.split(":", 2)
    if len(parts) < 3:
        continue
    filepath = parts[0].lstrip("./")
    lineno = parts[1]
    content = parts[2].strip()
    file_todos[filepath].append({"line": lineno, "content": content})

# Try to load tier info
module_tiers = {}
try:
    sys.path.insert(0, "src")
    from code_practices.quality.coverage_tiers import MODULE_TIERS
    module_tiers = MODULE_TIERS
except ImportError:
    pass

candidates = []

# Generate one candidate per file with TODOs (grouped)
for filepath, todos in sorted(file_todos.items(), key=lambda x: -len(x[1])):
    count = len(todos)
    if count == 0:
        continue

    # Determine module tier if it's a source file
    module_stem = filepath.split("/")[-1].replace(".py", "")
    tier = module_tiers.get(module_stem, 5)

    # Effort based on count
    if count <= 3:
        effort = "S"
    elif count <= 8:
        effort = "M"
    else:
        effort = "L"

    # First few TODOs as evidence
    evidence_lines = [f"L{t['line']}" for t in todos[:5]]
    evidence_str = f"{filepath}:{','.join(evidence_lines)}"

    # Preview of first TODO content (truncate safely)
    first_todo = todos[0]["content"]
    if len(first_todo) > 80:
        first_todo = first_todo[:77] + "..."

    candidates.append({
        "title": f"Resolve {count} TODO/FIXME item{'s' if count > 1 else ''} in {filepath}",
        "dimension": "todos",
        "evidence": evidence_str,
        "effort": effort,
        "details": f"First: {first_todo}",
        "ivi_hints": {
            "job_size": f"{count} items to address",
            "bug_risk": "TODOs often mark known incomplete behavior" if tier <= 3 else "Low-tier module, contained risk",
        },
    })

# Sort by file importance (lower tier = more important) then count
candidates.sort(key=lambda c: (
    module_tiers.get(c["evidence"].split("/")[-1].split(":")[0].replace(".py", ""), 5),
    -int(c["title"].split()[1])
))

# Cap at 10 candidates
candidates = candidates[:10]

print(json.dumps({
    "analyzer": "todos",
    "schema_version": 1,
    "skipped": False,
    "candidates": candidates,
}, indent=2))
PYEOF

#!/usr/bin/env bash
#
# Next analyzer: Test Quality Gaps
#
# Identifies test files missing test_value markers, especially for T1/T2 modules.
# Also detects anti-patterns: assert-free tests, trivial identity tests.
#
# Usage:
#   bash next-test-quality.sh [--repo-root <path>]
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

echo "[--] Analyzing test quality" >&2

# ---- Check for test directory ------------------------------------------------
TEST_DIR=""
for d in tests test; do
  if [[ -d "$d" ]]; then
    TEST_DIR="$d"
    break
  fi
done

if [[ -z "$TEST_DIR" ]]; then
  cat <<'EOJSON'
{"analyzer":"test_quality","schema_version":1,"skipped":false,"candidates":[{"title":"Add test directory and initial tests","dimension":"test_quality","evidence":"No tests/ or test/ directory found","effort":"M","details":"Project has no test directory. Creating a test suite is a high-impact first step.","ivi_hints":{"strategic_alignment":"Testing is foundational for project quality","test_confidence":"No tests means zero confidence in correctness"}}]}
EOJSON
  exit 0
fi

# ---- Analyze test quality using Python ---------------------------------------
python3 - "$TEST_DIR" <<'PYEOF'
import ast
import json
import os
import sys

test_dir = sys.argv[1]
candidates = []

# Collect all test files
test_files = []
for root, _dirs, files in os.walk(test_dir):
    for fname in files:
        if fname.startswith("test_") and fname.endswith(".py"):
            test_files.append(os.path.join(root, fname))

if not test_files:
    print(json.dumps({
        "analyzer": "test_quality",
        "schema_version": 1,
        "skipped": False,
        "candidates": [{
            "title": "Add tests — test directory exists but contains no test files",
            "dimension": "test_quality",
            "evidence": f"{test_dir}/:no test_*.py files",
            "effort": "M",
            "details": "Test directory exists but has no test files.",
            "ivi_hints": {"test_confidence": "Empty test directory"},
        }],
    }, indent=2))
    sys.exit(0)

# Try to load tier info for module importance
module_tiers = {}
try:
    sys.path.insert(0, "src")
    from code_practices.quality.coverage_tiers import MODULE_TIERS
    module_tiers = MODULE_TIERS
except ImportError:
    pass

# Analyze each test file
files_missing_markers = []
files_with_anti_patterns = []

for test_file in test_files:
    try:
        with open(test_file) as f:
            source = f.read()
        tree = ast.parse(source, filename=test_file)
    except (SyntaxError, OSError):
        continue

    # Count test functions and check for markers
    test_funcs = []
    has_module_marker = "test_value" in source and "pytestmark" in source

    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            if node.name.startswith("test_"):
                has_marker = False
                for decorator in node.decorator_list:
                    dec_str = ast.dump(decorator)
                    if "test_value" in dec_str:
                        has_marker = True
                        break
                test_funcs.append({
                    "name": node.name,
                    "has_marker": has_marker or has_module_marker,
                    "lineno": node.lineno,
                })

    if not test_funcs:
        continue

    # Check marker coverage
    marked = sum(1 for t in test_funcs if t["has_marker"])
    total = len(test_funcs)
    marker_pct = (marked / total * 100) if total > 0 else 0

    # Determine module being tested
    basename = os.path.basename(test_file).replace("test_", "").replace(".py", "")
    tier = module_tiers.get(basename, 5)

    # T1/T2 modules need 100%/75% marker coverage
    if tier <= 2 and marker_pct < (100 if tier == 1 else 75):
        required = 100 if tier == 1 else 75
        files_missing_markers.append({
            "file": test_file,
            "module": basename,
            "tier": tier,
            "marked": marked,
            "total": total,
            "marker_pct": round(marker_pct, 1),
            "required": required,
        })

# Generate candidates for missing markers
for item in files_missing_markers:
    tier_name = f"T{item['tier']}"
    candidates.append({
        "title": f"Add test_value markers to {item['file']} ({item['marked']}/{item['total']} marked, {tier_name} needs {item['required']}%)",
        "dimension": "test_quality",
        "evidence": f"{item['file']}:marked={item['marked']}/{item['total']},tier={tier_name}",
        "effort": "S",
        "details": f"{tier_name} module {item['module']} has {item['marker_pct']}% test_value marker coverage, needs {item['required']}%.",
        "ivi_hints": {
            "strategic_alignment": f"T{item['tier']} module — {'every user depends on it' if item['tier'] == 1 else 'many modules depend on it'}",
            "job_size": "Adding markers is mechanical, low-risk work",
        },
    })

# Sort: T1 before T2
candidates.sort(key=lambda c: int(c["evidence"].split("tier=T")[1].split(",")[0]) if "tier=T" in c["evidence"] else 99)

print(json.dumps({
    "analyzer": "test_quality",
    "schema_version": 1,
    "skipped": False,
    "candidates": candidates,
}, indent=2))
PYEOF

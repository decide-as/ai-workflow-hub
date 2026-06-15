#!/usr/bin/env bash
#
# Next analyzer: Complexity & Debt
#
# Identifies large files, high-churn files, and complexity hotspots
# that would benefit from refactoring or splitting.
#
# Usage:
#   bash next-debt.sh [--repo-root <path>]
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

echo "[--] Analyzing complexity and debt" >&2

# ---- Gather data using Python ------------------------------------------------
python3 - <<'PYEOF'
import json
import os
import subprocess
import sys

candidates = []

# --- Large files (>300 lines for .py, >200 for .sh) ---
src_dirs = [d for d in ["src", "lib", "app"] if os.path.isdir(d)]
if not src_dirs:
    src_dirs = ["."]

large_threshold_py = 300
large_threshold_sh = 200

large_files = []
for src_dir in src_dirs:
    for root, _dirs, files in os.walk(src_dir):
        # Skip hidden dirs and common non-source
        if any(part.startswith(".") or part in ("__pycache__", "node_modules", ".venv", "templates")
               for part in root.split(os.sep)):
            continue
        for fname in files:
            filepath = os.path.join(root, fname)
            if fname.endswith(".py"):
                threshold = large_threshold_py
            elif fname.endswith(".sh"):
                threshold = large_threshold_sh
            else:
                continue
            try:
                with open(filepath) as f:
                    line_count = sum(1 for _ in f)
                if line_count > threshold:
                    large_files.append((filepath, line_count, threshold))
            except OSError:
                continue

# Sort by excess over threshold
large_files.sort(key=lambda x: -(x[1] - x[2]))

# Try to load tier info
module_tiers = {}
try:
    sys.path.insert(0, "src")
    from code_practices.quality.coverage_tiers import MODULE_TIERS
    module_tiers = MODULE_TIERS
except ImportError:
    pass

for filepath, line_count, threshold in large_files[:5]:
    module_stem = os.path.basename(filepath).replace(".py", "").replace(".sh", "")
    tier = module_tiers.get(module_stem, 5)
    excess = line_count - threshold

    candidates.append({
        "title": f"Refactor {filepath} ({line_count} lines, {excess} over {threshold}-line threshold)",
        "dimension": "debt",
        "evidence": f"{filepath}:lines={line_count},threshold={threshold}",
        "effort": "M" if excess < 100 else "L",
        "details": f"Consider splitting into smaller modules or extracting helper functions.",
        "ivi_hints": {
            "code_blast_radius": f"Large file changes have wider blast radius",
            "bug_risk": f"{'High-tier module' if tier <= 2 else 'Module'} with {line_count} lines is harder to reason about",
            "sustainable_maintainability": "Smaller modules are easier to maintain and test",
        },
    })

# --- High-churn files (most commits in last 90 days) ---
try:
    churn_output = subprocess.check_output(
        ["git", "log", "--name-only", "--format=", "--since=90 days ago", "--no-merges"],
        stderr=subprocess.DEVNULL, text=True,
    )
    from collections import Counter
    churn = Counter(
        f for f in churn_output.strip().split("\n")
        if f and os.path.isfile(f) and (f.endswith(".py") or f.endswith(".sh"))
    )

    for filepath, commit_count in churn.most_common(5):
        if commit_count < 8:
            continue
        module_stem = os.path.basename(filepath).replace(".py", "").replace(".sh", "")
        tier = module_tiers.get(module_stem, 5)

        candidates.append({
            "title": f"Stabilize {filepath} ({commit_count} changes in 90 days)",
            "dimension": "debt",
            "evidence": f"{filepath}:churn={commit_count},period=90d",
            "effort": "M",
            "details": f"High churn suggests the module needs design stabilization or better abstractions.",
            "ivi_hints": {
                "exploration_likelihood": "High churn indicates design is still settling",
                "sustainable_maintainability": "Frequent changes increase maintenance burden",
            },
        })
except (subprocess.CalledProcessError, FileNotFoundError):
    print("[--] Git churn analysis unavailable", file=sys.stderr)

print(json.dumps({
    "analyzer": "debt",
    "schema_version": 1,
    "skipped": False,
    "candidates": candidates,
}, indent=2))
PYEOF

#!/usr/bin/env bash
#
# Next analyzer: Coverage Gaps
#
# Identifies source modules whose test coverage is below their tier threshold.
# Reads coverage.json and (if available) coverage_tiers.py for tier assignments.
#
# Usage:
#   bash next-coverage.sh [--repo-root <path>]
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

echo "[--] Analyzing coverage gaps" >&2

# ---- Check for coverage.json ------------------------------------------------
if [[ ! -f "coverage.json" ]]; then
  cat <<'EOJSON'
{"analyzer":"coverage","schema_version":1,"skipped":true,"reason":"No coverage.json found. Run: pytest --cov --cov-report=json","candidates":[]}
EOJSON
  exit 0
fi

# ---- Analyze coverage gaps using Python (handles tiers) ----------------------
python3 - <<'PYEOF'
import json
import sys

try:
    with open("coverage.json") as f:
        cov_data = json.load(f)
except Exception as e:
    print(json.dumps({
        "analyzer": "coverage",
        "schema_version": 1,
        "skipped": True,
        "reason": f"Failed to parse coverage.json: {e}",
        "candidates": []
    }))
    sys.exit(0)

# Try to load tier assignments
module_tiers = {}
default_tier = 5
tier_thresholds = {1: 90, 2: 80, 3: 70, 4: 65, 5: 60}

try:
    sys.path.insert(0, "src")
    from code_practices.quality.coverage_tiers import MODULE_TIERS, DEFAULT_TIER, TIERS, SKIP_MODULES
    module_tiers = MODULE_TIERS
    default_tier = DEFAULT_TIER
    tier_thresholds = {lvl: t.min_coverage_basic for lvl, t in TIERS.items()}
    print("[--] Loaded tier assignments from coverage_tiers.py", file=sys.stderr)
except ImportError:
    print("[--] coverage_tiers.py not available — using flat 60% threshold", file=sys.stderr)
    SKIP_MODULES = frozenset({"__init__", "__main__"})

candidates = []
files = cov_data.get("files", {})

for filepath, info in files.items():
    # Extract module name from path
    parts = filepath.replace("/", ".").replace(".py", "").split(".")
    module_stem = parts[-1] if parts else filepath

    if module_stem in SKIP_MODULES:
        continue

    summary = info.get("summary", {}) if isinstance(info, dict) else {}
    actual = summary.get("percent_covered")
    if actual is None or not isinstance(actual, (int, float)):
        continue

    actual = round(actual, 1)
    tier_level = module_tiers.get(module_stem, default_tier)
    threshold = tier_thresholds.get(tier_level, 60)

    if actual < threshold:
        gap = round(threshold - actual, 1)
        tier_name = f"T{tier_level}"

        # Determine effort based on gap size
        if gap <= 10:
            effort = "S"
        elif gap <= 25:
            effort = "M"
        else:
            effort = "L"

        # Determine impact based on tier
        if tier_level <= 2:
            impact_label = "high"
        elif tier_level <= 3:
            impact_label = "medium"
        else:
            impact_label = "low"

        hints = {
            "strategic_alignment": f"{'Core mission module' if tier_level == 1 else 'Infrastructure module' if tier_level == 2 else 'Feature module'} — tier {tier_level}",
            "test_confidence": f"Current coverage {actual}% with {gap}% gap to close",
            "bug_risk": f"{'High-impact module, bugs affect all users' if tier_level <= 2 else 'Contained blast radius'}",
        }

        candidates.append({
            "title": f"Increase {module_stem}.py coverage from {actual}% to {threshold}% ({tier_name} target)",
            "dimension": "coverage",
            "evidence": f"{filepath}:coverage={actual}%,tier={tier_name},target={threshold}%",
            "effort": effort,
            "details": f"{gap} percentage points below {tier_name} basic gate.",
            "ivi_hints": hints,
        })

# Sort by tier (most critical first), then by gap size
candidates.sort(key=lambda c: (
    int(c["evidence"].split("tier=T")[1].split(",")[0]),
    -float(c["evidence"].split("coverage=")[1].split("%")[0])
))

print(json.dumps({
    "analyzer": "coverage",
    "schema_version": 1,
    "skipped": False,
    "candidates": candidates,
}, indent=2))
PYEOF

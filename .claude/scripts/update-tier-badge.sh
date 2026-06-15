#!/usr/bin/env bash
#
# Update the tier coverage badge and README breakdown table from
# a tier-summary.json file produced by:
#   python -m code_practices.quality.coverage_tiers --check coverage.json --json-summary tier-summary.json
#
# Usage:
#   bash .claude/scripts/update-tier-badge.sh [tier-summary.json]
#
# The script updates two things in README.md:
# 1. The shields.io tier badge (tiers-PASS-d4bc9a or tiers-N_failing-red)
# 2. The coverage tier table between <!-- TIER-TABLE-START --> and <!-- TIER-TABLE-END --> sentinels

set -euo pipefail

# ---- Activate local venv if present ------------------------------------------
if [[ -d ".venv/bin" ]]; then
  export PATH="$PWD/.venv/bin:$PATH"
elif _git_root=$(git rev-parse --show-toplevel 2>/dev/null) && [[ -d "$_git_root/.venv/bin" ]]; then
  export PATH="$_git_root/.venv/bin:$PATH"
elif [[ -n "${VIRTUAL_ENV:-}" ]] && [[ -x "${VIRTUAL_ENV}/bin/python3" ]]; then
  export PATH="$VIRTUAL_ENV/bin:$PATH"
fi

# --- Ensure we're inside a Git repository ---------------------------------
if ! GIT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null); then
  echo "[!!] Not inside a Git repository." >&2
  exit 1
fi
cd "$GIT_ROOT"

SUMMARY="${1:-tier-summary.json}"
README="README.md"

if [[ ! -f "$README" ]]; then
  echo "[!!] No README.md found at project root." >&2
  exit 1
fi

if [[ ! -f "$SUMMARY" ]]; then
  echo "[--] No $SUMMARY found — skipping tier badge update." >&2
  echo "[--] Generate it with: python -m code_practices.quality.coverage_tiers --check coverage.json --json-summary $SUMMARY"
  exit 0
fi

# --- Cross-platform sed in-place helper -------------------------------------
sedi() {
  if [[ "$(uname)" == "Darwin" ]]; then
    sed -i \'\' "$@"
  else
    sed -i "$@"
  fi
}

# --- Parse summary and update README with Python ---------------------------
python3 - "$SUMMARY" "$README" << 'PYTHON_EOF'
import json
import re
import sys

import yaml

summary_path = sys.argv[1]
readme_path = sys.argv[2]

with open(summary_path) as f:
    data = json.load(f)

with open(readme_path) as f:
    content = f.read()

# Read badge color from project-meta.yaml
default_color = "d4bc9a"
try:
    with open("project-meta.yaml") as f:
        meta = yaml.safe_load(f)
    default_color = meta.get("badge_color", "d4bc9a") or "d4bc9a"
except (FileNotFoundError, yaml.YAMLError):
    pass

all_pass = data["all_pass"]
failing_count = data["failing_count"]

# --- Update badge ---
if all_pass:
    badge_label = "PASS"
    badge_color = default_color
else:
    badge_label = f"{failing_count}_failing"
    badge_color = "red"

badge_pattern = r"tiers-[^)]*?-([a-fA-F0-9]{6}|red|yellow)"
if re.search(badge_pattern, content):
    content = re.sub(badge_pattern, f"tiers-{badge_label}-{badge_color}", content)
    print(f"[ok] Tier badge updated: {badge_label}")
else:
    print("[--] No tier badge found in README.md — skipping badge update.")

# --- Update tier table ---
start_sentinel = "<!-- TIER-TABLE-START -->"
end_sentinel = "<!-- TIER-TABLE-END -->"

if start_sentinel in content and end_sentinel in content:
    lines = []
    lines.append("| Tier | Modules | Threshold | Avg Coverage | Status |")
    lines.append("|------|---------|-----------|-------------|--------|")

    for t in data["tiers"]:
        level = t["tier"]
        name = t["name"].replace("_", " ").title()
        modules = ", ".join(t["modules"])
        threshold = f"{t['threshold']}%"
        avg_cov = f"{t['avg_coverage']}%"
        status = t["status"]
        lines.append(f"| T{level} {name} | {modules} | {threshold} | {avg_cov} | {status} |")

    table = "\n".join(lines)

    pattern = re.compile(
        re.escape(start_sentinel) + r".*?" + re.escape(end_sentinel),
        re.DOTALL,
    )
    replacement = f"{start_sentinel}\n\n{table}\n\n{end_sentinel}"
    content = pattern.sub(replacement, content)
    print("[ok] Tier table updated in README.md")
else:
    print("[--] No tier table sentinels found in README.md — skipping table update.")

with open(readme_path, "w") as f:
    f.write(content)
PYTHON_EOF

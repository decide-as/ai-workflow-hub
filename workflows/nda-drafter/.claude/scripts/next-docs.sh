#!/usr/bin/env bash
#
# Next analyzer: Documentation Gaps
#
# Identifies stale design docs, missing PRDs for recent features,
# undocumented source modules, and README gaps.
#
# Usage:
#   bash next-docs.sh [--repo-root <path>]
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

echo "[--] Analyzing documentation gaps" >&2

# ---- Analyze using Python ----------------------------------------------------
python3 - <<'PYEOF'
import json
import os
import re
import subprocess
import sys
from datetime import datetime, timedelta

candidates = []

# --- Check for stale design docs (updated > 30 days ago) ---
designs_dir = "docs/designs"
if os.path.isdir(designs_dir):
    thirty_days_ago = datetime.now() - timedelta(days=30)

    for fname in sorted(os.listdir(designs_dir)):
        if not fname.endswith(".md"):
            continue
        filepath = os.path.join(designs_dir, fname)
        try:
            with open(filepath) as f:
                content = f.read(2000)  # Read frontmatter only

            # Extract updated date from frontmatter
            updated_match = re.search(r'^updated:\s*(\d{4}-\d{2}-\d{2})', content, re.MULTILINE)
            status_match = re.search(r'^status:\s*(\w+)', content, re.MULTILINE)

            if status_match and status_match.group(1) in ("superseded", "abandoned"):
                continue

            if updated_match:
                updated = datetime.strptime(updated_match.group(1), "%Y-%m-%d")
                if updated < thirty_days_ago:
                    days_stale = (datetime.now() - updated).days
                    candidates.append({
                        "title": f"Review stale design doc: {fname} (last updated {days_stale} days ago)",
                        "dimension": "docs",
                        "evidence": f"{filepath}:updated={updated_match.group(1)},days_stale={days_stale}",
                        "effort": "S",
                        "details": "Design doc may be outdated. Review against current code and update or mark superseded.",
                        "ivi_hints": {
                            "value_decay": "Stale docs mislead future developers",
                            "developer_experience_impact": "Accurate docs reduce onboarding friction",
                        },
                    })
        except (OSError, ValueError):
            continue

# --- Check for draft PRDs that are stale ---
prds_dir = "docs/prds"
if os.path.isdir(prds_dir):
    for fname in sorted(os.listdir(prds_dir)):
        if not fname.endswith(".md"):
            continue
        filepath = os.path.join(prds_dir, fname)
        try:
            with open(filepath) as f:
                content = f.read(2000)

            status_match = re.search(r'^status:\s*(\w+)', content, re.MULTILINE)
            if status_match and status_match.group(1) == "draft":
                created_match = re.search(r'^created:\s*(\d{4}-\d{2}-\d{2})', content, re.MULTILINE)
                title_match = re.search(r'^title:\s*(.+)', content, re.MULTILINE)
                title = title_match.group(1).strip() if title_match else fname

                if created_match:
                    created = datetime.strptime(created_match.group(1), "%Y-%m-%d")
                    days_old = (datetime.now() - created).days
                    if days_old > 7:
                        candidates.append({
                            "title": f"Resolve draft PRD: {title} (draft for {days_old} days)",
                            "dimension": "docs",
                            "evidence": f"{filepath}:status=draft,days_old={days_old}",
                            "effort": "S",
                            "details": "PRD has been in draft state. Implement, approve, or close it.",
                            "ivi_hints": {
                                "exploration_likelihood": "Stale drafts indicate unresolved scope decisions",
                            },
                        })
        except (OSError, ValueError):
            continue

# --- Check for README existence and key sections ---
if os.path.isfile("README.md"):
    try:
        with open("README.md") as f:
            readme = f.read()

        expected_sections = ["install", "usage", "getting started", "quick start"]
        has_setup = any(s in readme.lower() for s in expected_sections)
        if not has_setup:
            candidates.append({
                "title": "Add installation/usage section to README.md",
                "dimension": "docs",
                "evidence": "README.md:missing_section=installation/usage",
                "effort": "S",
                "details": "README lacks setup instructions.",
                "ivi_hints": {
                    "developer_experience_impact": "README is the first thing new users see",
                },
            })
    except OSError:
        pass
else:
    candidates.append({
        "title": "Create README.md",
        "dimension": "docs",
        "evidence": "README.md:missing",
        "effort": "M",
        "details": "Project has no README.",
        "ivi_hints": {
            "developer_experience_impact": "README is essential for project discoverability",
        },
    })

# --- Check for ARCHITECTURE.md ---
if not os.path.isfile("ARCHITECTURE.md"):
    # Only suggest if project has 5+ source modules
    src_count = 0
    for d in ["src", "lib", "app"]:
        if os.path.isdir(d):
            for root, _dirs, files in os.walk(d):
                src_count += sum(1 for f in files if f.endswith(".py") and not f.startswith("_"))
    if src_count >= 5:
        candidates.append({
            "title": "Create ARCHITECTURE.md (project has {0} source modules)".format(src_count),
            "dimension": "docs",
            "evidence": f"ARCHITECTURE.md:missing,module_count={src_count}",
            "effort": "M",
            "details": "Projects with 5+ modules benefit from an architecture overview.",
            "ivi_hints": {
                "developer_experience_impact": "Architecture docs help navigate complex codebases",
                "learning_value": "Writing it forces clarifying the design",
            },
        })

print(json.dumps({
    "analyzer": "docs",
    "schema_version": 1,
    "skipped": False,
    "candidates": candidates,
}, indent=2))
PYEOF

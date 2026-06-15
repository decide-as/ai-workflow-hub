#!/usr/bin/env bash
#
# Next analyzer: Structural Gaps
#
# Identifies structural issues: source modules missing test files,
# public modules missing docstrings, and schema/metadata drift.
#
# Usage:
#   bash next-structure.sh [--repo-root <path>]
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

echo "[--] Analyzing structural gaps" >&2

# ---- Analyze using Python ----------------------------------------------------
python3 - <<'PYEOF'
import ast
import json
import os
import sys

candidates = []

# --- Find source modules without test files ---
src_dirs = []
test_dir = None
pkg_name = None

for d in ["src", "lib", "app"]:
    if os.path.isdir(d):
        src_dirs.append(d)
        # Find the package name (first subdir with __init__.py)
        for sub in os.listdir(d):
            subpath = os.path.join(d, sub)
            if os.path.isdir(subpath) and os.path.isfile(os.path.join(subpath, "__init__.py")):
                pkg_name = sub
                src_dirs = [subpath]
                break
        break

for d in ["tests", "test"]:
    if os.path.isdir(d):
        test_dir = d
        break

if src_dirs and test_dir:
    # Collect source modules
    source_modules = set()
    for src_dir in src_dirs:
        for fname in os.listdir(src_dir):
            if fname.endswith(".py") and not fname.startswith("_"):
                module = fname.replace(".py", "")
                source_modules.add(module)

    # Collect test files
    tested_modules = set()
    for fname in os.listdir(test_dir):
        if fname.startswith("test_") and fname.endswith(".py"):
            tested = fname.replace("test_", "").replace(".py", "")
            tested_modules.add(tested)

    # Find untested modules
    untested = source_modules - tested_modules
    if untested:
        # Try to load tier info
        module_tiers = {}
        try:
            sys.path.insert(0, "src")
            from code_practices.quality.coverage_tiers import MODULE_TIERS
            module_tiers = MODULE_TIERS
        except ImportError:
            pass

        for module in sorted(untested, key=lambda m: module_tiers.get(m, 5)):
            tier = module_tiers.get(module, 5)
            src_path = None
            for sd in src_dirs:
                candidate_path = os.path.join(sd, f"{module}.py")
                if os.path.isfile(candidate_path):
                    src_path = candidate_path
                    break

            if src_path is None:
                continue

            candidates.append({
                "title": f"Add test file for {module}.py (T{tier}, no test_{module}.py exists)",
                "dimension": "structure",
                "evidence": f"{src_path}:missing={test_dir}/test_{module}.py",
                "effort": "M",
                "details": f"Source module has no corresponding test file.",
                "ivi_hints": {
                    "test_confidence": "No tests means zero verification of this module",
                    "strategic_alignment": f"T{tier} module" + (" — core" if tier <= 2 else ""),
                },
            })

# --- Check for source modules missing module-level docstrings ---
for src_dir in src_dirs:
    for fname in os.listdir(src_dir):
        if not fname.endswith(".py") or fname.startswith("_"):
            continue
        filepath = os.path.join(src_dir, fname)
        try:
            with open(filepath) as f:
                source = f.read()
            tree = ast.parse(source, filename=filepath)
            docstring = ast.get_docstring(tree)
            if not docstring:
                module = fname.replace(".py", "")
                candidates.append({
                    "title": f"Add module docstring to {filepath}",
                    "dimension": "structure",
                    "evidence": f"{filepath}:missing_docstring",
                    "effort": "S",
                    "details": "Public module lacks a module-level docstring.",
                    "ivi_hints": {
                        "developer_experience_impact": "Docstrings improve discoverability and onboarding",
                    },
                })
        except (SyntaxError, OSError):
            continue

# --- Check project-meta.yaml vs pyproject.toml version sync ---
meta_version = None
pyproject_version = None

if os.path.isfile("project-meta.yaml"):
    try:
        import yaml
        with open("project-meta.yaml") as f:
            meta = yaml.safe_load(f)
        meta_version = meta.get("version")
    except Exception:
        pass

if os.path.isfile("pyproject.toml"):
    try:
        with open("pyproject.toml") as f:
            for line in f:
                if line.strip().startswith("version"):
                    pyproject_version = line.split("=")[1].strip().strip('"').strip("'")
                    break
    except Exception:
        pass

if meta_version and pyproject_version and meta_version != pyproject_version:
    candidates.append({
        "title": f"Fix version mismatch: project-meta.yaml={meta_version} vs pyproject.toml={pyproject_version}",
        "dimension": "structure",
        "evidence": f"project-meta.yaml:version={meta_version},pyproject.toml:version={pyproject_version}",
        "effort": "S",
        "details": "Version strings must match across metadata files.",
        "ivi_hints": {
            "bug_risk": "Version mismatch can cause release issues",
        },
    })

print(json.dumps({
    "analyzer": "structure",
    "schema_version": 1,
    "skipped": False,
    "candidates": candidates,
}, indent=2))
PYEOF

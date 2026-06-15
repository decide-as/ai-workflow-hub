#!/usr/bin/env python3
"""Next analyzer: External Best Practices.

Scans the project's configuration, tooling, and structure to identify
ecosystem best practices that the project hasn't adopted yet. Unlike
the other analyzers, this one looks outward — comparing the project
against what's standard for its language, category, and maturity phase.

Usage:
    python3 next-bestpractices.py [--repo-root <path>]

Output: JSON to stdout. Info/errors to stderr.
"""

from __future__ import annotations

import json
import os
import sys
from typing import Any


def parse_args() -> str:
    """Parse CLI arguments, return repo root path."""
    repo_root = ""
    args = sys.argv[1:]
    i = 0
    while i < len(args):
        if args[i] == "--repo-root" and i + 1 < len(args):
            repo_root = args[i + 1]
            i += 2
        else:
            print(f"[!!] Unknown argument: {args[i]}", file=sys.stderr)
            sys.exit(1)
    return repo_root


def load_meta(repo_root: str) -> dict[str, Any]:
    """Load project-meta.yaml if it exists."""
    base = "project-meta.yaml"
    meta_path = os.path.join(repo_root, base) if repo_root else base
    if not os.path.isfile(meta_path):
        return {}
    try:
        import yaml

        with open(meta_path) as f:
            return yaml.safe_load(f) or {}
    except Exception:
        return {}


def load_pyproject(repo_root: str) -> dict[str, Any]:
    """Load pyproject.toml sections relevant for best-practice analysis."""
    path = os.path.join(repo_root, "pyproject.toml") if repo_root else "pyproject.toml"
    if not os.path.isfile(path):
        return {}
    try:
        import tomllib

        with open(path, "rb") as f:
            loaded: dict[str, Any] = tomllib.load(f)
            return loaded
    except Exception:
        return {}


def load_package_json(repo_root: str) -> dict[str, Any]:
    """Load package.json if it exists."""
    path = os.path.join(repo_root, "package.json") if repo_root else "package.json"
    if not os.path.isfile(path):
        return {}
    try:
        with open(path) as f:
            data: dict[str, Any] = json.load(f)
            return data
    except Exception:
        return {}


def _extract_dep_name(dep: str) -> str:
    """Extract bare package name from a dependency specifier."""
    for ch in "[><=!":
        dep = dep.split(ch)[0]
    return dep.strip().lower()


def check_python_practices(
    meta: dict[str, Any],
    pyproject: dict[str, Any],
    repo_root: str,
) -> list[dict[str, Any]]:
    """Check Python ecosystem best practices."""
    candidates = []
    phase = meta.get("phase", "discovery")
    quality_gate = meta.get("quality_gate", "none")

    tool_section = pyproject.get("tool", {})
    project_section = pyproject.get("project", {})
    deps = project_section.get("dependencies", [])
    optional_deps = project_section.get("optional-dependencies", {})
    all_deps = deps + [d for group in optional_deps.values() for d in group]
    dep_names = {_extract_dep_name(d) for d in all_deps}

    # --- Type checking ---
    has_mypy_config = "mypy" in tool_section
    has_mypy_dep = "mypy" in dep_names

    if not has_mypy_config and not has_mypy_dep:
        candidates.append(
            {
                "title": "Add mypy type checking (standard for Python 3.11+)",
                "dimension": "bestpractices",
                "evidence": "pyproject.toml:missing=[tool.mypy]",
                "effort": "M",
                "details": "Catches bugs at dev time. Standard for 3.11+.",
                "ivi_hints": {
                    "risk_reduction": "Prevents categories of runtime errors",
                    "learning_value": "Annotations serve as documentation",
                    "developer_experience_impact": "IDE autocompletion improves",
                },
            }
        )

    # --- Security scanning ---
    if phase in ("alpha", "beta", "ga", "mature") and quality_gate in (
        "basic",
        "strict",
    ):
        has_bandit = "bandit" in dep_names
        if not has_bandit:
            candidates.append(
                {
                    "title": ("Add bandit security scanning (recommended at alpha+)"),
                    "dimension": "bestpractices",
                    "evidence": (f"pyproject.toml:missing_dep=bandit,phase={phase}"),
                    "effort": "S",
                    "details": "Static analysis catches common vulnerabilities.",
                    "ivi_hints": {
                        "risk_reduction": "Catches vulnerabilities before ship",
                        "bug_risk": ("Low risk to add — purely advisory tool"),
                    },
                }
            )

    # --- Dependency auditing ---
    has_pip_audit = "pip-audit" in dep_names
    if not has_pip_audit and phase in ("alpha", "beta", "ga", "mature"):
        candidates.append(
            {
                "title": "Add pip-audit for dependency vulnerability scanning",
                "dimension": "bestpractices",
                "evidence": (f"pyproject.toml:missing_dep=pip-audit,phase={phase}"),
                "effort": "S",
                "details": "Detects known CVEs in deps. Run before PRs.",
                "ivi_hints": {
                    "risk_reduction": "Supply chain vulns are a top concern",
                },
            }
        )

    # --- Pre-commit hooks ---
    precommit_path = os.path.join(
        repo_root or ".",
        ".pre-commit-config.yaml",
    )
    has_precommit = os.path.isfile(precommit_path)
    if not has_precommit and phase in ("alpha", "beta", "ga", "mature"):
        candidates.append(
            {
                "title": "Add pre-commit hooks for automated code quality checks",
                "dimension": "bestpractices",
                "evidence": ".pre-commit-config.yaml:missing",
                "effort": "S",
                "details": "Catches formatting, secrets, syntax errors before commit.",
                "ivi_hints": {
                    "risk_reduction": "Catches mistakes at commit time",
                    "developer_experience_impact": "Fast feedback loop",
                },
            }
        )

    # --- CI/CD ---
    has_ci = os.path.isdir(os.path.join(repo_root or ".", ".github", "workflows"))
    if not has_ci and phase in ("alpha", "beta", "ga", "mature"):
        candidates.append(
            {
                "title": "Add CI/CD pipeline (GitHub Actions)",
                "dimension": "bestpractices",
                "evidence": ".github/workflows/:missing",
                "effort": "M",
                "details": "Automated testing on push/PR is standard past prototype.",
                "ivi_hints": {
                    "risk_reduction": "CI catches regressions before merge",
                    "sustainable_maintainability": "Reduces manual review burden",
                },
            }
        )

    # --- Structured logging ---
    has_logging = False
    src_dir = os.path.join(repo_root or ".", "src")
    if os.path.isdir(src_dir):
        for root, _dirs, files in os.walk(src_dir):
            for fname in files:
                if fname.endswith(".py"):
                    try:
                        with open(os.path.join(root, fname)) as f:
                            content = f.read(5000)
                        if "import logging" in content or "from logging" in content:
                            has_logging = True
                            break
                    except OSError:
                        continue
            if has_logging:
                break

    has_print_in_src = False
    if os.path.isdir(src_dir):
        for root, _dirs, files in os.walk(src_dir):
            if "__pycache__" in root:
                continue
            for fname in files:
                if fname.endswith(".py"):
                    try:
                        with open(os.path.join(root, fname)) as f:
                            for line in f:
                                s = line.strip()
                                if s.startswith("print(") and not s.startswith("#"):
                                    has_print_in_src = True
                                    break
                    except OSError:
                        continue
                if has_print_in_src:
                    break
            if has_print_in_src:
                break

    if has_print_in_src and not has_logging:
        candidates.append(
            {
                "title": "Replace print() with structured logging in source modules",
                "dimension": "bestpractices",
                "evidence": "src/:print_statements_found,logging_not_configured",
                "effort": "M",
                "details": ("Use logging module for configurable, structured output."),
                "ivi_hints": {
                    "developer_experience_impact": "Enables log-level filtering",
                    "sustainable_maintainability": "Structured logs are parseable",
                },
            }
        )

    return candidates


def check_node_practices(
    meta: dict[str, Any],
    pkg_json: dict[str, Any],
    repo_root: str,
) -> list[dict[str, Any]]:
    """Check Node.js ecosystem best practices."""
    candidates = []
    phase = meta.get("phase", "discovery")
    deps = pkg_json.get("dependencies", {})
    dev_deps = pkg_json.get("devDependencies", {})
    all_deps = {**deps, **dev_deps}

    # --- TypeScript ---
    tsconfig = os.path.join(repo_root or ".", "tsconfig.json")
    has_ts = "typescript" in all_deps or os.path.isfile(tsconfig)
    if not has_ts and phase in ("alpha", "beta", "ga", "mature"):
        candidates.append(
            {
                "title": ("Consider TypeScript for type safety (standard at alpha+)"),
                "dimension": "bestpractices",
                "evidence": "package.json:missing_dep=typescript",
                "effort": "L",
                "details": "TypeScript is standard past prototype.",
                "ivi_hints": {
                    "risk_reduction": ("Type checking catches bugs at compile time"),
                    "learning_value": ("Types serve as inline documentation"),
                },
            }
        )

    # --- ESLint ---
    has_eslint = "eslint" in all_deps
    if not has_eslint:
        candidates.append(
            {
                "title": "Add ESLint for code quality enforcement",
                "dimension": "bestpractices",
                "evidence": "package.json:missing_dep=eslint",
                "effort": "S",
                "details": ("ESLint is the standard linter for JS/TS projects."),
                "ivi_hints": {
                    "developer_experience_impact": "Consistent style reduces friction",
                },
            }
        )

    return candidates


def check_universal_practices(
    meta: dict[str, Any],
    repo_root: str,
) -> list[dict[str, Any]]:
    """Check practices applicable to any project."""
    candidates = []
    phase = meta.get("phase", "discovery")

    # --- License ---
    license_value = meta.get("license", "")
    rr = repo_root or "."
    has_license_file = os.path.isfile(
        os.path.join(rr, "LICENSE"),
    ) or os.path.isfile(
        os.path.join(rr, "LICENSE.md"),
    )
    is_proprietary = license_value == "All Rights Reserved"
    if not has_license_file and license_value and not is_proprietary:
        candidates.append(
            {
                "title": "Add LICENSE file matching project-meta.yaml",
                "dimension": "bestpractices",
                "evidence": (f"LICENSE:missing,meta_license={license_value}"),
                "effort": "S",
                "details": ("License declared in metadata but no LICENSE file exists."),
                "ivi_hints": {
                    "bug_risk": "Low risk — purely additive",
                },
            }
        )

    # --- CHANGELOG ---
    has_changelog = os.path.isfile(os.path.join(rr, "CHANGELOG.md"))
    if not has_changelog and phase in ("alpha", "beta", "ga", "mature"):
        candidates.append(
            {
                "title": "Add CHANGELOG.md for release tracking",
                "dimension": "bestpractices",
                "evidence": f"CHANGELOG.md:missing,phase={phase}",
                "effort": "S",
                "details": "Helps users understand changes between versions.",
                "ivi_hints": {
                    "developer_experience_impact": "Reduces confusion during upgrades",
                },
            }
        )

    # --- .gitignore ---
    has_gitignore = os.path.isfile(os.path.join(rr, ".gitignore"))
    if not has_gitignore:
        candidates.append(
            {
                "title": "Add .gitignore file",
                "dimension": "bestpractices",
                "evidence": ".gitignore:missing",
                "effort": "S",
                "details": "Prevents committing generated files, caches, and secrets.",
                "ivi_hints": {
                    "risk_reduction": "Prevents committing sensitive files",
                },
            }
        )

    return candidates


def main() -> None:
    """Run best-practices analysis."""
    repo_root = parse_args()
    if repo_root:
        os.chdir(repo_root)
        repo_root = ""

    print("[--] Analyzing external best practices", file=sys.stderr)

    meta = load_meta(repo_root)
    language = meta.get("language", "").lower()

    candidates = []

    # Language-specific checks
    if language == "python" or os.path.isfile("pyproject.toml"):
        pyproject = load_pyproject(repo_root)
        candidates.extend(
            check_python_practices(meta, pyproject, repo_root),
        )
    elif language in ("javascript", "typescript", "node") or os.path.isfile(
        "package.json",
    ):
        pkg_json = load_package_json(repo_root)
        candidates.extend(
            check_node_practices(meta, pkg_json, repo_root),
        )

    # Universal checks
    candidates.extend(check_universal_practices(meta, repo_root))

    print(
        json.dumps(
            {
                "analyzer": "bestpractices",
                "schema_version": 1,
                "skipped": False,
                "candidates": candidates,
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()

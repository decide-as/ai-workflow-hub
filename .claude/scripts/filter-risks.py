#!/usr/bin/env python3
"""Standalone risk applicability filter for generated projects.

This script provides the same filtering logic as
code_practices.quality.risk_filter but without requiring
the code_practices package to be installed. It is distributed to
projects alongside check-risk-assessment.sh.

Usage:
    python3 .claude/scripts/filter-risks.py <phase> [--registry PATH] [--meta PATH]

Exit codes:
    0 — success
    1 — error (missing files, invalid YAML, etc.)
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Any

import yaml

# ---------------------------------------------------------------------------
# Phase → Tier mapping
# (canonical: code_practices.quality.risk_checks.PHASE_TO_TIER)
# ---------------------------------------------------------------------------

PHASE_TO_TIER: dict[str, int] = {
    "discovery": 0,
    "poc": 0,
    "prototype": 1,
    "mvp": 2,
    "alpha": 3,
    "beta": 4,
    "pilot": 4,
    "validation": 5,
    "production": 5,
}

# ---------------------------------------------------------------------------
# Registry loading
# ---------------------------------------------------------------------------


def load_registry(registry_path: Path) -> dict[str, dict[str, Any]]:
    """Load risk applicability registry from YAML.

    Args:
        registry_path: Path to risk-applicability.yaml.

    Returns:
        Dict mapping risk ID to its applicability constraints.

    Raises:
        FileNotFoundError: If the registry file does not exist.
        ValueError: If the YAML is invalid or not a mapping.
    """
    try:
        with open(registry_path) as f:
            data = yaml.safe_load(f)
    except FileNotFoundError:
        raise FileNotFoundError(f"Risk registry not found: {registry_path}") from None
    except yaml.YAMLError as exc:
        raise ValueError(f"Invalid YAML in {registry_path}: {exc}") from None

    if not isinstance(data, dict):
        actual = type(data).__name__
        raise ValueError(f"Risk registry must be a YAML mapping, got {actual}")

    registry: dict[str, dict[str, Any]] = {}

    for tier_key, ids in data.get("tiers", {}).items():
        tier_num = -1 if tier_key == "ai" else int(tier_key)
        for risk_id in ids:
            registry[risk_id] = {"min_tier": tier_num}

    for risk_id, constraints in data.get("applicability", {}).items():
        if risk_id in registry:
            registry[risk_id].update(constraints)

    return registry


# ---------------------------------------------------------------------------
# Filtering
# ---------------------------------------------------------------------------


def filter_applicable(
    registry: dict[str, dict[str, Any]],
    metadata: dict[str, Any],
    tier: int,
) -> list[str]:
    """Filter registry to risks applicable to the given project.

    Args:
        registry: Risk registry from load_registry().
        metadata: Parsed project-meta.yaml.
        tier: Project tier.

    Returns:
        Sorted list of applicable risk IDs.
    """
    language = metadata.get("language", "python")
    category = metadata.get("category", "tool")

    applicable = []

    for risk_id, entry in registry.items():
        if entry["min_tier"] > tier:
            continue

        languages = entry.get("languages", [])
        if languages and language not in languages:
            continue

        categories = entry.get("categories", [])
        if categories and category not in categories:
            continue

        requires = entry.get("requires", {})
        if any(v and not metadata.get(k, False) for k, v in requires.items()):
            continue

        applicable.append(risk_id)

    return sorted(applicable)


# ---------------------------------------------------------------------------
# Output formatting
# ---------------------------------------------------------------------------


def format_summary(
    applicable: list[str],
    total: int,
    tier: int,
    phase: str,
) -> str:
    """Produce a formatted summary of the filtering result.

    Args:
        applicable: List of applicable risk IDs.
        total: Total number of risks in the registry.
        tier: Project tier.
        phase: Project phase string.

    Returns:
        Multi-line summary string.
    """
    n = len(applicable)
    filtered = total - n
    lines = [
        f"Risk applicability filter: {phase}/tier-{tier} | {n}/{total} applicable",
        "(standalone mode — install code_practices for full grouped output)",
    ]

    lines.append("")
    summary = f"{n} applicable / {filtered} filtered out / {total} in registry"
    lines.append(f"Total: {summary}")

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------


def main(argv: list[str] | None = None) -> int:
    """Run the standalone risk filter.

    Args:
        argv: Command-line arguments (defaults to sys.argv[1:]).

    Returns:
        Exit code (0 for success, 1 for error).
    """
    parser = argparse.ArgumentParser(
        description="Filter risk applicability for a project.",
    )
    parser.add_argument("phase", help="Project phase (e.g., mvp, alpha)")
    parser.add_argument(
        "--registry",
        default="docs/risk/risk-applicability.yaml",
        help="Path to risk-applicability.yaml",
    )
    parser.add_argument(
        "--meta",
        default="project-meta.yaml",
        help="Path to project-meta.yaml (default: project-meta.yaml)",
    )
    args = parser.parse_args(argv)

    # Validate phase
    if args.phase not in PHASE_TO_TIER:
        print(f"(unknown phase: {args.phase})", file=sys.stderr)
        return 1

    # Load registry
    try:
        registry = load_registry(Path(args.registry))
    except (FileNotFoundError, ValueError) as exc:
        print(f"({exc})", file=sys.stderr)
        return 1

    # Load metadata
    try:
        with open(args.meta) as f:
            metadata = yaml.safe_load(f)
    except FileNotFoundError:
        print(f"(metadata not found: {args.meta})", file=sys.stderr)
        return 1
    except yaml.YAMLError as exc:
        print(f"(invalid metadata YAML: {exc})", file=sys.stderr)
        return 1

    tier = PHASE_TO_TIER[args.phase]
    applicable = filter_applicable(registry, metadata, tier)
    print(format_summary(applicable, len(registry), tier, args.phase))

    return 0


if __name__ == "__main__":
    sys.exit(main())

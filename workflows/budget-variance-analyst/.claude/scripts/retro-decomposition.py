#!/usr/bin/env python3
"""Retro analyzer: Decomposition Opportunities.

Detects functionally distinct module clusters within the project and evaluates
whether any have high cross-repo reuse potential. Surfaces extraction
candidates during routine retrospectives.

Usage:
    python3 retro-decomposition.py --since 2026-03-01 --until 2026-03-17

Output: JSON to stdout. Info/errors to stderr.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any


def _info(msg: str) -> None:
    print(f"[--] {msg}", file=sys.stderr)


def main() -> None:
    parser = argparse.ArgumentParser(description="Decomposition opportunities analyzer")
    parser.add_argument("--since", required=True, help="Start date (ISO)")
    parser.add_argument("--until", required=True, help="End date (ISO)")
    parser.add_argument("--repo-root", default=".", help="Repository root")
    args = parser.parse_args()

    repo_root = Path(args.repo_root).resolve()

    result: dict[str, Any] = {
        "analyzer": "decomposition",
        "schema_version": 1,
        "skipped": False,
        "metrics": {},
        "findings": [],
    }

    # Try to import the decomposition engine
    try:
        from code_practices.decompose import analyze
    except ImportError:
        result["skipped"] = True
        result["reason"] = "code_practices.decompose module not available"
        print(json.dumps(result, indent=2))
        return

    # Run analysis
    _info("Running decomposition analysis...")
    try:
        opportunities = analyze(repo_root)
    except (FileNotFoundError, ValueError) as exc:
        result["skipped"] = True
        result["reason"] = str(exc)
        print(json.dumps(result, indent=2))
        return

    if not opportunities:
        result["metrics"] = {
            "total_clusters": 0,
            "strong_candidates": 0,
            "consider_candidates": 0,
        }
        result["findings"].append("No decomposition opportunities detected.")
        print(json.dumps(result, indent=2))
        return

    # Compute metrics
    strong = [o for o in opportunities if o.recommendation == "strong candidate"]
    consider = [o for o in opportunities if o.recommendation == "consider"]

    result["metrics"] = {
        "total_clusters": len(opportunities),
        "strong_candidates": len(strong),
        "consider_candidates": len(consider),
        "avg_composite_score": round(
            sum(o.composite_score for o in opportunities) / len(opportunities),
            3,
        ),
        "max_composite_score": round(max(o.composite_score for o in opportunities), 3),
    }

    # Generate findings
    if strong:
        names = ", ".join(o.cluster.name for o in strong)
        n = len(strong)
        msg = f"{n} strong extraction candidate(s): {names}"
        result["findings"].append(msg)
        for opp in strong:
            result["findings"].append(
                f"  {opp.cluster.name}: {len(opp.cluster.modules)} modules, "
                f"composite {opp.composite_score:.2f}, "
                f"type={opp.suggested_extraction_type}"
            )

    if consider:
        names = ", ".join(o.cluster.name for o in consider)
        nc = len(consider)
        result["findings"].append(f"{nc} cluster(s) worth considering: {names}")

    not_recommended = []
    for o in opportunities:
        if o.recommendation == "not recommended":
            not_recommended.append(o)
    if not_recommended:
        nr = len(not_recommended)
        result["findings"].append(
            f"{nr} cluster(s) not recommended",
        )

    # Add cluster details for downstream consumption
    result["clusters"] = [
        {
            "name": o.cluster.name,
            "modules": sorted(o.cluster.modules),
            "composite_score": round(
                o.composite_score,
                3,
            ),
            "recommendation": o.recommendation,
            "extraction_type": o.suggested_extraction_type,
            "cohesion": round(o.cohesion.score, 3),
            "independence": round(
                o.independence.score,
                3,
            ),
            "reuse": round(o.reuse.score, 3),
        }
        for o in opportunities
    ]

    ns = len(strong)
    nc2 = len(consider)
    nnr = len(not_recommended)
    _info(
        f"Found {ns} strong, {nc2} consider, {nnr} skip",
    )

    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()

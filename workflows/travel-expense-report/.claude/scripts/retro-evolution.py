#!/usr/bin/env python3
"""Retro analyzer: Feature Evolution.

Tracks how features/capabilities evolve over time by analyzing git history.
Builds a feature × commit matrix with maturity scores (0-10), grouped by
ISO 25010 quality dimensions.

Usage:
    python3 retro-evolution.py --since 2026-03-01 --until 2026-03-17

Output: JSON to stdout. Info/errors to stderr.
"""

from __future__ import annotations

import argparse
import datetime
import json
import subprocess
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any

# Shared retro modules (same directory)
sys.path.insert(0, str(Path(__file__).parent))

from retro_aggregation import (
    aggregate_by_period,
    build_header_groups,
    get_sampled_commits,
)
from retro_aggregation import (
    determine_granularity as _determine_granularity,  # noqa: F401
)
from retro_features import (
    DIMENSION_SIGNALS,
    classify_dimension,  # noqa: F401
    detect_source_roots,
    extract_features,
    humanize_name,  # noqa: F401
    load_feature_map,
    reconcile_features,
    save_feature_map,
)
from retro_git import git
from retro_scoring import compute_activity, compute_scores, find_test_path

# ---------------------------------------------------------------------------
# Feature grouping (evolution-specific)
# ---------------------------------------------------------------------------

# Script sub-grouping: map script name prefixes/keywords to group names
SCRIPT_GROUPS: list[tuple[list[str], str]] = [
    (["retro-"], "Retro Analyzers"),
    (
        ["check-coverage", "check-tiered", "check-pr-coverage", "check-mutation"],
        "Quality Gates",
    ),
    (
        [
            "update-coverage-badge",
            "update-mutation-badge",
            "update-tier-badge",
            "update-readme-badge",
        ],
        "Badges",
    ),
    (["stage-all", "stage-files", "guard-master", "post-rebase"], "Git Workflow"),
    (["setup-worktree", "cleanup-worktree", "approve-worktree"], "Worktree Management"),
    (["setup-git-hook", "setup-branch"], "Repository Setup"),
    (
        ["collect-changelog", "write-changelog", "finalize-release", "get-pr-commit"],
        "Release & Changelog",
    ),
    (["check-risk", "filter-risk"], "Risk Automation"),
    (["validate-metadata"], "Validation"),
]

# Rule sub-grouping: map rule name keywords to group names
RULE_GROUPS: list[tuple[list[str], str]] = [
    (["conventions/"], "Conventions"),
    (["test", "coverage", "mutation", "quality"], "Quality & Testing"),
    (["git", "branching", "branch-cleanup"], "Git & Branching"),
    (
        [
            "pr-versioning",
            "code-review",
            "review-tone",
            "stage-detection",
            "world-class",
        ],
        "Review & Standards",
    ),
    (["risk", "security"], "Risk & Security"),
    (["self-correction", "anti-hallucination"], "Self-Governance"),
    (
        [
            "retro",
            "session",
            "logging",
            "mermaid",
            "phase-maturity",
            "prd",
            "prioritize",
        ],
        "Process & Documentation",
    ),
]


def assign_feature_group(feature_id: str) -> str:
    """Assign a feature to a named group based on its ID prefix and name.

    Returns a human-readable group name.
    """
    # Determine the artifact type from the prefix
    if "/" not in feature_id:
        return "Source Modules"

    prefix = feature_id.split("/")[0]
    name_part = "/".join(feature_id.split("/")[1:])

    if prefix == "scripts":
        for keywords, group_name in SCRIPT_GROUPS:
            for kw in keywords:
                if kw in name_part:
                    return group_name
        return "Scripts"

    if prefix == "rules":
        for keywords, group_name in RULE_GROUPS:
            for kw in keywords:
                if kw in name_part:
                    return group_name
        return "Rules"

    group_labels = {
        "skills": "Skills",
        "templates": "Templates",
        "guides": "Guides",
        "risk-docs": "Risk Documentation",
        "schemas": "Schemas",
    }
    return group_labels.get(prefix, prefix.replace("-", " ").title())


def group_features(features: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Organize features into ordered groups.

    Returns a list of {"name": group_name, "features": [feature, ...]} dicts,
    ordered: Source Modules first, then alphabetically, with single-feature
    groups merged into an "Other" group only if there are 3+ such groups.
    """
    groups_map: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for feat in features:
        groups_map[feat["group"]].append(feat)

    # Order: Source Modules first, then alphabetically
    ordered_names: list[str] = []
    if "Source Modules" in groups_map:
        ordered_names.append("Source Modules")
    ordered_names.extend(sorted(n for n in groups_map if n != "Source Modules"))

    return [{"name": name, "features": groups_map[name]} for name in ordered_names]


# ---------------------------------------------------------------------------
# Findings generation (evolution-specific)
# ---------------------------------------------------------------------------


def generate_findings(
    features: list[dict[str, Any]],
    scores: dict[str, dict[str, float]],
    sampled: list[dict[str, str]],
    new_count: int,
    removed_count: int,
    repo_root: str = ".",
) -> list[str]:
    """Generate human-readable findings from the evolution data."""
    findings: list[str] = []

    if not sampled or not features:
        return findings

    keys = [c["sha"] for c in sampled]
    first_sha = keys[0] if keys else None
    last_sha = keys[-1] if keys else None

    # Find features that appeared during the window
    appeared = []
    for feat in features:
        fid = feat["id"]
        if fid not in scores:
            continue
        feat_scores = scores[fid]
        if first_sha and feat_scores.get(first_sha, 0) == 0:
            # Check if it appeared later
            for sha in keys[1:]:
                if feat_scores.get(sha, 0) > 0:
                    appeared.append(feat["name"])
                    break

    if appeared:
        findings.append(
            f"{len(appeared)} feature(s) appeared during this window: "
            + ", ".join(appeared[:5])
            + ("..." if len(appeared) > 5 else "")
        )

    # Find features at peak maturity (10.0) at the end
    at_peak = []
    for feat in features:
        fid = feat["id"]
        if fid in scores and last_sha and scores[fid].get(last_sha, 0) >= 10.0:
            at_peak.append(feat["name"])

    if at_peak:
        findings.append(
            f"{len(at_peak)} feature(s) at peak maturity: "
            + ", ".join(at_peak[:5])
            + ("..." if len(at_peak) > 5 else "")
        )

    # Check for declining features
    declining = []
    for feat in features:
        fid = feat["id"]
        if fid not in scores:
            continue
        feat_scores = scores[fid]
        if last_sha and first_sha:
            start = feat_scores.get(first_sha, 0)
            end = feat_scores.get(last_sha, 0)
            if start > 0 and end < start - 2.0:
                declining.append(f"{feat['name']} ({start:.0f} → {end:.0f})")

    if declining:
        findings.append("Declining maturity: " + ", ".join(declining[:3]))

    # Check for missing ISO 25010 dimensions
    dimensions_present = {f["dimension"] for f in features}
    all_dimensions = set(DIMENSION_SIGNALS.keys()) | {"Functional Suitability"}
    missing = all_dimensions - dimensions_present
    if missing:
        findings.append(f"No features classified under: {', '.join(sorted(missing))}")

    # Untested features (only check source-code features that have test candidates)
    untested = []
    for feat in features:
        test_candidates = find_test_path(feat)
        has_test = any((Path(repo_root) / tp).exists() for tp in test_candidates)
        if test_candidates and not has_test:
            untested.append(feat["name"])

    if untested:
        findings.append(
            f"{len(untested)} feature(s) have no test file: "
            + ", ".join(untested[:5])
            + ("..." if len(untested) > 5 else "")
        )

    # New/removed features
    if new_count > 0:
        map_path = "docs/retro/feature-map.json"
        findings.append(
            f"{new_count} new feature(s) — review {map_path}",
        )
    if removed_count > 0:
        findings.append(f"{removed_count} feature(s) no longer present in source")

    return findings


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> None:
    """Run the feature evolution analyzer."""
    parser = argparse.ArgumentParser(description="Retro analyzer: Feature Evolution")
    parser.add_argument("--since", required=True, help="Start date (ISO format)")
    parser.add_argument("--until", required=True, help="End date (ISO format)")
    parser.add_argument("--repo-root", default="", help="Repository root path")
    parser.add_argument(
        "--no-persist",
        action="store_true",
        help="Skip writing feature-map.json (read-only mode)",
    )
    args = parser.parse_args()

    repo_root = args.repo_root
    if not repo_root:
        try:
            repo_root = subprocess.run(
                ["git", "rev-parse", "--show-toplevel"],
                capture_output=True,
                text=True,
                timeout=5,
            ).stdout.strip()
        except (subprocess.TimeoutExpired, subprocess.CalledProcessError):
            print("[!!] Not inside a Git repository.", file=sys.stderr)
            sys.exit(1)

    if not repo_root:
        print("[!!] Not inside a Git repository.", file=sys.stderr)
        sys.exit(1)

    print(
        f"[--] Analyzing feature evolution from {args.since} to {args.until}",
        file=sys.stderr,
    )

    # Check for commits in window
    commit_count_str = git(
        [
            "log",
            "--all",
            "--oneline",
            f"--since={args.since}",
            f"--until={args.until}",
            "--no-merges",
        ],
        repo_root,
    )
    commit_count = len(commit_count_str.split("\n")) if commit_count_str else 0

    if commit_count == 0:
        json.dump(
            {
                "analyzer": "evolution",
                "schema_version": 1,
                "skipped": True,
                "reason": "No commits in window",
                "metrics": {},
                "findings": [],
            },
            sys.stdout,
        )
        sys.exit(0)

    # Detect source roots
    source_roots = detect_source_roots(repo_root)
    source_root = source_roots[0] if source_roots else "."
    print(f"[--] Source root: {source_root}", file=sys.stderr)

    # Extract features
    discovered = extract_features(repo_root, source_roots)
    print(f"[--] Discovered {len(discovered)} features", file=sys.stderr)

    if not discovered:
        json.dump(
            {
                "analyzer": "evolution",
                "schema_version": 1,
                "skipped": True,
                "reason": "No source modules found",
                "metrics": {},
                "findings": [],
            },
            sys.stdout,
        )
        sys.exit(0)

    # Reconcile with existing feature map
    existing_map = load_feature_map(repo_root)
    features, new_count, removed_count = reconcile_features(
        discovered,
        existing_map,
        source_root,
    )

    # Save updated feature map only when features changed
    feature_map = {
        "version": 1,
        "source_root": source_root,
        "features": {f["id"]: f for f in features},
    }
    changed = new_count > 0 or removed_count > 0 or existing_map is None
    if not args.no_persist and changed:
        save_feature_map(repo_root, feature_map)

    # Filter to active features only for scoring
    active_features = [f for f in features if f.get("status") != "removed"]

    # Sample commits
    sampled = get_sampled_commits(repo_root, args.since, args.until)
    print(f"[--] Sampled {len(sampled)} commits across window", file=sys.stderr)

    if not sampled:
        json.dump(
            {
                "analyzer": "evolution",
                "schema_version": 1,
                "skipped": True,
                "reason": "No commits in window after sampling",
                "metrics": {},
                "findings": [],
            },
            sys.stdout,
        )
        sys.exit(0)

    # Compute raw scores (completeness) and activity (churn) per commit
    raw_scores = compute_scores(repo_root, active_features, sampled)
    raw_activity = compute_activity(repo_root, active_features, sampled)

    # Determine end date for contiguous range: today's date
    today = datetime.date.today().isoformat()

    # Aggregate by adaptive time period (day/week/month/quarter based on span)
    period_commits, scores, activity, granularity = aggregate_by_period(
        sampled,
        raw_scores,
        raw_activity,
        end_date=today,
    )

    # Build header groups for the output
    month_groups = build_header_groups(period_commits, granularity)

    # Build bucket structure with feature groups (middle layer)
    # Hierarchy: dimension → groups → features
    buckets_map: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for feat in active_features:
        fid = feat["id"]
        bucket_entry = {
            "id": fid,
            "name": feat["name"],
            "source_path": feat["source_path"],
            "group": assign_feature_group(fid),
            "scores": scores.get(fid, {}),
            "activity": activity.get(fid, {}),
        }
        buckets_map[feat["dimension"]].append(bucket_entry)

    # Order buckets: Functional Suitability first, then alphabetically
    bucket_order = [
        "Functional Suitability",
        *sorted(k for k in buckets_map if k != "Functional Suitability"),
    ]
    buckets = []
    for dim in bucket_order:
        if dim not in buckets_map:
            continue
        feats = buckets_map[dim]
        groups = group_features(feats)
        buckets.append({"dimension": dim, "groups": groups, "features": feats})

    # Generate findings (use period_commits since scores are keyed by period keys)
    findings = generate_findings(
        active_features,
        scores,
        period_commits,
        new_count,
        removed_count,
        repo_root=repo_root,
    )

    # Output
    output = {
        "analyzer": "evolution",
        "schema_version": 1,
        "skipped": False,
        "metrics": {
            "feature_count": len(active_features),
            "commit_count": len(period_commits),
            "granularity": granularity,
            "month_count": len(month_groups),
            "source_root": source_root,
            "new_features_detected": new_count,
            "removed_features": removed_count,
        },
        "months": month_groups,
        "buckets": buckets,
        "findings": findings,
    }

    json.dump(output, sys.stdout, indent=2)


if __name__ == "__main__":
    main()

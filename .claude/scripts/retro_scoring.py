"""Shared scoring for retro analyzers.

Maturity scoring (existence, size, test coverage, documentation signals)
and activity/churn tracking for features across git history.
"""

from __future__ import annotations

import sys
from collections import defaultdict
from pathlib import Path
from typing import Any

from retro_features import (
    DOCUMENT_EXTENSIONS,
    SCHEMA_EXTENSIONS,
    SCRIPT_EXTENSIONS,
    TEMPLATE_EXTENSIONS,
)
from retro_git import files_at_commit, git, git_check, line_count_at_commit

# Maturity signal weights
W_EXISTENCE = 0.35
W_SIZE = 0.25
W_TEST = 0.25
W_DOCS = 0.15


def find_test_path(feature: dict[str, Any]) -> list[str]:
    """Return candidate test file paths for a feature.

    Returns a list of possible test paths (most likely first).
    The caller checks which candidates actually exist in the commit tree.
    Non-source features (rules, templates, docs, scripts) return an empty
    list since they don't have conventional test files.
    """
    src_path = feature["source_path"]
    ext = Path(src_path).suffix
    stem = Path(src_path).stem

    # Non-source artifacts don't have conventional test files
    if (
        ext
        in DOCUMENT_EXTENSIONS
        | TEMPLATE_EXTENSIONS
        | SCHEMA_EXTENSIONS
        | SCRIPT_EXTENSIONS
    ):
        return []

    if ext == ".py":
        return [
            f"tests/test_{stem}.py",
            f"test/test_{stem}.py",
            f"tests/{stem}_test.py",
        ]
    if ext in {".js", ".jsx"}:
        return [
            f"__tests__/{stem}.test.js",
            f"tests/{stem}.test.js",
            f"test/{stem}.test.js",
        ]
    if ext in {".ts", ".tsx"}:
        return [
            f"__tests__/{stem}.test.ts",
            f"tests/{stem}.test.ts",
            f"test/{stem}.test.ts",
        ]
    if ext == ".rb":
        return [f"spec/{stem}_spec.rb"]
    if ext == ".go":
        # Go tests live alongside source
        parent = str(Path(src_path).parent)
        return [f"{parent}/{stem}_test.go"]

    return []


def find_doc_paths(feature: dict[str, Any]) -> list[str]:
    """Find documentation file paths for a feature."""
    stem = Path(feature["source_path"]).stem
    return [
        f"docs/{stem}.md",
        f"docs/designs/design-*{stem}*.md",
    ]


def compute_scores(
    repo_root: str,
    features: list[dict[str, Any]],
    sampled: list[dict[str, str]],
) -> dict[str, dict[str, float]]:
    """Compute maturity scores for all features at all sampled commits.

    Returns:
        {feature_id: {short_sha: score}}
    """
    if not features or not sampled:
        return {}

    # Pre-compute: for each commit, get the file tree
    print("[--] Building file trees for sampled commits...", file=sys.stderr)
    commit_trees: dict[str, set[str]] = {}
    for c in sampled:
        sha = c["sha"]
        commit_trees[sha] = files_at_commit(repo_root, sha)

    # Pre-compute: line counts per feature per commit (only for existing files)
    print("[--] Computing line counts...", file=sys.stderr)
    line_counts: dict[str, dict[str, int]] = defaultdict(dict)
    test_line_counts: dict[str, dict[str, int]] = defaultdict(dict)

    for feat in features:
        fid = feat["id"]
        src_path = feat["source_path"]
        test_candidates = find_test_path(feat)

        for c in sampled:
            sha = c["sha"]
            tree = commit_trees[sha]

            if src_path in tree:
                line_counts[fid][sha] = line_count_at_commit(repo_root, sha, src_path)
            else:
                line_counts[fid][sha] = 0

            # Find first matching test file in the commit tree.
            # Try exact path first, then fall back to filename match
            # (supports nested test dirs like tests/core/test_foo.py).
            test_lines = 0
            for tp in test_candidates:
                if tp in tree:
                    test_lines = line_count_at_commit(repo_root, sha, tp)
                    break
                basename = tp.rsplit("/", 1)[-1]
                match = next((f for f in tree if f.endswith("/" + basename)), None)
                if match:
                    test_lines = line_count_at_commit(repo_root, sha, match)
                    break
            test_line_counts[fid][sha] = test_lines

    # Pre-compute: doc companion counts
    doc_counts: dict[str, dict[str, int]] = defaultdict(dict)
    for feat in features:
        fid = feat["id"]
        doc_paths = find_doc_paths(feat)
        for c in sampled:
            sha = c["sha"]
            tree = commit_trees[sha]
            count = 0
            for dp in doc_paths:
                if "*" in dp:
                    # Wildcard: check if any file in tree matches
                    pattern = dp.replace("*", "")
                    count += sum(1 for f in tree if pattern in f)
                elif dp in tree:
                    count += 1
            doc_counts[fid][sha] = count

    # Compute raw scores
    print("[--] Computing maturity scores...", file=sys.stderr)
    raw_scores: dict[str, dict[str, float]] = defaultdict(dict)

    for feat in features:
        fid = feat["id"]
        src_path = feat["source_path"]

        # Peak line count for this feature
        peak_lines = max(line_counts[fid].values()) if line_counts[fid] else 1
        if peak_lines == 0:
            peak_lines = 1

        # Peak doc count
        peak_docs = max(doc_counts[fid].values()) if doc_counts[fid] else 1
        if peak_docs == 0:
            peak_docs = 1

        for c in sampled:
            sha = c["sha"]
            tree = commit_trees[sha]

            # Signal 1: Existence
            exists = 1.0 if src_path in tree else 0.0

            # Signal 2: Size (relative to peak)
            lines = line_counts[fid].get(sha, 0)
            size_score = lines / peak_lines if exists else 0.0

            # Signal 3: Test coverage
            test_lines = test_line_counts[fid].get(sha, 0)
            source_lines = line_counts[fid].get(sha, 0)
            test_score = (
                min(test_lines / source_lines, 1.0)
                if source_lines > 0 and test_lines > 0
                else 0.0
            )

            # Signal 4: Documentation
            docs = doc_counts[fid].get(sha, 0)
            doc_score = docs / peak_docs if exists else 0.0

            # Composite score
            raw = (
                W_EXISTENCE * exists
                + W_SIZE * size_score
                + W_TEST * test_score
                + W_DOCS * doc_score
            ) * 10.0

            raw_scores[fid][sha] = raw

    # Return raw scores keyed by full SHA.
    # Normalization happens after day-level aggregation in aggregate_by_period().
    return dict(raw_scores)


def compute_activity(
    repo_root: str,
    features: list[dict[str, Any]],
    sampled: list[dict[str, str]],
) -> dict[str, dict[str, int]]:
    """Compute activity (lines changed) for each feature at each sampled commit.

    Returns:
        {feature_id: {short_sha: lines_changed}}
        where lines_changed = lines_added + lines_deleted for that file in that commit.
    """
    if not features or not sampled:
        return {}

    print("[--] Computing activity (churn between sampled commits)...", file=sys.stderr)

    raw_activity: dict[str, dict[str, int]] = defaultdict(dict)

    prev_sha: str | None = None
    for c in sampled:
        sha = c["sha"]

        # Diff between consecutive sampled commits (not immediate parent).
        # For the first sampled commit, diff against its parent to capture
        # everything from the start of the window.
        if prev_sha is None:
            # Check if parent exists; for root commits, diff against empty tree
            has_parent = git_check(["rev-parse", "--verify", f"{sha}^"], repo_root)
            if has_parent:
                diff_args = ["diff", "--numstat", "--no-renames", f"{sha}^", sha]
            else:
                # Empty tree SHA — diff shows all files as added
                empty_tree = "4b825dc642cb6eb9a060e54bf899d69f82cf1085"
                diff_args = ["diff", "--numstat", "--no-renames", empty_tree, sha]
        else:
            diff_args = ["diff", "--numstat", "--no-renames", prev_sha, sha]

        output = git(diff_args, repo_root, timeout=15)

        # Parse: each line is "added\tdeleted\tfilepath"
        file_churn: dict[str, int] = {}
        if output:
            for line in output.split("\n"):
                parts = line.split("\t")
                if len(parts) < 3:
                    continue
                added_str, deleted_str, filepath = parts[0], parts[1], parts[2]
                # Binary files show "-" for added/deleted
                if added_str == "-" or deleted_str == "-":
                    continue
                try:
                    file_churn[filepath] = int(added_str) + int(deleted_str)
                except ValueError:
                    continue

        for feat in features:
            src_path = feat["source_path"]
            raw_activity[feat["id"]][sha] = file_churn.get(src_path, 0)

        prev_sha = sha

    # Return raw (unnormalized) activity keyed by full SHA.
    # Normalization happens after day-level aggregation in aggregate_by_period().
    return dict(raw_activity)

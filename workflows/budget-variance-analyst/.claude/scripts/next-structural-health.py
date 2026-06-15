#!/usr/bin/env python3
"""Next analyzer: Structural Health.

Detects monolithic files using AST-based static analysis with git-based
trend tracking. Produces ranked refactoring candidates with extraction
boundary suggestions.

Usage:
    python3 next-structural-health.py [--repo-root <path>] [--files f1 f2 ...]
                                      [--trend-days N]

Output: JSON to stdout. Info/errors to stderr.
"""

from __future__ import annotations

import ast
import json
import os
import subprocess
import sys
from collections import defaultdict
from dataclasses import dataclass, field
from itertools import combinations
from pathlib import Path
from typing import Any

# ---- Configuration ----------------------------------------------------------

MIN_LOC_THRESHOLD = 150

# Metric weights for composite score (must sum to 1.0)
METRIC_WEIGHTS = {
    "loc": 0.15,
    "func_count": 0.20,
    "class_count": 0.10,
    "max_complexity": 0.25,
    "max_func_length": 0.15,
    "import_clusters": 0.15,
}

# Normalization thresholds: (floor, ceiling)
METRIC_THRESHOLDS = {
    "loc": (200, 800),
    "func_count": (5, 25),
    "class_count": (1, 5),
    "max_complexity": (10, 40),
    "max_func_length": (30, 100),
    "import_clusters": (2, 6),
}

# Tier urgency multipliers
TIER_MULTIPLIERS = {1: 1.5, 2: 1.3, 3: 1.1, 4: 1.0, 5: 0.9}
TEST_MULTIPLIER = 0.5
SCRIPT_MULTIPLIER = 0.8

# Classification thresholds
REFACTOR_THRESHOLD = 60
WATCH_THRESHOLD = 40
TREND_SIGNIFICANCE = 5  # minimum delta to show trend arrow

# Directories to exclude during discovery
EXCLUDE_DIRS = {
    "__pycache__",
    "node_modules",
    ".venv",
    "venv",
    ".git",
    ".tox",
    ".mypy_cache",
    ".ruff_cache",
    ".pytest_cache",
    "templates",
    "dist",
    "build",
    "egg-info",
}


# ---- Data structures --------------------------------------------------------


@dataclass
class FileMetrics:
    """Raw metrics for a single file."""

    filepath: str
    loc: int = 0
    func_count: int = 0
    class_count: int = 0
    max_complexity: int = 0
    max_func_length: int = 0
    import_clusters: int = 0


@dataclass
class ExtractionBoundary:
    """A suggested extraction from a monolithic file."""

    name: str
    functions: list[str]
    estimated_lines: int
    confidence: str  # high, medium, low


@dataclass
class GodFunctionBlock:
    """An independent block inside a god function."""

    start_line: int
    end_line: int
    variables: set[str]
    description: str


@dataclass
class SimilarityCluster:
    """A group of near-duplicate functions."""

    functions: list[str]
    similarity: float  # 0-1 Jaccard similarity
    fingerprint_size: int


@dataclass
class ScoredFile:
    """A file with its monolith score and metadata."""

    filepath: str
    metrics: FileMetrics
    raw_score: float  # 0-100 before tier multiplier
    weighted_score: float  # after tier multiplier
    tier: int
    is_test: bool
    is_script: bool
    trend_delta: float | None  # None = no trend data
    trend_label: str  # "up", "down", "stable", "new", "unknown"
    boundaries: list[ExtractionBoundary] = field(default_factory=list)
    god_functions: dict[str, list[GodFunctionBlock]] = field(default_factory=dict)
    similarity_clusters: list[SimilarityCluster] = field(default_factory=list)
    responsibility_count: int = 0
    category: str = "monolith"


# ---- Git helpers ------------------------------------------------------------


def git(*args: str, cwd: str | None = None) -> str:
    """Run a git command and return stdout."""
    result = subprocess.run(
        ["git", *args],
        capture_output=True,
        text=True,
        cwd=cwd,
    )
    if result.returncode != 0:
        raise subprocess.CalledProcessError(result.returncode, ["git", *args])
    return result.stdout.strip()


def get_prior_sha(days: int = 30, cwd: str | None = None) -> str | None:
    """Find a commit from approximately N days ago."""
    try:
        sha = git(
            "log",
            f"--before={days} days ago",
            "-1",
            "--format=%H",
            cwd=cwd,
        )
        return sha if sha else None
    except subprocess.CalledProcessError:
        return None


def get_file_at_commit(sha: str, filepath: str, cwd: str | None = None) -> str | None:
    """Retrieve file content at a specific commit."""
    try:
        return git("show", f"{sha}:{filepath}", cwd=cwd)
    except subprocess.CalledProcessError:
        return None


# ---- AST analysis -----------------------------------------------------------

_COMPLEXITY_NODES = (
    ast.ExceptHandler,
    ast.Assert,
    ast.ListComp,
    ast.SetComp,
    ast.DictComp,
    ast.GeneratorExp,
)


def _calculate_complexity(node: ast.AST) -> int:
    """Calculate cyclomatic complexity of an AST node."""
    complexity = 1  # base
    for child in ast.walk(node):
        if isinstance(child, ast.If | ast.While | ast.For):
            complexity += 1
        elif isinstance(child, ast.BoolOp):
            complexity += len(child.values) - 1
        elif isinstance(child, _COMPLEXITY_NODES):
            complexity += 1
    return complexity


def _get_func_length(node: ast.FunctionDef | ast.AsyncFunctionDef) -> int:
    """Calculate the length of a function body in lines."""
    if not node.body:
        return 0
    first_line = node.body[0].lineno
    last_line = node.body[-1].end_lineno or node.body[-1].lineno
    return last_line - first_line + 1


def collect_metrics(source: str, filepath: str = "") -> FileMetrics:
    """Collect structural metrics from Python source code."""
    metrics = FileMetrics(filepath=filepath)
    metrics.loc = len(source.splitlines())

    try:
        tree = ast.parse(source)
    except SyntaxError:
        return metrics

    import_names: set[str] = set()
    max_cc = 0
    max_fl = 0

    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef | ast.AsyncFunctionDef):
            metrics.func_count += 1
            cc = _calculate_complexity(node)
            fl = _get_func_length(node)
            max_cc = max(max_cc, cc)
            max_fl = max(max_fl, fl)
        elif isinstance(node, ast.ClassDef):
            metrics.class_count += 1
        elif isinstance(node, ast.Import):
            for alias in node.names:
                import_names.add(alias.name.split(".")[0])
        elif isinstance(node, ast.ImportFrom):
            if node.module:
                import_names.add(node.module.split(".")[0])

    metrics.max_complexity = max_cc
    metrics.max_func_length = max_fl

    # Count distinct import source groups (simplified: unique top-level packages)
    # Group by rough category: we count distinct top-level import names as a proxy
    # for responsibility breadth. More imports from more packages = more concerns.
    metrics.import_clusters = len(import_names)

    return metrics


# ---- Scoring ----------------------------------------------------------------


def normalize(value: float, floor: float, ceiling: float) -> float:
    """Normalize a value to [0, 1] with linear interpolation."""
    if value <= floor:
        return 0.0
    if value >= ceiling:
        return 1.0
    return (value - floor) / (ceiling - floor)


def compute_monolith_score(metrics: FileMetrics) -> float:
    """Compute composite monolith score (0-100)."""
    score = 0.0
    values = {
        "loc": metrics.loc,
        "func_count": metrics.func_count,
        "class_count": metrics.class_count,
        "max_complexity": metrics.max_complexity,
        "max_func_length": metrics.max_func_length,
        "import_clusters": metrics.import_clusters,
    }
    for metric_name, weight in METRIC_WEIGHTS.items():
        floor, ceiling = METRIC_THRESHOLDS[metric_name]
        normalized = normalize(values[metric_name], floor, ceiling)
        score += normalized * weight

    return round(score * 100, 1)


# ---- Extraction boundary detection -----------------------------------------


def detect_boundaries(source: str, filepath: str) -> list[ExtractionBoundary]:
    """Detect potential extraction boundaries in a source file."""
    boundaries: list[ExtractionBoundary] = []

    try:
        tree = ast.parse(source)
    except SyntaxError:
        return boundaries

    # Collect function info
    functions: list[dict[str, Any]] = []
    for node in ast.iter_child_nodes(tree):
        if isinstance(node, ast.FunctionDef | ast.AsyncFunctionDef):
            func_length = _get_func_length(node)
            # Collect names called within this function
            calls: set[str] = set()
            imports_used: set[str] = set()
            for child in ast.walk(node):
                if isinstance(child, ast.Call):
                    if isinstance(child.func, ast.Name):
                        calls.add(child.func.id)
                    elif isinstance(child.func, ast.Attribute):
                        val = child.func.value
                        if isinstance(val, ast.Name):
                            imports_used.add(val.id)
                elif isinstance(child, ast.Name):
                    imports_used.add(child.id)
            functions.append(
                {
                    "name": node.name,
                    "lineno": node.lineno,
                    "end_lineno": node.end_lineno or node.lineno,
                    "length": func_length,
                    "calls": calls,
                    "imports_used": imports_used,
                }
            )

    # Collect top-level classes
    classes: list[dict[str, Any]] = []
    for node in ast.iter_child_nodes(tree):
        if isinstance(node, ast.ClassDef):
            class_length = (node.end_lineno or node.lineno) - node.lineno + 1
            _ft = ast.FunctionDef | ast.AsyncFunctionDef
            methods = [n.name for n in ast.iter_child_nodes(node) if isinstance(n, _ft)]
            classes.append(
                {
                    "name": node.name,
                    "lineno": node.lineno,
                    "length": class_length,
                    "methods": methods,
                }
            )

    if not functions and not classes:
        return boundaries

    # Strategy 1: Naming convention groups
    prefix_groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for func in functions:
        name = func["name"]
        # Extract prefix: check_, validate_, _generate_, etc.
        for sep in ("_",):
            parts = name.split(sep, 2)
            if len(parts) >= 2 and len(parts[0]) >= 2:
                prefix = parts[0] if not name.startswith("_") else "_" + parts[1]
                prefix_groups[prefix].append(func)
                break

    for prefix, group_funcs in prefix_groups.items():
        if len(group_funcs) >= 3:
            total_lines = sum(f["length"] for f in group_funcs)
            if total_lines >= 40:
                sfx = "_helpers" if prefix.startswith("_") else "_ops"
                suggested_name = f"{prefix}{sfx}"
                boundaries.append(
                    ExtractionBoundary(
                        name=suggested_name,
                        functions=[f["name"] for f in group_funcs],
                        estimated_lines=total_lines,
                        confidence="medium",
                    )
                )

    # Strategy 2: Function call clusters
    # Find groups of functions that call each other but aren't called externally
    func_names = {f["name"] for f in functions}
    for func in functions:
        cluster = {func["name"]}
        for other in functions:
            if other["name"] != func["name"] and func["name"] in other["calls"]:
                cluster.add(other["name"])
            if other["name"] in func["calls"] and other["name"] in func_names:
                cluster.add(other["name"])

        if len(cluster) >= 3:
            cluster_funcs = [f for f in functions if f["name"] in cluster]
            total_lines = sum(f["length"] for f in cluster_funcs)
            if total_lines >= 50:
                # Derive name from the primary (longest) function
                primary = max(cluster_funcs, key=lambda f: f["length"])
                suggested = primary["name"].lstrip("_").split("_")[0] + "_module"
                # Avoid duplicates
                existing_names = {b.name for b in boundaries}
                if suggested not in existing_names:
                    boundaries.append(
                        ExtractionBoundary(
                            name=suggested,
                            functions=sorted(cluster),
                            estimated_lines=total_lines,
                            confidence="high",
                        )
                    )

    # Strategy 3: Class-based boundaries
    if len(classes) >= 2:
        for cls in classes:
            if cls["length"] >= 30:
                boundaries.append(
                    ExtractionBoundary(
                        name=cls["name"].lower() + "_module",
                        functions=cls["methods"],
                        estimated_lines=cls["length"],
                        confidence="high",
                    )
                )

    # Strategy 4: Large standalone functions (>80 lines)
    for func in functions:
        if func["length"] >= 80:
            existing_funcs = set()
            for b in boundaries:
                existing_funcs.update(b.functions)
            if func["name"] not in existing_funcs:
                boundaries.append(
                    ExtractionBoundary(
                        name=func["name"].lstrip("_") + "_module",
                        functions=[func["name"]],
                        estimated_lines=func["length"],
                        confidence="low",
                    )
                )

    return boundaries


# ---- File discovery ---------------------------------------------------------


def discover_source_files(
    repo_root: Path,
    min_loc: int = MIN_LOC_THRESHOLD,
) -> list[Path]:
    """Discover Python files above the minimum LOC threshold."""
    src_dirs = [d for d in ["src", "lib", "app"] if (repo_root / d).is_dir()]
    if not src_dirs:
        src_dirs = ["."]

    # Also scan scripts directory
    scripts_dir = repo_root / ".claude" / "scripts"
    if scripts_dir.is_dir():
        src_dirs.append(str(scripts_dir.relative_to(repo_root)))

    files: list[Path] = []
    seen_names: set[str] = set()  # deduplicate dogfooding copies
    for src_dir in src_dirs:
        search_root = repo_root / src_dir
        for root, dirs, filenames in os.walk(search_root):
            # Filter excluded directories in-place
            excluded = EXCLUDE_DIRS
            dirs[:] = [d for d in dirs if d not in excluded and not d.startswith(".")]
            for fname in filenames:
                if not fname.endswith(".py"):
                    continue
                # Skip this analyzer itself
                if fname == "next-structural-health.py":
                    continue
                filepath = Path(root) / fname
                # Deduplicate: if a file with the same name exists in both
                # .claude/scripts/ and src/*/scripts/, keep only the src/ copy
                if "scripts" in filepath.parts:
                    if fname in seen_names:
                        continue
                    seen_names.add(fname)
                try:
                    loc = sum(1 for _ in filepath.open())
                    if loc >= min_loc:
                        files.append(filepath)
                except OSError:
                    continue

    return files


def is_test_file(filepath: Path) -> bool:
    """Check if a file is a test file."""
    name = filepath.name
    parts = filepath.parts
    is_test_name = name.startswith("test_") or name.endswith("_test.py")
    return is_test_name or "tests" in parts or "test" in parts


def is_script_file(filepath: Path, repo_root: Path) -> bool:
    """Check if a file is in a scripts directory."""
    try:
        rel = filepath.relative_to(repo_root)
        return "scripts" in rel.parts
    except ValueError:
        return False


# ---- Tier loading -----------------------------------------------------------


def load_module_tiers(repo_root: Path) -> dict[str, int]:
    """Load module tier assignments from coverage_tiers.py."""
    try:
        sys.path.insert(0, str(repo_root / "src"))
        from code_practices.quality.coverage_tiers import MODULE_TIERS

        return dict(MODULE_TIERS)
    except (ImportError, ModuleNotFoundError):
        return {}
    finally:
        if str(repo_root / "src") in sys.path:
            sys.path.remove(str(repo_root / "src"))


def get_tier(filepath: Path, module_tiers: dict[str, int]) -> int:
    """Get the tier for a module, defaulting to 5."""
    stem = filepath.stem
    return module_tiers.get(stem, 5)


def get_multiplier(tier: int, is_test: bool, is_script: bool) -> float:
    """Get the score multiplier based on file classification."""
    if is_test:
        return TEST_MULTIPLIER
    if is_script:
        return SCRIPT_MULTIPLIER
    return TIER_MULTIPLIERS.get(tier, 1.0)


# ---- Trend computation -----------------------------------------------------


def compute_trend(
    current_score: float,
    filepath: Path,
    prior_sha: str | None,
    repo_root: Path,
) -> tuple[float | None, str]:
    """Compute score trend by comparing against a prior commit.

    Returns (delta, label) where delta is the score change and label
    is one of: "up", "down", "stable", "new", "unknown".
    """
    if prior_sha is None:
        return None, "unknown"

    try:
        rel_path = filepath.relative_to(repo_root)
    except ValueError:
        return None, "unknown"

    prior_content = get_file_at_commit(
        prior_sha,
        str(rel_path),
        cwd=str(repo_root),
    )
    if prior_content is None:
        return None, "new"

    prior_metrics = collect_metrics(prior_content, str(rel_path))
    prior_score = compute_monolith_score(prior_metrics)
    delta = current_score - prior_score

    if delta >= TREND_SIGNIFICANCE:
        return delta, "up"
    elif delta <= -TREND_SIGNIFICANCE:
        return delta, "down"
    else:
        return delta, "stable"


# ---- Candidate generation ---------------------------------------------------


TREND_ARROWS = {
    "up": "\u2191",
    "down": "\u2193",
    "stable": "\u2192",
    "new": "new",
    "unknown": "",
}


def format_trend(delta: float | None, label: str) -> str:
    """Format trend for display in candidate title."""
    arrow = TREND_ARROWS.get(label, "")
    if label == "up" and delta is not None:
        return f"{arrow}{int(delta)} in 30d"
    elif label == "down" and delta is not None:
        return f"{arrow}{int(abs(delta))} in 30d"
    elif label == "stable":
        return f"{arrow} stable"
    elif label == "new":
        return "new"
    return ""


def classify_candidate(scored: ScoredFile) -> str | None:
    """Classify a scored file as 'refactor', 'watch', or None."""
    if scored.is_test:
        if scored.weighted_score >= WATCH_THRESHOLD:
            return "watch"
        return None

    if scored.weighted_score >= REFACTOR_THRESHOLD:
        if scored.tier <= 3 or (scored.is_script and scored.weighted_score >= 70):
            return "refactor"
        return "watch"

    if scored.weighted_score >= WATCH_THRESHOLD:
        return "watch"

    return None


def count_responsibilities(source: str) -> int:
    """Count distinct responsibilities via connected components.

    Builds an intra-file dependency graph where nodes are top-level
    definitions (functions, classes, constants). Edges connect nodes
    that share: direct calls, shared module-level variables, exclusive
    shared imports, or class membership. Connected components in this
    graph represent distinct responsibilities.
    """
    try:
        tree = ast.parse(source)
    except SyntaxError:
        return 1

    # Collect top-level definitions as nodes
    nodes: list[str] = []
    func_info: dict[str, dict[str, Any]] = {}
    class_methods: dict[str, list[str]] = {}

    for node in ast.iter_child_nodes(tree):
        if isinstance(node, ast.FunctionDef | ast.AsyncFunctionDef):
            nodes.append(node.name)
            calls: set[str] = set()
            name_refs: set[str] = set()
            imports_used: set[str] = set()
            for child in ast.walk(node):
                if isinstance(child, ast.Call) and isinstance(child.func, ast.Name):
                    calls.add(child.func.id)
                elif isinstance(child, ast.Name):
                    name_refs.add(child.id)
                elif isinstance(child, ast.Import | ast.ImportFrom):
                    if isinstance(child, ast.ImportFrom) and child.module:
                        imports_used.add(child.module.split(".")[0])
                    elif isinstance(child, ast.Import):
                        for alias in child.names:
                            imports_used.add(alias.name.split(".")[0])
            func_info[node.name] = {
                "calls": calls,
                "name_refs": name_refs,
                "imports_used": imports_used,
            }
        elif isinstance(node, ast.ClassDef):
            nodes.append(node.name)
            methods = []
            for child in ast.iter_child_nodes(node):
                if isinstance(child, ast.FunctionDef | ast.AsyncFunctionDef):
                    methods.append(child.name)
            class_methods[node.name] = methods

    # Collect module-level variable assignments
    module_vars: dict[str, set[str]] = defaultdict(set)
    for node in ast.iter_child_nodes(tree):
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name):
                    module_vars[target.id] = set()

    # Track which functions reference which module-level vars
    for fname, info in func_info.items():
        for ref in info["name_refs"]:
            if ref in module_vars:
                module_vars[ref].add(fname)

    if len(nodes) < 2:
        return 1

    # Union-Find
    parent: dict[str, str] = {n: n for n in nodes}

    def find(x: str) -> str:
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a: str, b: str) -> None:
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[ra] = rb

    # Edge 1: Direct call edges
    node_set = set(nodes)
    for fname, info in func_info.items():
        for called in info["calls"]:
            if called in node_set and called != fname:
                union(fname, called)

    # Edge 2: Shared module-level variables
    for users in module_vars.values():
        user_list = [u for u in users if u in node_set]
        for j in range(1, len(user_list)):
            union(user_list[0], user_list[j])

    # Edge 3: Class membership (all methods belong to same component as class)
    for cls_name, methods in class_methods.items():
        for method in methods:
            if method in node_set:
                union(cls_name, method)

    # Count components
    components: set[str] = set()
    for n in nodes:
        components.add(find(n))

    return max(len(components), 1)


def detect_god_functions(source: str) -> dict[str, list[GodFunctionBlock]]:
    """Detect god functions via variable lifetime gap analysis.

    A god function is a long function (80+ lines) that contains multiple
    independent blocks — sequences of code that use disjoint variable sets
    separated by gaps. Each gap indicates a potential extraction point.
    """
    try:
        tree = ast.parse(source)
    except SyntaxError:
        return {}

    GOD_FUNC_MIN_LINES = 80
    MIN_BLOCK_LINES = 10
    results: dict[str, list[GodFunctionBlock]] = {}

    for node in ast.walk(tree):
        if not isinstance(node, ast.FunctionDef | ast.AsyncFunctionDef):
            continue
        func_length = _get_func_length(node)
        if func_length < GOD_FUNC_MIN_LINES:
            continue

        # Build per-line variable usage map
        line_vars: dict[int, set[str]] = defaultdict(set)
        for child in ast.walk(node):
            if isinstance(child, ast.Name) and hasattr(child, "lineno"):
                line_vars[child.lineno].add(child.id)

        if not line_vars:
            continue

        # Find variable lifetime ranges
        var_ranges: dict[str, tuple[int, int]] = {}
        for line, names in line_vars.items():
            for name in names:
                if name in var_ranges:
                    first, last = var_ranges[name]
                    var_ranges[name] = (min(first, line), max(last, line))
                else:
                    var_ranges[name] = (line, line)

        # Scan for gaps: lines where no variable from the previous section
        # is still alive and new variables begin
        all_lines = sorted(line_vars.keys())
        if len(all_lines) < 2:
            continue

        # Group consecutive lines into blocks based on variable lifetime gaps
        blocks: list[GodFunctionBlock] = []
        current_block_start = all_lines[0]
        current_vars: set[str] = set(line_vars[all_lines[0]])
        prev_line = all_lines[0]

        for line in all_lines[1:]:
            # Check if any variable from current block is still alive at this line
            alive = False
            for var in current_vars:
                if var in var_ranges:
                    _, last = var_ranges[var]
                    if last >= line:
                        alive = True
                        break

            if not alive and (line - prev_line) >= 2:
                # Gap detected — close current block
                block_lines = prev_line - current_block_start + 1
                if block_lines >= MIN_BLOCK_LINES:
                    blocks.append(
                        GodFunctionBlock(
                            start_line=current_block_start,
                            end_line=prev_line,
                            variables=current_vars,
                            description=f"lines {current_block_start}-{prev_line}",
                        )
                    )
                current_block_start = line
                current_vars = set()

            current_vars.update(line_vars[line])
            prev_line = line

        # Close last block
        block_lines = prev_line - current_block_start + 1
        if block_lines >= MIN_BLOCK_LINES:
            blocks.append(
                GodFunctionBlock(
                    start_line=current_block_start,
                    end_line=prev_line,
                    variables=current_vars,
                    description=f"lines {current_block_start}-{prev_line}",
                )
            )

        if len(blocks) >= 2:
            results[node.name] = blocks

    return results


def _ast_fingerprint(node: ast.AST) -> list[str]:
    """Create a normalized AST fingerprint for a function.

    Replaces all identifiers with generic tokens so structurally similar
    functions match even with different variable/function names.
    """
    tokens: list[str] = []
    for child in ast.walk(node):
        node_type = type(child).__name__
        if isinstance(child, ast.Name):
            tokens.append("NAME")
        elif isinstance(child, ast.Constant):
            tokens.append(f"CONST:{type(child.value).__name__}")
        elif isinstance(child, ast.Call):
            tokens.append("CALL")
        elif isinstance(child, ast.FunctionDef | ast.AsyncFunctionDef):
            tokens.append("FUNCDEF")
        elif isinstance(child, ast.For | ast.While):
            tokens.append("LOOP")
        elif isinstance(child, ast.If):
            tokens.append("IF")
        elif isinstance(child, ast.Return):
            tokens.append("RETURN")
        elif isinstance(child, ast.Assign | ast.AugAssign | ast.AnnAssign):
            tokens.append("ASSIGN")
        elif isinstance(child, ast.Attribute):
            tokens.append("ATTR")
        else:
            tokens.append(node_type)
    return tokens


def _ngram_set(tokens: list[str], n: int = 3) -> set[tuple[str, ...]]:
    """Generate n-gram set from a token sequence."""
    if len(tokens) < n:
        return {tuple(tokens)}
    return {tuple(tokens[i : i + n]) for i in range(len(tokens) - n + 1)}


def detect_similarity_clusters(
    source: str,
    threshold: float = 0.6,
) -> list[SimilarityCluster]:
    """Detect near-duplicate functions via AST fingerprint n-gram Jaccard similarity.

    Functions with Jaccard similarity above threshold are grouped into clusters.
    Only considers functions with 10+ tokens (tiny functions match trivially).
    """
    try:
        tree = ast.parse(source)
    except SyntaxError:
        return []

    MIN_TOKENS = 10
    func_fingerprints: list[tuple[str, set[tuple[str, ...]], int]] = []

    for node in ast.iter_child_nodes(tree):
        if isinstance(node, ast.FunctionDef | ast.AsyncFunctionDef):
            tokens = _ast_fingerprint(node)
            if len(tokens) >= MIN_TOKENS:
                ngrams = _ngram_set(tokens)
                func_fingerprints.append((node.name, ngrams, len(tokens)))
        elif isinstance(node, ast.ClassDef):
            for child in ast.iter_child_nodes(node):
                if isinstance(child, ast.FunctionDef | ast.AsyncFunctionDef):
                    tokens = _ast_fingerprint(child)
                    if len(tokens) >= MIN_TOKENS:
                        ngrams = _ngram_set(tokens)
                        func_fingerprints.append(
                            (f"{node.name}.{child.name}", ngrams, len(tokens)),
                        )

    if len(func_fingerprints) < 2:
        return []

    # Pairwise Jaccard similarity
    clusters: list[SimilarityCluster] = []
    clustered: set[str] = set()

    for (name_a, ngrams_a, size_a), (name_b, ngrams_b, size_b) in combinations(
        func_fingerprints,
        2,
    ):
        if name_a in clustered and name_b in clustered:
            continue
        intersection = len(ngrams_a & ngrams_b)
        union_size = len(ngrams_a | ngrams_b)
        if union_size == 0:
            continue
        jaccard = intersection / union_size
        if jaccard >= threshold:
            # Find or extend existing cluster
            found = False
            for cluster in clusters:
                if name_a in cluster.functions or name_b in cluster.functions:
                    if name_a not in cluster.functions:
                        cluster.functions.append(name_a)
                    if name_b not in cluster.functions:
                        cluster.functions.append(name_b)
                    cluster.similarity = min(cluster.similarity, jaccard)
                    found = True
                    break
            if not found:
                clusters.append(
                    SimilarityCluster(
                        functions=[name_a, name_b],
                        similarity=round(jaccard, 2),
                        fingerprint_size=max(size_a, size_b),
                    )
                )
            clustered.add(name_a)
            clustered.add(name_b)

    return clusters


def build_candidate(scored: ScoredFile, classification: str) -> dict[str, Any]:
    """Build a /next analyzer candidate dict."""
    trend_str = format_trend(scored.trend_delta, scored.trend_label)
    trend_suffix = f" ({trend_str})" if trend_str else ""
    responsibilities = scored.responsibility_count

    if classification == "refactor":
        title = (
            f"Refactor {scored.filepath} \u2014 "
            f"{responsibilities} responsibilities, "
            f"max complexity {scored.metrics.max_complexity}"
            f"{trend_suffix}"
        )
    else:
        ws = scored.weighted_score
        title = f"Watch {scored.filepath} \u2014 monolith score {ws:.0f}{trend_suffix}"

    # Format extraction boundaries for details
    boundary_details = []
    for b in scored.boundaries:
        funcs_str = ", ".join(b.functions[:5])
        if len(b.functions) > 5:
            funcs_str += f", ... (+{len(b.functions) - 5} more)"
        info = f"{b.estimated_lines} lines, {b.confidence} confidence"
        boundary_details.append(f"Extract {b.name} ({info}): {funcs_str}")

    # Add god function info
    for func_name, blocks in scored.god_functions.items():
        boundary_details.append(
            f"God function {func_name}: {len(blocks)} independent blocks "
            f"({', '.join(b.description for b in blocks[:3])})"
        )

    # Add similarity cluster info
    for cluster in scored.similarity_clusters:
        sim = cluster.similarity
        fns = ", ".join(cluster.functions[:5])
        boundary_details.append(f"Near-duplicates ({sim:.0%} similar): {fns}")

    _fallback = "File exceeds monolith thresholds but no clear extraction boundaries."
    details = ". ".join(boundary_details) if boundary_details else _fallback

    # Determine effort
    if scored.raw_score >= 70:
        effort = "L"
    elif scored.raw_score >= 50:
        effort = "M"
    else:
        effort = "S"

    trend_evidence = ""
    if scored.trend_delta is not None:
        trend_evidence = f",trend={scored.trend_delta:+.0f}"

    # Build enhanced evidence string
    god_count = sum(len(blocks) for blocks in scored.god_functions.values())
    sim_count = len(scored.similarity_clusters)
    extra_evidence = ""
    if god_count:
        extra_evidence += f",god_funcs={len(scored.god_functions)}"
    if sim_count:
        extra_evidence += f",near_dupes={sim_count}"

    return {
        "title": title,
        "dimension": "structural_health",
        "category": scored.category,
        "evidence": (
            f"{scored.filepath}:score={scored.weighted_score:.0f},"
            f"responsibilities={responsibilities},"
            f"funcs={scored.metrics.func_count},"
            f"max_cc={scored.metrics.max_complexity},"
            f"loc={scored.metrics.loc}"
            f"{extra_evidence}"
            f"{trend_evidence}"
        ),
        "effort": effort,
        "details": details,
        "ivi_hints": {
            "code_blast_radius": f"{responsibilities} responsibilities raise risk",
            "bug_risk": (
                f"Max complexity {scored.metrics.max_complexity} "
                f"{'exceeds' if scored.metrics.max_complexity > 25 else 'approaches'} "
                f"safe reasoning threshold"
            ),
            "sustainable_maintainability": "Improves testability and focus",
            "developer_experience_impact": "Smaller modules are easier to navigate",
        },
    }


# ---- Main -------------------------------------------------------------------


def main() -> None:
    """Run the structural health analyzer."""
    repo_root = ""
    explicit_files: list[str] = []
    trend_days = 30

    # Parse arguments
    args = sys.argv[1:]
    i = 0
    while i < len(args):
        if args[i] == "--repo-root" and i + 1 < len(args):
            repo_root = args[i + 1]
            i += 2
        elif args[i] == "--trend-days" and i + 1 < len(args):
            trend_days = int(args[i + 1])
            i += 2
        elif args[i] == "--files":
            i += 1
            while i < len(args) and not args[i].startswith("--"):
                explicit_files.append(args[i])
                i += 1
        else:
            print(f"[!!] Unknown argument: {args[i]}", file=sys.stderr)
            sys.exit(1)

    # Resolve repo root
    if repo_root:
        root = Path(repo_root).resolve()
    else:
        try:
            root = Path(git("rev-parse", "--show-toplevel")).resolve()
        except subprocess.CalledProcessError:
            root = Path.cwd()

    os.chdir(root)
    print("[--] Analyzing structural health", file=sys.stderr)

    # Load optional tier data
    module_tiers = load_module_tiers(root)

    # Discover or use explicit files
    if explicit_files:
        py_files = [f for f in explicit_files if f.endswith(".py") and Path(f).exists()]
        files = [Path(f).resolve() for f in py_files]
    else:
        files = discover_source_files(root)

    if not files:
        print(
            json.dumps(
                {
                    "analyzer": "structural_health",
                    "schema_version": 1,
                    "skipped": False,
                    "candidates": [],
                },
                indent=2,
            )
        )
        return

    # Get prior commit for trend comparison
    prior_sha = get_prior_sha(trend_days, cwd=str(root))
    if prior_sha:
        sha = prior_sha[:8]
        print(f"[--] Trend baseline: {sha} ({trend_days}d ago)", file=sys.stderr)
    else:
        print(f"[--] No commit {trend_days}d ago, skipping trends", file=sys.stderr)

    # Analyze each file
    scored_files: list[ScoredFile] = []
    for filepath in files:
        try:
            source = filepath.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            continue

        rel_path = filepath.relative_to(root)
        metrics = collect_metrics(source, str(rel_path))
        raw_score = compute_monolith_score(metrics)

        test = is_test_file(filepath)
        script = is_script_file(filepath, root)
        tier = get_tier(filepath, module_tiers)
        multiplier = get_multiplier(tier, test, script)
        weighted_score = min(raw_score * multiplier, 100.0)

        # Compute trend
        trend_delta, trend_label = compute_trend(
            raw_score,
            filepath,
            prior_sha,
            root,
        )

        scored = ScoredFile(
            filepath=str(rel_path),
            metrics=metrics,
            raw_score=raw_score,
            weighted_score=round(weighted_score, 1),
            tier=tier,
            is_test=test,
            is_script=script,
            trend_delta=trend_delta,
            trend_label=trend_label,
        )

        # Run deep analysis for files above watch threshold
        if weighted_score >= WATCH_THRESHOLD:
            scored.boundaries = detect_boundaries(source, str(rel_path))
            scored.responsibility_count = count_responsibilities(source)
            scored.god_functions = detect_god_functions(source)
            scored.similarity_clusters = detect_similarity_clusters(source)
        else:
            scored.responsibility_count = 1

        scored_files.append(scored)

    # Sort by weighted score descending
    scored_files.sort(key=lambda s: -s.weighted_score)

    # Build candidates
    candidates = []
    for scored in scored_files:
        classification = classify_candidate(scored)
        if classification:
            candidates.append(build_candidate(scored, classification))

    print(
        f"[--] Found {len(candidates)} candidates "
        f"({sum(1 for c in candidates if 'Refactor' in c['title'])} refactor, "
        f"{sum(1 for c in candidates if 'Watch' in c['title'])} watch)",
        file=sys.stderr,
    )

    print(
        json.dumps(
            {
                "analyzer": "structural_health",
                "schema_version": 1,
                "skipped": False,
                "candidates": candidates,
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()

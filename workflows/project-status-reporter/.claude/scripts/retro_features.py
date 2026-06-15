"""Shared feature discovery for retro analyzers.

Multi-pass feature extraction, name humanization, ISO 25010 dimension
classification, and feature map persistence/reconciliation.
"""

from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Any

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

INFRASTRUCTURE_FILES = {
    "__init__.py",
    "__main__.py",
    "conftest.py",
    "setup.py",
    "setup.cfg",
    "manage.py",
    "wsgi.py",
    "asgi.py",
    "py.typed",
    "README.md",  # Index files in subdirectories
}

# Extensions for non-code artifacts that constitute features
SCRIPT_EXTENSIONS = {".sh", ".bash"}
SCRIPT_EXTENSIONS_ALL = {".sh", ".bash", ".py"}  # Includes Python scripts
DOCUMENT_EXTENSIONS = {".md"}
TEMPLATE_EXTENSIONS = {".j2", ".hbs", ".ejs", ".erb"}
SCHEMA_EXTENSIONS = {".json", ".yaml", ".yml"}

# Well-known directories that contain feature artifacts (within source roots)
# Format: (dir_name, extensions_to_scan, id_prefix, skill_mode)
ARTIFACT_DIRS: list[tuple[str, set[str] | None, str, bool]] = [
    ("rules_superset", DOCUMENT_EXTENSIONS, "rules", False),
    ("skills_superset", None, "skills", True),  # Special: SKILL.md in subdirs
    ("scripts", SCRIPT_EXTENSIONS_ALL, "scripts", False),
    ("guides_superset", DOCUMENT_EXTENSIONS, "guides", False),
    ("risk_docs", DOCUMENT_EXTENSIONS | SCHEMA_EXTENSIONS, "risk-docs", False),
    ("templates", None, "templates", False),  # Special: group by directory
    ("schemas", SCHEMA_EXTENSIONS, "schemas", False),
]

# Also scan these at repo root level (for non-src-based repos)
ROOT_ARTIFACT_DIRS: list[tuple[str, set[str] | None, str, bool]] = [
    ("rules", DOCUMENT_EXTENSIONS, "rules", False),
    ("scripts", SCRIPT_EXTENSIONS_ALL, "scripts", False),
    ("skills", None, "skills", True),
    ("guides", DOCUMENT_EXTENSIONS, "guides", False),
]

SKIP_DIRS = {
    ".git",
    ".venv",
    "venv",
    "node_modules",
    "__pycache__",
    ".mypy_cache",
    ".pytest_cache",
    ".ruff_cache",
    "dist",
    "build",
    "egg-info",
    ".eggs",
    ".tox",
}

SOURCE_EXTENSIONS = {
    ".py",
    ".js",
    ".ts",
    ".tsx",
    ".jsx",
    ".swift",
    ".go",
    ".rs",
    ".rb",
    ".java",
    ".kt",
    ".cs",
    ".cpp",
    ".c",
    ".h",
    ".dart",
}

TEST_DIR_NAMES = {"test", "tests", "spec", "specs", "__tests__", "test_"}

ABBREVIATIONS = {
    "cli": "CLI",
    "api": "API",
    "db": "DB",
    "ui": "UI",
    "prd": "PRD",
    "a2a": "A2A",
    "io": "I/O",
    "http": "HTTP",
    "url": "URL",
    "id": "ID",
    "jwt": "JWT",
    "oauth": "OAuth",
    "sql": "SQL",
    "csv": "CSV",
    "json": "JSON",
    "yaml": "YAML",
    "xml": "XML",
    "html": "HTML",
    "css": "CSS",
    "sdk": "SDK",
    "mcp": "MCP",
    "scoring": "Scoring",
    "code_practices": "CP",
    "pr": "PR",
    "ci": "CI",
    "cd": "CD",
}

# ISO 25010 dimension classification signals.
# Order matters: first match wins. More specific signals before broader ones.
DIMENSION_SIGNALS: dict[str, list[str]] = {
    "Security": [
        "auth",
        "security",
        "permission",
        "secret",
        "crypt",
        "password",
        "credential",
        "sanitize",
        "acl",
        "rbac",
        "oauth",
        "jwt",
        "risk",
        "vulnerability",
        "bandit",
    ],
    "Maintainability": [
        "lint",
        "format",
        "style",
        "coverage",
        "quality",
        "tier",
        "refactor",
        "migration",
        "mutation",
        "changelog",
        "version",
        "convention",
        "standard",
        "self-correction",
        "retro",
        "review",
        "code-review",
        "badge",
        "paradigm",
    ],
    "Reliability": [
        "test",
        "validate",
        "rollback",
        "retry",
        "fault",
        "error",
        "recovery",
        "backup",
        "health",
        "guard",
        "protect",
        "pre-commit",
        "compliance",
        "enforce",
    ],
    "Usability": [
        "readme",
        "guide",
        "help",
        "prompt",
        "wizard",
        "tutorial",
        "onboard",
        "questionnaire",
        "cli ",
        "session",
        "prd",
    ],
    "Performance Efficiency": [
        "cache",
        "pool",
        "async",
        "queue",
        "worker",
        "batch",
        "optimize",
        "perf",
        "throttle",
        "buffer",
    ],
    "Compatibility": [
        "a2a",
        "api",
        "protocol",
        "client",
        "adapter",
        "plugin",
        "interface",
        "bridge",
        "gateway",
        "proxy",
        "registry",
        "hook",
        "mcp",
    ],
    "Portability": [
        "docker",
        "deploy",
        "scaffold",
        "template",
        "setup",
        "install",
        "env",
        "config",
        "gitignore",
        "ci",
        "build",
        "package",
        "worktree",
        "branch",
        "stage",
        "rebase",
    ],
}


# ---------------------------------------------------------------------------
# Feature extraction
# ---------------------------------------------------------------------------


def detect_source_roots(repo_root: str) -> list[str]:
    """Detect source root directories in the repo."""
    root = Path(repo_root)
    candidates: list[str] = []

    # Check src/<pkg>/ layout (Python, Rust, etc.)
    src_dir = root / "src"
    if src_dir.is_dir():
        for child in sorted(src_dir.iterdir()):
            if not child.is_dir():
                continue
            if child.name.startswith("."):
                continue
            if child.name in SKIP_DIRS:
                continue
            candidates.append(
                str(child.relative_to(root)),
            )
            break  # Take the first package

    # Check common source directories
    for dirname in ("lib", "app", "pkg", "internal", "cmd"):
        d = root / dirname
        if d.is_dir():
            candidates.append(dirname)

    # If nothing found, use top-level source files
    if not candidates:
        for child in sorted(root.iterdir()):
            if (
                child.is_dir()
                and not child.name.startswith(".")
                and child.name not in SKIP_DIRS
                and child.name not in TEST_DIR_NAMES
                and child.name
                not in {
                    "docs",
                    "doc",
                    "scripts",
                    "config",
                    "configs",
                    "data",
                    "assets",
                    "static",
                    "public",
                    "vendor",
                    "third_party",
                }
            ):
                # Check if it contains source files
                src_files = (f for f in child.rglob("*") if f.is_file())
                has_source = any(f.suffix in SOURCE_EXTENSIONS for f in src_files)
                if has_source:
                    candidates.append(child.name)

    return candidates if candidates else ["."]


def _make_fid(prefix: str, rel: Path) -> str:
    """Build a feature ID from prefix and relative path."""
    stem = str(rel.with_suffix(""))
    return f"{prefix}/{stem.replace(os.sep, '/')}"


def extract_features(repo_root: str, source_roots: list[str]) -> list[dict[str, Any]]:
    """Extract features from source code, rules, skills, scripts, etc.

    Multi-pass extraction for a MECE (Mutually Exclusive, Collectively Exhaustive)
    feature inventory:
      1. Source code modules (.py, .js, .ts, etc.)
      2. Rules/governance documents (.md in rules_superset/ or rules/)
      3. Skills (SKILL.md in skill directories)
      4. Scripts (.sh automation scripts)
      5. Templates (.j2 files grouped by template chain directory)
      6. Guides, risk docs, schemas
    """
    root = Path(repo_root)
    features: list[dict[str, Any]] = []
    seen_ids: set[str] = set()

    def _add(
        feature_id: str,
        name: str,
        source_path: str,
        filepath: Path,
        rel_path: Path,
    ) -> None:
        if feature_id in seen_ids:
            return
        seen_ids.add(feature_id)
        features.append(
            {
                "id": feature_id,
                "name": name,
                "source_path": source_path,
                "dimension": classify_dimension(filepath, rel_path),
                "status": "active",
                "auto_classified": True,
            }
        )

    # --- Pass 1: Source code modules ---
    for src_root in source_roots:
        src_path = root / src_root
        if not src_path.exists():
            continue

        for f in sorted(src_path.rglob("*")):
            if not f.is_file():
                continue
            if f.suffix not in SOURCE_EXTENSIONS:
                continue
            if f.name in INFRASTRUCTURE_FILES:
                continue

            rel = f.relative_to(root)
            parts = rel.parts
            if any(p in TEST_DIR_NAMES for p in parts):
                continue
            if f.name.startswith("test_") or f.name.endswith("_test.py"):
                continue

            # Skip files inside artifact directories (handled in pass 2)
            rel_to_src = f.relative_to(src_path)
            first_dir = rel_to_src.parts[0] if len(rel_to_src.parts) > 1 else ""
            artifact_dir_names = {d[0] for d in ARTIFACT_DIRS}
            if first_dir in artifact_dir_names:
                continue

            feature_id = str(rel_to_src.with_suffix("")).replace(os.sep, "/")
            _add(feature_id, humanize_name(feature_id), str(rel), f, rel)

    # --- Pass 2: Non-code artifacts in source root subdirectories ---
    for src_root in source_roots:
        src_path = root / src_root
        if not src_path.exists():
            continue

        for dir_name, extensions, prefix, skill_mode in ARTIFACT_DIRS:
            artifact_dir = src_path / dir_name
            if not artifact_dir.is_dir():
                continue

            if skill_mode:
                # Each subdirectory with a SKILL.md is a skill feature
                for skill_dir in sorted(artifact_dir.iterdir()):
                    if not skill_dir.is_dir():
                        continue
                    skill_file = skill_dir / "SKILL.md"
                    if skill_file.exists():
                        rel = skill_file.relative_to(root)
                        fid = f"{prefix}/{skill_dir.name}"
                        name = f"{humanize_name(skill_dir.name)} Skill"
                        _add(fid, name, str(rel), skill_file, rel)
            elif dir_name == "templates":
                # Each template subdirectory is a feature
                for tmpl_dir in sorted(artifact_dir.iterdir()):
                    if not tmpl_dir.is_dir():
                        continue
                    # Find a representative file
                    j2_files = sorted(tmpl_dir.rglob("*"))
                    j2_files = [f for f in j2_files if f.is_file()]
                    if not j2_files:
                        continue
                    rep = j2_files[0]
                    rel = rep.relative_to(root)
                    fid = f"{prefix}/{tmpl_dir.name}"
                    # Clean up name: remove leading underscores
                    clean_name = tmpl_dir.name.lstrip("_")
                    name = f"{humanize_name(clean_name)} Template"
                    _add(fid, name, str(rel), rep, rel)
            else:
                # Each file matching the extensions is a feature
                if extensions is None:  # pragma: no cover
                    continue
                for f in sorted(artifact_dir.rglob("*")):
                    if not f.is_file():
                        continue
                    if f.suffix not in extensions:
                        continue
                    if f.name in INFRASTRUCTURE_FILES:
                        continue

                    rel = f.relative_to(root)
                    rel_to_artifact = f.relative_to(artifact_dir)
                    fid = _make_fid(prefix, rel_to_artifact)
                    _add(fid, _artifact_name(prefix, rel_to_artifact), str(rel), f, rel)

    # --- Pass 3: Root-level artifact directories (for non-src repos) ---
    for dir_name, extensions, prefix, skill_mode in ROOT_ARTIFACT_DIRS:
        artifact_dir = root / dir_name
        if not artifact_dir.is_dir():
            continue
        # Skip if already scanned as a source root
        already_scanned = False
        for src_root in source_roots:
            nested = (root / src_root / dir_name).is_dir()
            if nested or dir_name.startswith(src_root):
                already_scanned = True
                break
        if already_scanned:
            continue

        if skill_mode:
            for skill_dir in sorted(artifact_dir.iterdir()):
                if not skill_dir.is_dir():
                    continue
                skill_file = skill_dir / "SKILL.md"
                if skill_file.exists():
                    rel = skill_file.relative_to(root)
                    fid = f"{prefix}/{skill_dir.name}"
                    name = f"{humanize_name(skill_dir.name)} Skill"
                    _add(fid, name, str(rel), skill_file, rel)
        elif extensions is not None:
            for f in sorted(artifact_dir.rglob("*")):
                if not f.is_file():
                    continue
                if f.suffix not in extensions:
                    continue
                if f.name in INFRASTRUCTURE_FILES:
                    continue
                rel = f.relative_to(root)
                rel_to_artifact = f.relative_to(artifact_dir)
                fid = _make_fid(prefix, rel_to_artifact)
                _add(fid, _artifact_name(prefix, rel_to_artifact), str(rel), f, rel)

    return features


def _artifact_name(prefix: str, rel_path: Path) -> str:
    """Generate a human-readable name for a non-code artifact.

    Examples:
        rules, git.md -> "Git Rule"
        scripts, stage-all-files.sh -> "Stage All Files Script"
        guides, skills.md -> "Skills Guide"
        risk-docs, risk-matrix.md -> "Risk Matrix"
    """
    suffix_labels = {
        "rules": "Rule",
        "scripts": "Script",
        "guides": "Guide",
        "schemas": "Schema",
    }
    base = humanize_name(str(rel_path.with_suffix("")).replace(os.sep, "/"))
    label = suffix_labels.get(prefix, "")
    if label:
        return f"{base} {label}"
    return base


def humanize_name(feature_id: str) -> str:
    """Convert a feature ID to a human-readable name.

    Examples:
        scaffold -> Scaffold
        rules_manager -> Rules Manager
        a2a -> A2A
        gitignore_builder -> Gitignore Builder
        conventions/python -> Python Conventions
    """
    components = feature_id.split("/")

    # For multi-component paths, humanize the last component and add
    # context from parent dirs if the parent is a known category
    if len(components) >= 2:
        parent = components[-2]
        child = components[-1]
        child_name = _humanize_single(child)
        # If parent is a category like "conventions", append it
        if parent.lower() in {"conventions", "workflows", "integrations", "deploy"}:
            return f"{child_name} {_humanize_single(parent)}"
        return child_name

    return _humanize_single(components[-1])


def _humanize_single(name: str) -> str:
    """Humanize a single name component."""
    # Split on underscores, hyphens, and camelCase boundaries
    parts = re.split(r"[_\-]", name)
    expanded: list[str] = []
    for part in parts:
        camel_parts = re.sub(r"([a-z])([A-Z])", r"\1_\2", part).split("_")
        expanded.extend(camel_parts)

    result: list[str] = []
    for word in expanded:
        lower = word.lower()
        if lower in ABBREVIATIONS:
            result.append(ABBREVIATIONS[lower])
        elif word:
            result.append(word.capitalize())

    return " ".join(result) if result else name


def classify_dimension(filepath: Path, rel_path: Path) -> str:
    """Classify a feature into an ISO 25010 dimension using generic heuristics.

    Classification uses the file name and path only — not file content.
    This avoids false positives from incidental keywords in imports/docstrings.

    Priority:
    1. Path-based structural signals (templates/, guides/, risk_docs/, etc.)
    2. File name keyword signals against DIMENSION_SIGNALS
    3. Default: Functional Suitability
    """
    name_lower = filepath.stem.lower()
    path_lower = str(rel_path).lower()

    # --- Structural signals from directory/path ---
    if "templates" in path_lower:
        return "Portability"
    if "guides" in path_lower:
        return "Usability"
    if "risk_doc" in path_lower:
        return "Security"
    if "schema" in path_lower:
        return "Maintainability"

    # Use file name + path for keyword matching (not content — too noisy)
    combined = f"{name_lower} {path_lower}"

    for dimension, signals in DIMENSION_SIGNALS.items():
        for signal in signals:
            if signal in combined:
                return dimension

    return "Functional Suitability"


# ---------------------------------------------------------------------------
# Feature map persistence (label stability)
# ---------------------------------------------------------------------------


def load_feature_map(repo_root: str) -> dict[str, Any] | None:
    """Load existing feature map from docs/retro/feature-map.json."""
    path = Path(repo_root) / "docs" / "retro" / "feature-map.json"
    if not path.exists():
        return None
    try:
        with open(path) as fh:
            data: dict[str, Any] = json.load(fh)
            return data
    except (json.JSONDecodeError, OSError):
        return None


def save_feature_map(repo_root: str, feature_map: dict[str, Any]) -> None:
    """Save feature map to docs/retro/feature-map.json."""
    path = Path(repo_root) / "docs" / "retro" / "feature-map.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as fh:
        json.dump(feature_map, fh, indent=2)
        fh.write("\n")


def reconcile_features(
    discovered: list[dict[str, Any]],
    existing_map: dict[str, Any] | None,
    source_root: str,
) -> tuple[list[dict[str, Any]], int, int]:
    """Reconcile discovered features with existing feature map.

    Returns:
        (features, new_count, removed_count)
    """
    if existing_map is None:
        return discovered, len(discovered), 0

    existing_features = existing_map.get("features", {})
    discovered_ids = {f["id"] for f in discovered}

    # Start with existing features, preserving manual edits
    reconciled: list[dict[str, Any]] = []
    new_count = 0
    removed_count = 0

    # Update existing features
    for feat in discovered:
        fid = feat["id"]
        if fid in existing_features:
            # Preserve existing name and dimension (may have been manually edited)
            existing = existing_features[fid]
            feat["name"] = existing.get("name", feat["name"])
            feat["dimension"] = existing.get("dimension", feat["dimension"])
            feat["auto_classified"] = existing.get("auto_classified", True)
            feat["status"] = "active"
        else:
            new_count += 1
        reconciled.append(feat)

    # Mark removed features
    for fid, existing in existing_features.items():
        if fid not in discovered_ids and existing.get("status") != "removed":
            existing["status"] = "removed"
            reconciled.append(existing)
            removed_count += 1

    return reconciled, new_count, removed_count

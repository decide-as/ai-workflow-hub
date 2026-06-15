#!/usr/bin/env python3
"""Directory size enforcement.

Detects directories with too many files (overflow) and subdirectories with
too few files (underflow). Uses language-aware thresholds with per-directory
opt-out support.

Usage:
    python3 check-dir-size.py [--root <path>] [--language <lang>] [--verbose]
                              [--dry-run] [--json]

Exit codes:
    0  No overflow violations (or --dry-run)
    1  One or more overflow violations found
"""

from __future__ import annotations

import argparse
import fnmatch
import os
import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

# ---- Language configuration -------------------------------------------------


@dataclass(frozen=True)
class LanguageConfig:
    """Per-language thresholds and file classification."""

    threshold: int
    test_threshold: int
    init_files: frozenset[str]
    infra_files: frozenset[str]
    infra_dirs: frozenset[str]
    test_indicators: frozenset[str]
    exempt_marker_files: frozenset[str]
    exempt_marker_pattern: str | None
    extensions: frozenset[str]


DEFAULT_CONFIG = LanguageConfig(
    threshold=10,
    test_threshold=15,
    init_files=frozenset(),
    infra_files=frozenset(),
    infra_dirs=frozenset(),
    test_indicators=frozenset({"tests", "test", "testing", "__tests__", "spec"}),
    exempt_marker_files=frozenset(),
    exempt_marker_pattern=None,
    extensions=frozenset(),
)

LANGUAGE_CONFIGS: dict[str, LanguageConfig] = {
    "python": LanguageConfig(
        threshold=14,
        test_threshold=15,
        init_files=frozenset({"__init__.py"}),
        infra_files=frozenset(
            {
                "__init__.py",
                "conftest.py",
                "setup.py",
                "setup.cfg",
                "py.typed",
            }
        ),
        infra_dirs=frozenset(
            {
                "__pycache__",
                ".mypy_cache",
                "migrations",
                "__pypackages__",
            }
        ),
        test_indicators=frozenset({"tests", "test", "testing"}),
        exempt_marker_files=frozenset({"__init__.py"}),
        exempt_marker_pattern=r"#\s*dir-size:\s*exempt",
        extensions=frozenset({".py"}),
    ),
    "typescript": LanguageConfig(
        threshold=10,
        test_threshold=15,
        init_files=frozenset(
            {
                "index.ts",
                "index.tsx",
                "index.js",
                "index.jsx",
            }
        ),
        infra_files=frozenset(
            {
                "index.ts",
                "index.tsx",
                "index.js",
                "index.jsx",
                "package.json",
            }
        ),
        infra_dirs=frozenset(
            {
                "node_modules",
                ".next",
                "dist",
                "build",
                "coverage",
                ".turbo",
            }
        ),
        test_indicators=frozenset({"__tests__", "tests", "test", "spec"}),
        exempt_marker_files=frozenset({"index.ts", "index.tsx", "index.js"}),
        exempt_marker_pattern=r"//\s*dir-size:\s*exempt",
        extensions=frozenset({".ts", ".tsx", ".js", ".jsx"}),
    ),
    "go": LanguageConfig(
        threshold=10,
        test_threshold=15,
        init_files=frozenset({"doc.go"}),
        infra_files=frozenset({"doc.go", "go.mod", "go.sum"}),
        infra_dirs=frozenset({"vendor", "testdata"}),
        test_indicators=frozenset(),
        exempt_marker_files=frozenset({"doc.go"}),
        exempt_marker_pattern=r"//\s*dir-size:\s*exempt",
        extensions=frozenset({".go"}),
    ),
    "swift": LanguageConfig(
        threshold=10,
        test_threshold=15,
        init_files=frozenset(),
        infra_files=frozenset({"Package.swift", "Info.plist"}),
        infra_dirs=frozenset({".build", "DerivedData", "Pods"}),
        test_indicators=frozenset({"Tests", "XCTests"}),
        exempt_marker_files=frozenset(),
        exempt_marker_pattern=None,
        extensions=frozenset({".swift"}),
    ),
    "rust": LanguageConfig(
        threshold=10,
        test_threshold=15,
        init_files=frozenset({"mod.rs", "lib.rs", "main.rs"}),
        infra_files=frozenset(
            {
                "mod.rs",
                "lib.rs",
                "main.rs",
                "build.rs",
                "Cargo.toml",
            }
        ),
        infra_dirs=frozenset({"target"}),
        test_indicators=frozenset({"tests"}),
        exempt_marker_files=frozenset({"mod.rs"}),
        exempt_marker_pattern=r"//\s*dir-size:\s*exempt",
        extensions=frozenset({".rs"}),
    ),
    "hcl": LanguageConfig(
        threshold=10,
        test_threshold=15,
        init_files=frozenset(),
        infra_files=frozenset(
            {
                "terraform.tfstate",
                "terraform.tfstate.backup",
                ".terraform.lock.hcl",
            }
        ),
        infra_dirs=frozenset({".terraform"}),
        test_indicators=frozenset({"tests", "test"}),
        exempt_marker_files=frozenset(),
        exempt_marker_pattern=None,
        extensions=frozenset({".tf", ".tfvars", ".hcl"}),
    ),
}

# Django variant — adds framework-specific infra dirs
LANGUAGE_CONFIGS["python-django"] = LanguageConfig(
    threshold=14,
    test_threshold=15,
    init_files=frozenset({"__init__.py"}),
    infra_files=frozenset(
        {
            "__init__.py",
            "conftest.py",
            "setup.py",
            "setup.cfg",
            "py.typed",
        }
    ),
    infra_dirs=frozenset(
        {
            "__pycache__",
            ".mypy_cache",
            "migrations",
            "__pypackages__",
            "staticfiles",
            "static",
            "media",
        }
    ),
    test_indicators=frozenset({"tests", "test", "testing"}),
    exempt_marker_files=frozenset({"__init__.py"}),
    exempt_marker_pattern=r"#\s*dir-size:\s*exempt",
    extensions=frozenset({".py"}),
)

# SvelteKit variant — adds framework build dir
LANGUAGE_CONFIGS["sveltekit"] = LanguageConfig(
    threshold=10,
    test_threshold=15,
    init_files=frozenset({"index.ts", "index.tsx", "index.js", "index.jsx"}),
    infra_files=frozenset(
        {
            "index.ts",
            "index.tsx",
            "index.js",
            "index.jsx",
            "package.json",
            "svelte.config.js",
        }
    ),
    infra_dirs=frozenset(
        {
            "node_modules",
            ".svelte-kit",
            "dist",
            "build",
            "coverage",
            ".turbo",
        }
    ),
    test_indicators=frozenset({"__tests__", "tests", "test", "spec"}),
    exempt_marker_files=frozenset({"index.ts", "index.tsx", "index.js"}),
    exempt_marker_pattern=r"//\s*dir-size:\s*exempt",
    extensions=frozenset({".ts", ".tsx", ".js", ".jsx"}),
)

# Archetype aliases — map questionnaire keys to base configs
LANGUAGE_CONFIGS["python-general"] = LANGUAGE_CONFIGS["python"]
LANGUAGE_CONFIGS["python-fastapi"] = LANGUAGE_CONFIGS["python"]
LANGUAGE_CONFIGS["python-flask"] = LANGUAGE_CONFIGS["python"]
LANGUAGE_CONFIGS["python-notebook"] = LANGUAGE_CONFIGS["python"]
LANGUAGE_CONFIGS["python-pipeline"] = LANGUAGE_CONFIGS["python"]
LANGUAGE_CONFIGS["nextjs"] = LANGUAGE_CONFIGS["typescript"]
LANGUAGE_CONFIGS["react-native"] = LANGUAGE_CONFIGS["typescript"]
LANGUAGE_CONFIGS["node-express"] = LANGUAGE_CONFIGS["typescript"]
LANGUAGE_CONFIGS["terraform"] = LANGUAGE_CONFIGS["hcl"]
LANGUAGE_CONFIGS["go-api"] = LANGUAGE_CONFIGS["go"]
LANGUAGE_CONFIGS["swift-ios"] = LANGUAGE_CONFIGS["swift"]
# "rust" already exists as a base key

# Legacy aliases
LANGUAGE_CONFIGS["node"] = LANGUAGE_CONFIGS["typescript"]
LANGUAGE_CONFIGS["javascript"] = LANGUAGE_CONFIGS["typescript"]

# Universal infrastructure directories to always skip
UNIVERSAL_INFRA_DIRS = frozenset(
    {
        ".git",
        ".hg",
        ".svn",
        ".venv",
        "venv",
        "env",
        ".tox",
        ".nox",
        ".eggs",
        "*.egg-info",
        "node_modules",
    }
)

# Universal infrastructure files to never count
UNIVERSAL_INFRA_FILES = frozenset(
    {
        ".gitignore",
        ".gitattributes",
        ".editorconfig",
        ".prettierrc",
        ".eslintrc",
        ".eslintrc.json",
        ".eslintrc.js",
        "LICENSE",
        "LICENSE.md",
        "LICENSE.txt",
        "Makefile",
        "Dockerfile",
        ".dockerignore",
        "docker-compose.yml",
        "docker-compose.yaml",
        ".dir-size-exempt",
    }
)

MIN_SUBDIR_FILES = 3


# ---- Data types -------------------------------------------------------------


@dataclass
class DirResult:
    """Result of checking a single directory."""

    path: Path
    status: str  # OVERFLOW, UNDERFLOW, EXEMPT, PASS
    file_count: int = 0
    threshold: int = 0
    language: str = ""
    detail: str = ""
    files: list[str] | None = None  # substantive files in the directory


# ---- Git integration --------------------------------------------------------


def is_git_repo(root: Path) -> bool:
    """Check if root is inside a git repository."""
    result = subprocess.run(
        ["git", "-C", str(root), "rev-parse", "--git-dir"],
        capture_output=True,
    )
    return result.returncode == 0


def get_gitignored_paths(root: Path, paths: list[Path]) -> set[str]:
    """Return the set of paths that are gitignored."""
    if not paths:
        return set()
    try:
        result = subprocess.run(
            ["git", "-C", str(root), "check-ignore", "--stdin"],
            input="\n".join(str(p) for p in paths),
            capture_output=True,
            text=True,
            timeout=10,
        )
        if result.stdout:
            return set(result.stdout.strip().splitlines())
        return set()
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return set()


# ---- Core logic -------------------------------------------------------------


def detect_language(directory: Path, files: list[str], primary: str) -> str:
    """Detect the dominant language in a directory by extension majority.

    Falls back to primary language if no clear majority.
    """
    if not files:
        return primary

    ext_counts: dict[str, int] = {}
    for f in files:
        ext = Path(f).suffix.lower()
        if ext:
            ext_counts[ext] = ext_counts.get(ext, 0) + 1

    if not ext_counts:
        return primary

    total = sum(ext_counts.values())
    top_ext = max(ext_counts, key=lambda k: ext_counts[k])
    top_count = ext_counts[top_ext]

    # If >50% of files share an extension, use that language
    if top_count > total / 2:
        for lang, cfg in LANGUAGE_CONFIGS.items():
            if top_ext in cfg.extensions:
                return lang

    return primary


def get_config(language: str) -> LanguageConfig:
    """Get the language config, falling back to default."""
    return LANGUAGE_CONFIGS.get(language, DEFAULT_CONFIG)


def is_test_directory(dir_path: Path, root: Path, config: LanguageConfig) -> bool:
    """Check if a directory is a test directory (or inside one)."""
    all_indicators = config.test_indicators | DEFAULT_CONFIG.test_indicators
    relative = dir_path.relative_to(root)
    lowered = {i.lower() for i in all_indicators}
    return any(part.lower() in lowered for part in relative.parts)


def is_infra_dir(dirname: str, config: LanguageConfig) -> bool:
    """Check if a directory name is infrastructure (should be skipped entirely)."""
    all_infra = config.infra_dirs | UNIVERSAL_INFRA_DIRS
    if dirname in all_infra:
        return True
    glob_patterns = (p for p in all_infra if "*" in p)
    return any(fnmatch.fnmatch(dirname, p) for p in glob_patterns)


def is_infra_file(filename: str, config: LanguageConfig) -> bool:
    """Check if a file is infrastructure (should not be counted)."""
    return filename in (config.infra_files | UNIVERSAL_INFRA_FILES)


def is_hidden(name: str) -> bool:
    """Check if a file or directory name is hidden (starts with .)."""
    return name.startswith(".")


def check_exempt(dir_path: Path, config: LanguageConfig) -> str:
    """Check if a directory has an opt-out marker.

    Returns the exemption source string, or empty string if not exempt.
    """
    if (dir_path / ".dir-size-exempt").exists():
        return ".dir-size-exempt"

    if config.exempt_marker_pattern:
        for marker_file in config.exempt_marker_files:
            init_path = dir_path / marker_file
            if init_path.exists():
                try:
                    content = init_path.read_text(encoding="utf-8", errors="replace")
                    if re.search(config.exempt_marker_pattern, content):
                        return f"{marker_file} marker"
                except OSError:
                    pass

    return ""


def count_substantive_files(
    dir_path: Path,
    entries: list[str],
    config: LanguageConfig,
) -> list[str]:
    """Return list of substantive (non-infrastructure) file names in a directory."""
    substantive = []
    for name in entries:
        full = dir_path / name
        if not full.is_file():
            continue
        if is_hidden(name):
            continue
        if is_infra_file(name, config):
            continue
        substantive.append(name)
    return substantive


def is_namespace_package(dir_path: Path, file_entries: list[str]) -> bool:
    """Check if directory is a namespace package (__init__.py only)."""
    return file_entries == ["__init__.py"]


def read_primary_language(root: Path) -> str:
    """Read primary language from project-meta.yaml if it exists."""
    meta_path = root / "project-meta.yaml"
    if not meta_path.exists():
        return ""
    try:
        import yaml

        data = yaml.safe_load(meta_path.read_text())
        return data.get("language", "") if isinstance(data, dict) else ""
    except ImportError:
        pass
    except Exception:
        pass
    # Fallback: simple regex extraction
    try:
        text = meta_path.read_text()
        match = re.search(r"^language:\s*(\S+)", text, re.MULTILINE)
        return match.group(1) if match else ""
    except OSError:
        return ""


def check_directory_sizes(
    root: Path,
    primary_language: str = "",
    verbose: bool = False,
) -> list[DirResult]:
    """Walk the directory tree and check all directories."""
    root = root.resolve()
    use_git = is_git_repo(root)

    if not primary_language:
        primary_language = read_primary_language(root)

    results: list[DirResult] = []

    for dirpath_str, dirnames, filenames in os.walk(str(root)):
        dir_path = Path(dirpath_str)
        dir_name = dir_path.name

        # Skip hidden directories at the walk level
        if is_hidden(dir_name) and dir_path != root:
            dirnames.clear()
            continue

        # Get config for the primary language to check infra dirs
        primary_config = get_config(primary_language)

        # Filter out infrastructure directories from traversal
        def _keep(
            d: str,
            _cfg: LanguageConfig = primary_config,
        ) -> bool:
            return not is_infra_dir(d, _cfg) and not is_hidden(d)

        dirnames[:] = [d for d in dirnames if _keep(d)]

        # Skip the root directory itself (project root is always mixed)
        if dir_path == root:
            continue

        # Collect all entries for gitignore check
        all_entries = filenames + [d for d in dirnames if (dir_path / d).is_dir()]

        # Filter gitignored entries
        if use_git and all_entries:
            full_paths = [dir_path / e for e in all_entries]
            ignored = get_gitignored_paths(root, full_paths)
            visible_entries = []
            for e in all_entries:
                if str(dir_path / e) not in ignored:
                    visible_entries.append(e)
        else:
            visible_entries = all_entries

        visible_files = [e for e in visible_entries if (dir_path / e).is_file()]

        # Detect language for this directory
        lang = detect_language(dir_path, visible_files, primary_language)
        config = get_config(lang)

        # Check exemption
        exempt_source = check_exempt(dir_path, config)
        if exempt_source:
            results.append(
                DirResult(
                    path=dir_path,
                    status="EXEMPT",
                    detail=exempt_source,
                )
            )
            continue

        # Count substantive files
        substantive = count_substantive_files(dir_path, visible_files, config)
        count = len(substantive)

        # Determine threshold
        is_test = is_test_directory(dir_path, root, config)
        threshold = config.test_threshold if is_test else config.threshold

        # Check overflow
        if count > threshold:
            results.append(
                DirResult(
                    path=dir_path,
                    status="OVERFLOW",
                    file_count=count,
                    threshold=threshold,
                    language=lang or "default",
                    files=sorted(substantive),
                )
            )
        else:
            results.append(
                DirResult(
                    path=dir_path,
                    status="PASS",
                    file_count=count,
                    threshold=threshold,
                    language=lang or "default",
                )
            )

        # Check underflow on immediate subdirectories
        visible_subdirs = [e for e in visible_entries if (dir_path / e).is_dir()]
        for subdir_name in visible_subdirs:
            subdir_path = dir_path / subdir_name
            try:
                subdir_entries = os.listdir(str(subdir_path))
            except PermissionError:
                continue

            sub = subdir_path
            subdir_file_entries = [e for e in subdir_entries if (sub / e).is_file()]

            if is_namespace_package(subdir_path, subdir_file_entries):
                continue

            subdir_substantive = count_substantive_files(
                subdir_path,
                subdir_file_entries,
                config,
            )
            if 0 < len(subdir_substantive) < MIN_SUBDIR_FILES:
                results.append(
                    DirResult(
                        path=subdir_path,
                        status="UNDERFLOW",
                        file_count=len(subdir_substantive),
                        threshold=MIN_SUBDIR_FILES,
                        language=lang or "default",
                    )
                )

    return results


# ---- Output formatting ------------------------------------------------------


def format_results(results: list[DirResult], root: Path, verbose: bool) -> str:
    """Format results as human-readable text."""
    lines: list[str] = []
    for r in results:
        try:
            rel = r.path.relative_to(root)
        except ValueError:
            rel = r.path

        thresh = r.threshold
        lang = r.language
        cnt = r.file_count
        info = f"{cnt} files (threshold: {thresh}, language: {lang})"
        if r.status == "OVERFLOW":
            lines.append(f"OVERFLOW  {rel}/\t{info}")
        elif r.status == "UNDERFLOW":
            sfx = "s" if cnt != 1 else ""
            uf = f"{cnt} file{sfx} (minimum: {thresh}) [advisory]"
            lines.append(f"UNDERFLOW {rel}/\t{uf}")
        elif r.status == "EXEMPT":
            lines.append(f"EXEMPT    {rel}/\t(marker: {r.detail})")
        elif verbose and r.status == "PASS":
            lines.append(f"PASS      {rel}/\t{info}")

    overflow_count = sum(1 for r in results if r.status == "OVERFLOW")
    underflow_count = sum(1 for r in results if r.status == "UNDERFLOW")
    exempt_count = sum(1 for r in results if r.status == "EXEMPT")
    pass_count = sum(1 for r in results if r.status == "PASS")

    lines.append("")
    lines.append(
        f"Summary: {overflow_count} overflow violation"
        f"{'s' if overflow_count != 1 else ''}, "
        f"{underflow_count} underflow warning"
        f"{'s' if underflow_count != 1 else ''}, "
        f"{exempt_count} exempt, {pass_count} passed"
    )
    return "\n".join(lines)


def format_json(results: list[DirResult], root: Path) -> str:
    """Format results as JSON for machine consumption."""
    import json

    violations = []
    for r in results:
        if r.status not in ("OVERFLOW", "UNDERFLOW"):
            continue
        try:
            rel = str(r.path.relative_to(root))
        except ValueError:
            rel = str(r.path)
        entry: dict[str, object] = {
            "directory": rel,
            "status": r.status,
            "file_count": r.file_count,
            "threshold": r.threshold,
            "language": r.language,
        }
        if r.files is not None:
            entry["files"] = r.files
        violations.append(entry)
    return json.dumps({"violations": violations}, indent=2)


# ---- CLI --------------------------------------------------------------------


def main(argv: list[str] | None = None) -> int:
    """Run directory size enforcement."""
    parser = argparse.ArgumentParser(
        description=("Check directory sizes against language-aware thresholds."),
    )
    parser.add_argument(
        "--root",
        type=Path,
        default=Path.cwd(),
        help="Project root directory (default: current directory)",
    )
    parser.add_argument(
        "--language",
        type=str,
        default="",
        help="Primary language (auto-detected from project-meta.yaml if not set)",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Show all directories, not just violations",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Report violations but exit 0",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        dest="json_output",
        help="Output violations as JSON with file lists for machine consumption",
    )
    parser.add_argument(
        "root_positional",
        nargs="?",
        type=Path,
        default=None,
        help=argparse.SUPPRESS,
    )

    args = parser.parse_args(argv)
    root = args.root_positional or args.root

    if not root.is_dir():
        print(f"[!!] Not a directory: {root}", file=sys.stderr)
        return 1

    results = check_directory_sizes(
        root=root,
        primary_language=args.language,
        verbose=args.verbose,
    )

    if args.json_output:
        output = format_json(results, root.resolve())
    else:
        output = format_results(results, root.resolve(), args.verbose)
    print(output)

    has_overflow = any(r.status == "OVERFLOW" for r in results)
    if has_overflow and not args.dry_run:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())

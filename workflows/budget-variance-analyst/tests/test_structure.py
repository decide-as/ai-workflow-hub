"""Project structure and consistency tests for Budget-Variance-Analyst.

Verifies that project metadata, configuration files, and directory
layout remain consistent across edits — especially important when
multiple AI sessions or developers work concurrently.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest
import yaml

pytestmark = [pytest.mark.structure, pytest.mark.test_value("structural")]

PROJECT_ROOT = Path(__file__).resolve().parent.parent

# ---------------------------------------------------------------------------
# Required files
# ---------------------------------------------------------------------------

REQUIRED_FILES = [
    "project-meta.yaml",
    "README.md",
    "CHANGELOG.md",
    "CLAUDE.md",

    "pyproject.toml",

]

REQUIRED_DIRS = [

    "src/budget_variance_analyst",

    "tests",
    ".claude/rules",
]


class TestRequiredFiles:
    """Verify required project files exist."""

    @pytest.mark.parametrize("path", REQUIRED_FILES)
    def test_required_file_exists(self, path: str) -> None:
        assert (PROJECT_ROOT / path).is_file(), f"Missing required file: {path}"

    @pytest.mark.parametrize("path", REQUIRED_DIRS)
    def test_required_dir_exists(self, path: str) -> None:
        assert (PROJECT_ROOT / path).is_dir(), f"Missing required directory: {path}"


# ---------------------------------------------------------------------------
# Metadata validation
# ---------------------------------------------------------------------------

class TestMetadataConsistency:
    """Verify project-meta.yaml is well-formed and consistent with other files."""

    @pytest.fixture()
    def metadata(self) -> dict:
        meta_path = PROJECT_ROOT / "project-meta.yaml"
        return yaml.safe_load(meta_path.read_text())

    def test_required_fields_present(self, metadata: dict) -> None:
        required = ["name", "display_name", "version", "description", "language"]
        missing = [f for f in required if f not in metadata]
        assert not missing, f"Missing metadata fields: {missing}"

    def test_version_is_semver(self, metadata: dict) -> None:
        version = metadata.get("version", "")
        assert re.match(r"^\d+\.\d+\.\d+", version), (
            f"Version '{version}' is not valid semver"
        )

    def test_name_is_kebab_case(self, metadata: dict) -> None:
        name = metadata.get("name", "")
        assert re.match(r"^[a-z][a-z0-9-]*$", name), (
            f"Name '{name}' must be kebab-case"
        )


    def test_version_matches_pyproject(self, metadata: dict) -> None:
        """Verify project-meta.yaml version matches pyproject.toml."""
        pyproject = PROJECT_ROOT / "pyproject.toml"
        if not pyproject.exists():
            pytest.skip("No pyproject.toml")
        content = pyproject.read_text()
        match = re.search(r'^version\s*=\s*"([^"]+)"', content, re.MULTILINE)
        if match:
            assert match.group(1) == metadata["version"], (
                f"Version mismatch: project-meta.yaml={metadata['version']}, "
                f"pyproject.toml={match.group(1)}"
            )


    def test_version_in_changelog(self, metadata: dict) -> None:
        """Verify the current version appears in CHANGELOG.md."""
        changelog = PROJECT_ROOT / "CHANGELOG.md"
        if not changelog.exists():
            pytest.skip("No CHANGELOG.md")
        content = changelog.read_text()
        assert metadata["version"] in content, (
            f"Version {metadata['version']} not found in CHANGELOG.md"
        )


# ---------------------------------------------------------------------------
# README health
# ---------------------------------------------------------------------------

class TestReadmeHealth:
    """Verify README.md contains essential sections."""

    @pytest.fixture()
    def readme(self) -> str:
        return (PROJECT_ROOT / "README.md").read_text()

    def test_has_project_name(self, readme: str) -> None:
        assert "Budget-Variance-Analyst" in readme or "budget-variance-analyst" in readme

    def test_has_installation_section(self, readme: str) -> None:
        assert re.search(r"(?i)#.*install", readme), "README missing installation section"

    def test_has_testing_section(self, readme: str) -> None:
        assert re.search(r"(?i)#.*test", readme), "README missing testing section"


# ---------------------------------------------------------------------------
# Rules directory
# ---------------------------------------------------------------------------

EXPECTED_RULES = [
    "04-git.md",
    "05-branching.md",

    "testing.md",

]


class TestRulesPresent:
    """Verify .claude/rules/ contains expected rule files."""

    @pytest.mark.parametrize("rule", EXPECTED_RULES)
    def test_rule_file_exists(self, rule: str) -> None:
        path = PROJECT_ROOT / ".claude" / "rules" / rule
        assert path.is_file(), f"Missing rule file: .claude/rules/{rule}"

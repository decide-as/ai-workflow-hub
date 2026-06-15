"""Automated code quality checks for Nda-Drafter.

AST-based structural analysis that enforces documentation, naming,
and hygiene standards as part of the test suite.  Checks scale with
the project's quality gate (none / basic / strict).
"""

from __future__ import annotations

import ast
import re
from pathlib import Path

import pytest

pytestmark = [pytest.mark.quality, pytest.mark.test_value("structural")]

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

SRC_ROOT = Path(__file__).resolve().parent.parent / "src" / "nda_drafter"
TESTS_ROOT = Path(__file__).resolve().parent
PROJECT_ROOT = Path(__file__).resolve().parent.parent


def _python_files(root: Path) -> list[Path]:
    """Return all .py files under *root*, excluding __init__.py."""
    return sorted(
        p for p in root.rglob("*.py")
        if p.name != "__init__.py"
        and "__pycache__" not in p.parts
    )


# ===================================================================
# Docstring enforcement
# ===================================================================

class _DocstringChecker:
    """AST visitor that collects missing-docstring diagnostics.

    Rules
    -----
    * Single-class file  -> require class docstring only (skip module).
    * Single-function file -> require function docstring only (skip module).
    * Multiple top-level defs -> require module docstring.
    * ``__init__`` never needs a docstring.
    * Class with exactly one non-init method -> skip method docstring.
    """

    def __init__(self, path: Path) -> None:
        self.path = path
        self.issues: list[str] = []
        source = path.read_text(encoding="utf-8")
        self.tree = ast.parse(source)

    def check(self) -> list[str]:
        top_classes = [n for n in self.tree.body if isinstance(n, ast.ClassDef)]
        top_funcs = [n for n in self.tree.body if isinstance(n, ast.FunctionDef)]

        # Single top-level class -> only require class docstring
        if len(top_classes) == 1 and len(top_funcs) == 0:
            cls = top_classes[0]
            if not ast.get_docstring(cls):
                self._add(cls.lineno, f"Missing class docstring: {cls.name}")
            return self.issues

        # Single top-level function -> only require function docstring
        if len(top_funcs) == 1 and len(top_classes) == 0:
            fn = top_funcs[0]
            if not ast.get_docstring(fn):
                self._add(fn.lineno, f"Missing function docstring: {fn.name}")
            return self.issues

        # Multiple top-level defs -> require module docstring
        if not ast.get_docstring(self.tree):
            self._add(1, "Missing module docstring")

        # Check classes and methods
        for node in ast.walk(self.tree):
            if isinstance(node, ast.ClassDef):
                if not ast.get_docstring(node):
                    self._add(node.lineno, f"Missing class docstring: {node.name}")
                methods = [n for n in node.body if isinstance(n, ast.FunctionDef)]
                non_init = [m for m in methods if m.name != "__init__"]
                if len(non_init) <= 1:
                    continue
                for method in non_init:
                    if not ast.get_docstring(method):
                        self._add(
                            method.lineno,
                            f"Missing method docstring: {node.name}.{method.name}",
                        )

        # Check top-level functions
        for fn in top_funcs:
            if not ast.get_docstring(fn):
                self._add(fn.lineno, f"Missing function docstring: {fn.name}")

        return self.issues

    def _add(self, lineno: int, message: str) -> None:
        self.issues.append(f"{self.path}:{lineno}: {message}")



class TestDocstrings:
    """Verify every source module has proper docstrings."""

    @pytest.mark.parametrize(
        "path",
        _python_files(SRC_ROOT),
        ids=lambda p: str(p.relative_to(SRC_ROOT)),
    )
    def test_docstrings(self, path: Path) -> None:
        issues = _DocstringChecker(path).check()
        assert not issues, "Docstring violations:\n" + "\n".join(issues)



# ===================================================================
# No print() in production code
# ===================================================================

_PRINT_RE = re.compile(r"(?<!\w)print\s*\(")



class TestNoPrint:
    """Source modules should use logging, not print()."""

    @pytest.mark.parametrize(
        "path",
        _python_files(SRC_ROOT),
        ids=lambda p: str(p.relative_to(SRC_ROOT)),
    )
    def test_no_print_in_source(self, path: Path) -> None:
        violations = []
        for i, line in enumerate(path.read_text().splitlines(), 1):
            stripped = line.lstrip()
            if stripped.startswith("#"):
                continue
            if _PRINT_RE.search(line):
                violations.append(f"{path}:{i}: {line.strip()}")
        assert not violations, "print() found in source:\n" + "\n".join(violations)



# ===================================================================
# Every source module has a corresponding test file
# ===================================================================


class TestCoverage:
    """Verify structural test coverage: every module has a test file."""

    def test_every_module_has_test_file(self) -> None:
        modules = [
            p.stem for p in _python_files(SRC_ROOT)
            if not p.stem.startswith("_")
        ]
        test_files = {p.stem.removeprefix("test_") for p in TESTS_ROOT.glob("test_*.py")}
        missing = [m for m in modules if m not in test_files]
        assert not missing, (
            "Source modules without a corresponding test file:\n"
            + "\n".join(f"  src/nda_drafter/{m}.py -> tests/test_{m}.py" for m in missing)
        )



# ===================================================================
# No TODO/FIXME in production code (strict gate only)
# ===================================================================

_TODO_RE = re.compile(r"\b(TODO|FIXME|HACK|XXX)\b", re.IGNORECASE)




# ===================================================================
# No hardcoded secrets patterns
# ===================================================================

_SECRET_PATTERNS = [
    re.compile(r"""(?:api_key|apikey|secret|password|token|auth)\s*=\s*['"][^'"]{8,}['"]""", re.IGNORECASE),
    re.compile(r"""(?:sk|pk)[-_](?:live|test)[-_][a-zA-Z0-9]{20,}"""),
]


class TestNoHardcodedSecrets:
    """Source files must not contain hardcoded secret patterns."""

    @pytest.mark.parametrize(
        "path",
        _python_files(SRC_ROOT),
        ids=lambda p: str(p.relative_to(SRC_ROOT)),
    )
    def test_no_secrets(self, path: Path) -> None:
        content = path.read_text()
        violations = []
        for i, line in enumerate(content.splitlines(), 1):
            stripped = line.lstrip()
            if stripped.startswith("#"):
                continue
            for pattern in _SECRET_PATTERNS:
                if pattern.search(line):
                    violations.append(f"{path}:{i}: {line.strip()}")
        assert not violations, "Possible hardcoded secrets:\n" + "\n".join(violations)


"""Shared test fixtures and configuration for Team-Briefing-Generator."""

from __future__ import annotations

import os
from pathlib import Path

import pytest

PROJECT_ROOT = Path(__file__).resolve().parent.parent

# ---------------------------------------------------------------------------
# Auto-marker: infer pytest markers from test file names
# ---------------------------------------------------------------------------

_FILE_MARKER_MAP: dict[str, str] = {
    "test_smoke": "smoke",
    "test_code_quality": "quality",
    "test_structure": "structure",
}


def pytest_collection_modifyitems(items: list[pytest.Item]) -> None:
    """Add markers automatically based on test file name.

    Tests that already carry an explicit marker are left unchanged.
    """
    for item in items:
        stem = Path(item.fspath).stem
        if stem in _FILE_MARKER_MAP:
            marker_name = _FILE_MARKER_MAP[stem]
            existing = {m.name for m in item.iter_markers()}
            if marker_name not in existing:
                item.add_marker(getattr(pytest.mark, marker_name))


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def project_root() -> Path:
    """Return the project root directory."""
    return PROJECT_ROOT


@pytest.fixture()
def env_override(monkeypatch: pytest.MonkeyPatch):
    """Context manager to temporarily override environment variables.

    Usage::

        def test_something(env_override):
            env_override("API_KEY", "test-key")
            env_override("DEBUG", "true")
    """
    def _set(key: str, value: str) -> None:
        monkeypatch.setenv(key, value)
    return _set


@pytest.fixture()
def clean_env(monkeypatch: pytest.MonkeyPatch):
    """Remove all env vars matching common secret patterns for test isolation."""
    for key in list(os.environ):
        if any(p in key.upper() for p in ("SECRET", "TOKEN", "API_KEY", "PASSWORD")):
            monkeypatch.delenv(key, raising=False)

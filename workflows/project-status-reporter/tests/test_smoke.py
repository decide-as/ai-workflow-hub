"""Smoke tests for Project-Status-Reporter."""

from __future__ import annotations

import pytest

pytestmark = [pytest.mark.smoke, pytest.mark.test_value("essential")]


def test_import():
    """Verify the project_status_reporter package is importable."""
    import project_status_reporter  # noqa: F401

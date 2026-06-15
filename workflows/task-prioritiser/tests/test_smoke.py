"""Smoke tests for Task-Prioritiser."""

from __future__ import annotations

import pytest

pytestmark = [pytest.mark.smoke, pytest.mark.test_value("essential")]


def test_import():
    """Verify the task_prioritiser package is importable."""
    import task_prioritiser  # noqa: F401

"""Smoke tests for Budget-Variance-Analyst."""

from __future__ import annotations

import pytest

pytestmark = [pytest.mark.smoke, pytest.mark.test_value("essential")]


def test_import():
    """Verify the budget_variance_analyst package is importable."""
    import budget_variance_analyst  # noqa: F401

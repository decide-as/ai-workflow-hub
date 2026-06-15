"""Smoke tests for Travel-Expense-Report."""

from __future__ import annotations

import pytest

pytestmark = [pytest.mark.smoke, pytest.mark.test_value("essential")]


def test_import():
    """Verify the travel_expense_report package is importable."""
    import travel_expense_report  # noqa: F401

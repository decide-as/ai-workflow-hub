"""Smoke tests for Contract-Reviewer."""

from __future__ import annotations

import pytest

pytestmark = [pytest.mark.smoke, pytest.mark.test_value("essential")]


def test_import():
    """Verify the contract_reviewer package is importable."""
    import contract_reviewer  # noqa: F401

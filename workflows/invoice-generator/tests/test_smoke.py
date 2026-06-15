"""Smoke tests for Invoice-Generator."""

from __future__ import annotations

import pytest

pytestmark = [pytest.mark.smoke, pytest.mark.test_value("essential")]


def test_import():
    """Verify the invoice_generator package is importable."""
    import invoice_generator  # noqa: F401

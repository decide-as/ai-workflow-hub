"""Smoke tests for Nda-Drafter."""

from __future__ import annotations

import pytest

pytestmark = [pytest.mark.smoke, pytest.mark.test_value("essential")]


def test_import():
    """Verify the nda_drafter package is importable."""
    import nda_drafter  # noqa: F401

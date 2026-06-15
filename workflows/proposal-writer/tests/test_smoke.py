"""Smoke tests for Proposal-Writer."""

from __future__ import annotations

import pytest

pytestmark = [pytest.mark.smoke, pytest.mark.test_value("essential")]


def test_import():
    """Verify the proposal_writer package is importable."""
    import proposal_writer  # noqa: F401

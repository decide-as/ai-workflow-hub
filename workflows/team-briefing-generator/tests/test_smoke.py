"""Smoke tests for Team-Briefing-Generator."""

from __future__ import annotations

import pytest

pytestmark = [pytest.mark.smoke, pytest.mark.test_value("essential")]


def test_import():
    """Verify the team_briefing_generator package is importable."""
    import team_briefing_generator  # noqa: F401

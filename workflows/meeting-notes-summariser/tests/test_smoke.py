"""Smoke tests for Meeting-Notes-Summariser."""

from __future__ import annotations

import pytest

pytestmark = [pytest.mark.smoke, pytest.mark.test_value("essential")]


def test_import():
    """Verify the meeting_notes_summariser package is importable."""
    import meeting_notes_summariser  # noqa: F401

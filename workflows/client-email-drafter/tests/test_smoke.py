"""Smoke tests for Client-Email-Drafter."""

from __future__ import annotations

import pytest

pytestmark = [pytest.mark.smoke, pytest.mark.test_value("essential")]


def test_import():
    """Verify the client_email_drafter package is importable."""
    import client_email_drafter  # noqa: F401

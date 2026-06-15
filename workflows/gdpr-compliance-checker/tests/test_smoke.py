"""Smoke tests for Gdpr-Compliance-Checker."""

from __future__ import annotations

import pytest

pytestmark = [pytest.mark.smoke, pytest.mark.test_value("essential")]


def test_import():
    """Verify the gdpr_compliance_checker package is importable."""
    import gdpr_compliance_checker  # noqa: F401

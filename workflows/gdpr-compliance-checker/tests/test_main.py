"""Tests for the main entry point."""

import pytest

pytestmark = [pytest.mark.unit, pytest.mark.test_value("structural")]


class TestMain:
    def test_import(self) -> None:
        """Contract: main module is importable without side effects."""
        from gdpr_compliance_checker import main  # noqa: F401

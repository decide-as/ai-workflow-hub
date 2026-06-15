"""Tests for the main entry point."""

import pytest

pytestmark = [pytest.mark.unit, pytest.mark.test_value("structural")]


class TestMain:
    def test_import(self) -> None:
        """Contract: main module is importable without side effects."""
        from proposal_writer import main  # noqa: F401

"""Travel-Expense-Report — CLI entry point."""

from __future__ import annotations

import click


@click.command()
def main() -> None:
    """Processes travel receipts and generates formatted expense reports with policy-compliance checking"""
    click.echo("Travel-Expense-Report is running.")


if __name__ == "__main__":
    main()

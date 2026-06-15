"""Budget-Variance-Analyst — CLI entry point."""

from __future__ import annotations

import click


@click.command()
def main() -> None:
    """Compares actuals against approved budget per cost centre and generates board-ready variance commentary"""
    click.echo("Budget-Variance-Analyst is running.")


if __name__ == "__main__":
    main()

"""Contract-Reviewer — CLI entry point."""

from __future__ import annotations

import click


@click.command()
def main() -> None:
    """Analyses contracts for red flags and generates prioritised risk summaries with suggested redlines"""
    click.echo("Contract-Reviewer is running.")


if __name__ == "__main__":
    main()

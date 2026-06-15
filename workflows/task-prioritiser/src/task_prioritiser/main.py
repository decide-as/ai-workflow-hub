"""Task-Prioritiser — CLI entry point."""

from __future__ import annotations

import click


@click.command()
def main() -> None:
    """Scores and ranks backlog items using ICE and RICE frameworks with strategic alignment context"""
    click.echo("Task-Prioritiser is running.")


if __name__ == "__main__":
    main()

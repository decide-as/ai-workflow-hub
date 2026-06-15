"""Project-Status-Reporter — CLI entry point."""

from __future__ import annotations

import click


@click.command()
def main() -> None:
    """Generates weekly RAG status reports from ticket data for internal teams and clients"""
    click.echo("Project-Status-Reporter is running.")


if __name__ == "__main__":
    main()

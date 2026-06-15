"""Proposal-Writer — CLI entry point."""

from __future__ import annotations

import click


@click.command()
def main() -> None:
    """Structures commercial proposals from scope notes and pricing into polished client-facing documents"""
    click.echo("Proposal-Writer is running.")


if __name__ == "__main__":
    main()

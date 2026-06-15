"""Nda-Drafter — CLI entry point."""

from __future__ import annotations

import click


@click.command()
def main() -> None:
    """Generates balanced mutual NDAs from counterparty details and negotiation preferences"""
    click.echo("Nda-Drafter is running.")


if __name__ == "__main__":
    main()

"""Client-Email-Drafter — CLI entry point."""

from __future__ import annotations

import click


@click.command()
def main() -> None:
    """Turns bullet-point notes into polished professional client-facing emails"""
    click.echo("Client-Email-Drafter is running.")


if __name__ == "__main__":
    main()

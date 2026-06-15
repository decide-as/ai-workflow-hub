"""Meeting-Notes-Summariser — CLI entry point."""

from __future__ import annotations

import click


@click.command()
def main() -> None:
    """Converts raw meeting transcripts into structured summaries with decisions and action items"""
    click.echo("Meeting-Notes-Summariser is running.")


if __name__ == "__main__":
    main()

"""Team-Briefing-Generator — CLI entry point."""

from __future__ import annotations

import click


@click.command()
def main() -> None:
    """Produces concise weekly team briefings from Slack digests and completed task lists"""
    click.echo("Team-Briefing-Generator is running.")


if __name__ == "__main__":
    main()

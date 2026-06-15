"""Gdpr-Compliance-Checker — CLI entry point."""

from __future__ import annotations

import click


@click.command()
def main() -> None:
    """Reviews product features and data flows against GDPR obligations and produces remediation plans"""
    click.echo("Gdpr-Compliance-Checker is running.")


if __name__ == "__main__":
    main()

"""Invoice-Generator — CLI entry point."""

from __future__ import annotations

import click


@click.command()
def main() -> None:
    """Drafts professional invoices from project summaries with multi-currency and VAT support"""
    click.echo("Invoice-Generator is running.")


if __name__ == "__main__":
    main()

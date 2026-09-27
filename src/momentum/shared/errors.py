"""Shared CLI and application error handling."""

from __future__ import annotations

import typer
from rich.console import Console

console = Console()


def handle_error(error: Exception) -> None:
    """Render an application error and terminate the current CLI command."""
    console.print(
        f"[bold red]✗[/bold red] {error}",
    )
    raise typer.Exit(code=1)

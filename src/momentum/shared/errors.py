"""Shared CLI and application error handling."""

from __future__ import annotations

import typer
from rich.console import Console

console = Console()


def render_error(error: Exception) -> None:
    """Render a concise CLI error without controlling process flow."""
    console.print(
        f"[bold red]✗[/bold red] {error}",
    )


def handle_error(error: Exception) -> None:
    """Render an expected application error and terminate the current CLI command."""
    render_error(error)
    raise typer.Exit(code=1)

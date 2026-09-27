"""Shared Rich layout helpers for the Stride CLI."""

from __future__ import annotations

from rich.console import Console
from rich.panel import Panel


def render_header(
    console: Console,
    title: str,
    *,
    subtitle: str | None = None,
) -> None:
    """Render a consistent command header."""
    body = f"[bold cyan]{title}[/bold cyan]"

    if subtitle:
        body += f"\n[dim]{subtitle}[/dim]"

    console.print(
        Panel(
            body,
            border_style="cyan",
            padding=(0, 2),
        )
    )


def render_success(
    console: Console,
    message: str,
) -> None:
    """Render a successful operation message."""
    console.print(f"[green]✓[/green] {message}")


def render_warning(
    console: Console,
    message: str,
) -> None:
    """Render a warning message."""
    console.print(f"[yellow]![/yellow] {message}")


def render_error(
    console: Console,
    message: str,
) -> None:
    """Render an error message."""
    console.print(f"[red]✗[/red] {message}")

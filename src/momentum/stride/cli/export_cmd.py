"""Export CLI commands."""

from __future__ import annotations

from pathlib import Path
from typing import Annotated

import typer

from momentum.app.context import app_context
from momentum.config import get_config
from momentum.stride.cli.common import (
    console,
    handle_error,
    journey_reference,
)
from momentum.stride.domain.errors import StrideError

app = typer.Typer(
    help="Export journey data.",
    no_args_is_help=True,
)


@app.command("json")
def export_json(
    output: Annotated[
        Path | None,
        typer.Option(
            "--output",
            "-o",
            help="Output JSON file.",
        ),
    ] = None,
    journey: Annotated[
        str | None,
        typer.Option(
            "--journey",
            "-j",
            help="Export a single journey.",
        ),
    ] = None,
) -> None:
    """Export journey data to JSON."""
    try:
        with app_context(get_config()) as context:
            current = None

            if journey:
                current = context.stride_journey_service.get_journey(
                    journey_reference(journey),
                )

            result = context.stride_export_service.export_json(
                output=output,
                journey=current,
            )

        if result.content is not None:
            console.print(result.content)
            return

        console.print(
            f"[bold green]✓[/bold green] "
            f"Exported {result.journey_count} "
            f"journey(s) to [bold]{output}[/bold]."
        )

    except StrideError as exc:
        handle_error(exc)


@app.command("csv")
def export_csv(
    output: Annotated[
        Path | None,
        typer.Option(
            "--output",
            "-o",
            help="Output directory.",
        ),
    ] = None,
    journey: Annotated[
        str | None,
        typer.Option(
            "--journey",
            "-j",
            help="Export a single journey.",
        ),
    ] = None,
) -> None:
    """Export progress events to CSV."""
    try:
        output_dir = output or Path.cwd()

        with app_context(get_config()) as context:
            current = None

            if journey:
                current = context.stride_journey_service.get_journey(
                    journey_reference(journey),
                )

            result = context.stride_export_service.export_csv(
                output_dir=output_dir,
                journey=current,
            )

        for path in result.files:
            console.print(f"  [dim]→[/dim] {path}")

        console.print(
            f"[bold green]✓[/bold green] "
            f"Exported {result.journey_count} "
            f"journey(s) to [bold]{output_dir}[/bold]."
        )

    except StrideError as exc:
        handle_error(exc)

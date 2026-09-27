"""Milestone CLI commands."""

from __future__ import annotations

from typing import Annotated

import typer

from momentum.app.context import app_context
from momentum.config import get_config
from momentum.stride.cli.common import (
    console,
    handle_error,
)
from momentum.stride.domain.errors import StrideError
from momentum.stride.presentation.tables import render_milestone_table

app = typer.Typer(
    help="Manage milestones within journeys.",
    no_args_is_help=True,
)


@app.command("add")
def add_milestone(
    journey: Annotated[
        str,
        typer.Argument(help="Journey name or ID"),
    ],
    name: Annotated[
        str,
        typer.Argument(help="Milestone name"),
    ],
    description: Annotated[
        str,
        typer.Option(
            "--description",
            "-d",
            help="Optional description.",
        ),
    ] = "",
    position: Annotated[
        int | None,
        typer.Option(
            "--position",
            "-p",
            min=1,
            help="1-based position.",
        ),
    ] = None,
) -> None:
    """Add a milestone to a journey."""
    try:
        with app_context(get_config()) as context:
            current = context.stride_journey_service.get_journey(journey)

            milestone = context.stride_milestone_service.add_milestone(
                current,
                name=name,
                description=description,
                position=position,
            )

        console.print(
            f"[bold green]✓[/bold green] "
            f"Added [bold]{milestone.name}[/bold] "
            f"to [bold]{current.name}[/bold] "
            f"[dim](position {milestone.position + 1})[/dim]."
        )

    except StrideError as exc:
        handle_error(exc)


@app.command("list")
def list_milestones(
    journey: Annotated[
        str,
        typer.Argument(help="Journey name or ID"),
    ],
) -> None:
    """List milestones for a journey."""
    try:
        with app_context(get_config()) as context:
            current = context.stride_journey_service.get_journey(journey)
            milestones = context.stride_milestone_service.list_milestones(
                current.id,
            )

        if not milestones:
            console.print(f"[dim]No milestones for [bold]{current.name}[/bold].[/dim]")
            return

        render_milestone_table(
            milestones,
            console=console,
        )

    except StrideError as exc:
        handle_error(exc)


@app.command("edit")
def edit_milestone(
    journey: Annotated[
        str,
        typer.Argument(help="Journey name or ID"),
    ],
    milestone_id: Annotated[
        int,
        typer.Argument(help="Milestone ID"),
    ],
    name: Annotated[
        str | None,
        typer.Option("--name", "-n"),
    ] = None,
    description: Annotated[
        str | None,
        typer.Option("--description", "-d"),
    ] = None,
) -> None:
    """Edit a milestone."""
    try:
        with app_context(get_config()) as context:
            current = context.stride_journey_service.get_journey(journey)

            milestone = context.stride_milestone_service.edit_milestone(
                current,
                milestone_id,
                name=name,
                description=description,
            )

        console.print(
            f"[bold green]✓[/bold green] Updated milestone [bold]{milestone.name}[/bold]."
        )

    except StrideError as exc:
        handle_error(exc)


@app.command("complete")
def complete_milestone(
    journey: Annotated[
        str,
        typer.Argument(help="Journey name or ID"),
    ],
    milestone_id: Annotated[
        int,
        typer.Argument(help="Milestone ID"),
    ],
    note: Annotated[
        str | None,
        typer.Option("--note", "-n"),
    ] = None,
) -> None:
    """Complete a milestone and record its completion event."""
    try:
        with app_context(get_config()) as context:
            context.stride_progress_service.complete_milestone(
                journey,
                milestone_id,
                note=note,
            )

        console.print(
            f"[bold green]✓[/bold green] Completed milestone [bold]{milestone_id}[/bold]."
        )

        if note:
            console.print(f"  [dim]Note: {note}[/dim]")

    except StrideError as exc:
        handle_error(exc)


@app.command("reopen")
def reopen_milestone(
    journey: Annotated[
        str,
        typer.Argument(help="Journey name or ID"),
    ],
    milestone_id: Annotated[
        int,
        typer.Argument(help="Milestone ID"),
    ],
) -> None:
    """Reopen a completed milestone."""
    try:
        with app_context(get_config()) as context:
            context.stride_progress_service.reopen_milestone(
                journey,
                milestone_id,
            )

        console.print(f"[bold green]✓[/bold green] Reopened milestone [bold]{milestone_id}[/bold].")

    except StrideError as exc:
        handle_error(exc)


@app.command("reorder")
def reorder_milestones(
    journey: Annotated[
        str,
        typer.Argument(help="Journey name or ID"),
    ],
    ordered_ids: Annotated[
        list[int],
        typer.Argument(help="Milestone IDs in the desired order."),
    ],
) -> None:
    """Reorder all milestones in a journey."""
    try:
        if not ordered_ids:
            raise typer.BadParameter("At least one milestone ID is required.")

        with app_context(get_config()) as context:
            current = context.stride_journey_service.get_journey(journey)

            context.stride_milestone_service.reorder_milestones(
                current,
                ordered_ids,
            )

        console.print("[bold green]✓[/bold green] Milestones reordered.")

    except StrideError as exc:
        handle_error(exc)

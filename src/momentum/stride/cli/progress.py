"""Progress CLI commands."""

from __future__ import annotations

from datetime import datetime
from typing import Annotated

import typer

from momentum.app.context import app_context
from momentum.config import get_config
from momentum.stride.cli.common import (
    build_duration_seconds,
    console,
    handle_error,
    journey_reference,
    parse_date,
    resolve_history_range,
)
from momentum.stride.domain.enums import TrackingMethod
from momentum.stride.domain.errors import StrideError
from momentum.stride.presentation.formatting import (
    format_duration,
    format_value,
)
from momentum.stride.presentation.tables import render_history_table

app = typer.Typer(
    help="Log, inspect, edit, and delete progress events.",
    no_args_is_help=True,
)


@app.command("log")
def log_progress(
    journey: Annotated[
        str,
        typer.Argument(help="Journey name or ID"),
    ],
    value: Annotated[
        float | None,
        typer.Option(
            "--value",
            "-v",
            help="Quantity to record.",
        ),
    ] = None,
    hours: Annotated[
        float | None,
        typer.Option(
            "--hours",
            help="Duration hours.",
        ),
    ] = None,
    minutes: Annotated[
        int | None,
        typer.Option(
            "--minutes",
            help="Additional duration minutes.",
        ),
    ] = None,
    date_value: Annotated[
        str | None,
        typer.Option(
            "--date",
            help="Date (YYYY-MM-DD).",
        ),
    ] = None,
    time_value: Annotated[
        str | None,
        typer.Option(
            "--time",
            help="Time (HH:MM).",
        ),
    ] = None,
    note: Annotated[
        str | None,
        typer.Option("--note", "-n"),
    ] = None,
) -> None:
    """Log a progress event."""
    try:
        duration_seconds = build_duration_seconds(
            hours=hours,
            minutes=minutes,
        )

        occurred_at: datetime | None = None

        if date_value or time_value:
            selected_date = (
                parse_date(
                    date_value,
                    option_name="date",
                )
                if date_value
                else datetime.now().date()
            )

            selected_time = time_value or "00:00"

            try:
                occurred_at = datetime.fromisoformat(
                    f"{selected_date.isoformat()}T{selected_time}",
                )
            except ValueError as exc:
                raise typer.BadParameter(
                    "Expected time in HH:MM format.",
                    param_hint="--time",
                ) from exc

        with app_context(get_config()) as context:
            current = context.stride_journey_service.get_journey(
                journey_reference(journey),
            )

            event = context.stride_progress_service.log_progress(
                journey,
                value=value,
                duration_seconds=duration_seconds,
                occurred_at=occurred_at,
                note=note,
            )

        if current.tracking_method == TrackingMethod.DURATION:
            detail = format_duration(event.duration_seconds or 0)
        elif current.tracking_method == TrackingMethod.COUNT:
            detail = "+1"
            if current.unit:
                detail += f" {current.unit}"
        else:
            detail = format_value(
                event.value,
                current.unit,
            )

        console.print()
        console.print(
            f"[bold green]✓[/bold green] "
            f"Recorded [bold]{detail}[/bold] "
            f"for [bold]{current.name}[/bold]."
        )

        if note:
            console.print(f"  [dim]Note: {note}[/dim]")

    except StrideError as exc:
        handle_error(exc)


@app.command("history")
def progress_history(
    journey: Annotated[
        str,
        typer.Argument(help="Journey name or ID"),
    ],
    limit: Annotated[
        int,
        typer.Option(
            "--limit",
            "-l",
            min=1,
            max=500,
            help="Maximum number of events.",
        ),
    ] = 50,
    range_preset: Annotated[
        str | None,
        typer.Option(
            "--range",
            "-r",
            help=("today/7d/30d/this-month/last-month/this-year/last-year/all"),
        ),
    ] = None,
) -> None:
    """Show progress event history."""
    try:
        start_date, end_date = resolve_history_range(
            range_preset,
        )

        with app_context(get_config()) as context:
            current = context.stride_journey_service.get_journey(journey)

            events = context.stride_progress_service.get_history(
                journey,
                limit=limit,
                start_date=start_date,
                end_date=end_date,
            )

        if not events:
            console.print(
                f"[dim]No progress events for "
                f"[bold]{current.name}[/bold]"
                f"{f' in {range_preset}' if range_preset else ''}.[/dim]"
            )
            return

        render_history_table(
            events,
            current,
            console=console,
        )

        console.print(f"[dim]Showing {len(events)} event(s).[/dim]")

    except StrideError as exc:
        handle_error(exc)


@app.command("edit")
def edit_event(
    event_id: Annotated[
        int,
        typer.Argument(help="Event ID"),
    ],
    value: Annotated[
        float | None,
        typer.Option("--value", "-v"),
    ] = None,
    hours: Annotated[
        float | None,
        typer.Option("--hours"),
    ] = None,
    minutes: Annotated[
        int | None,
        typer.Option("--minutes"),
    ] = None,
    date_value: Annotated[
        str | None,
        typer.Option("--date", help="New date (YYYY-MM-DD)"),
    ] = None,
    time_value: Annotated[
        str | None,
        typer.Option("--time", help="New time (HH:MM)"),
    ] = None,
    note: Annotated[
        str | None,
        typer.Option("--note", "-n"),
    ] = None,
    clear_note: Annotated[
        bool,
        typer.Option("--clear-note"),
    ] = False,
) -> None:
    """Edit a progress event."""
    try:
        if clear_note and note is not None:
            raise typer.BadParameter("--note and --clear-note cannot be combined.")

        duration_seconds = build_duration_seconds(
            hours=hours,
            minutes=minutes,
        )

        occurred_at: datetime | None = None

        if date_value or time_value:
            selected_date = (
                parse_date(
                    date_value,
                    option_name="date",
                )
                if date_value
                else datetime.now().date()
            )

            selected_time = time_value or "00:00"

            try:
                occurred_at = datetime.fromisoformat(
                    f"{selected_date.isoformat()}T{selected_time}",
                )
            except ValueError as exc:
                raise typer.BadParameter(
                    "Expected time in HH:MM format.",
                    param_hint="--time",
                ) from exc

        with app_context(get_config()) as context:
            event = context.stride_progress_service.edit_event(
                event_id,
                value=value,
                duration_seconds=duration_seconds,
                occurred_at=occurred_at,
                note=note,
                clear_note=clear_note,
            )

        console.print(f"[bold green]✓[/bold green] Updated event [bold]{event.id}[/bold].")

    except StrideError as exc:
        handle_error(exc)


@app.command("delete")
def delete_event(
    event_id: Annotated[
        int,
        typer.Argument(help="Event ID"),
    ],
    force: Annotated[
        bool,
        typer.Option(
            "--force",
            "-f",
            help="Skip confirmation.",
        ),
    ] = False,
) -> None:
    """Delete a progress event."""
    try:
        if not force:
            confirmed = typer.confirm(f"Delete event {event_id}? This cannot be undone.")

            if not confirmed:
                console.print("[dim]Deletion cancelled.[/dim]")
                raise typer.Exit(code=0)

        with app_context(get_config()) as context:
            context.stride_progress_service.delete_event(event_id)

        console.print(f"[bold green]✓[/bold green] Deleted event [bold]{event_id}[/bold].")

    except StrideError as exc:
        handle_error(exc)

"""Stride statistics CLI commands."""

from __future__ import annotations

from datetime import date
from typing import Annotated

import typer

from momentum.app.context import app_context
from momentum.config import get_config
from momentum.stride.cli.common import (
    console,
    handle_error,
    journey_reference,
    parse_date,
)
from momentum.stride.domain.enums import JourneyStatus
from momentum.stride.domain.errors import StrideError
from momentum.stride.presentation.dashboard import render_dashboard
from momentum.stride.presentation.tables import render_calendar, render_stats
from momentum.stride.services.stats_service import (
    DateRange,
    get_range_presets,
)

app = typer.Typer(
    help="View statistics and analytics.",
    no_args_is_help=True,
)


def _resolve_date_range(
    *,
    range_preset: str | None,
    start: str | None,
    end: str | None,
) -> DateRange | None:
    """Resolve CLI range arguments into a domain date range."""
    if range_preset and (start or end):
        raise typer.BadParameter(
            "--range cannot be combined with --start or --end.",
        )

    if start or end:
        start_date = (
            parse_date(
                start,
                option_name="start",
            )
            if start
            else None
        )

        end_date = (
            parse_date(
                end,
                option_name="end",
            )
            if end
            else None
        )

        try:
            return DateRange.custom(
                start_date,
                end_date,
            )
        except ValueError as exc:
            raise typer.BadParameter(str(exc)) from exc

    if range_preset:
        presets = get_range_presets()
        normalized = range_preset.lower()

        try:
            return presets[normalized]
        except KeyError as exc:
            valid = ", ".join(presets)

            raise typer.BadParameter(
                f"Unknown range '{range_preset}'. Valid ranges: {valid}.",
                param_hint="--range",
            ) from exc

    return None


@app.command("show")
def show_stats(
    journey: Annotated[
        str,
        typer.Argument(help="Journey name or ID"),
    ],
    range_preset: Annotated[
        str | None,
        typer.Option(
            "--range",
            "-r",
            help=("today/yesterday/7d/30d/this-month/last-month/this-year/last-year/all"),
        ),
    ] = None,
    start: Annotated[
        str | None,
        typer.Option(
            "--start",
            help="Custom start date (YYYY-MM-DD).",
        ),
    ] = None,
    end: Annotated[
        str | None,
        typer.Option(
            "--end",
            help="Custom end date (YYYY-MM-DD).",
        ),
    ] = None,
    calendar: Annotated[
        bool,
        typer.Option(
            "--calendar",
            "-c",
            help="Show the activity calendar.",
        ),
    ] = False,
    year: Annotated[
        int | None,
        typer.Option(
            "--year",
            help="Calendar year. Defaults to the current year.",
        ),
    ] = None,
) -> None:
    """Show detailed statistics for a journey."""
    try:
        date_range = _resolve_date_range(
            range_preset=range_preset,
            start=start,
            end=end,
        )

        calendar_year = year or date.today().year

        if not 1900 <= calendar_year <= 9999:
            raise typer.BadParameter(
                "--year must be between 1900 and 9999.",
            )

        with app_context(get_config()) as context:
            current = context.stride_journey_service.get_journey(
                journey_reference(journey),
            )

            progress = context.stride_stats_service.get_progress(
                current,
            )

            streak = context.stride_stats_service.get_streak(
                current,
            )

            pace = context.stride_stats_service.get_pace(
                current,
                progress,
            )

            stats = context.stride_stats_service.get_stats(
                current,
                date_range,
            )

        render_stats(
            progress,
            stats,
            streak,
            pace,
            console=console,
        )

        if calendar:
            with app_context(get_config()) as context:
                calendar_data = context.stride_stats_service.get_calendar_data(
                    current,
                    calendar_year,
                )
                console.print()

                render_calendar(
                    calendar_data,
                    calendar_year,
                    current,
                    console=console,
                )

    except StrideError as exc:
        handle_error(exc)


@app.command("dashboard")
def dashboard() -> None:
    """Show active journeys, progress, today's activity, and streaks."""
    try:
        with app_context(get_config()) as context:
            journeys = context.stride_journey_service.list_journeys(status=JourneyStatus.ACTIVE)

            summaries = {
                journey.id: context.stride_stats_service.get_progress(journey)
                for journey in journeys
            }

            streaks = {
                journey.id: context.stride_stats_service.get_streak(journey) for journey in journeys
            }

            today_activity = context.stride_stats_service.get_today_activity(journeys)

        render_dashboard(
            journeys,
            summaries,
            streaks,
            today_activity,
            console=console,
        )

    except StrideError as exc:
        handle_error(exc)

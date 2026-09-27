"""Shared CLI infrastructure and input helpers."""

from __future__ import annotations

from datetime import date, datetime, timedelta

import typer
from rich.console import Console

from momentum.stride.domain.enums import TrackingMethod
from momentum.stride.domain.errors import StrideError

console = Console()


def handle_error(error: StrideError) -> None:
    """Render a domain/application error and terminate the command."""
    console.print(
        f"[bold red]✗[/bold red] {error}",
    )
    raise typer.Exit(code=1)


def parse_date(
    value: str,
    *,
    option_name: str = "date",
) -> date:
    """Parse an ISO date."""
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise typer.BadParameter(
            f"'{value}' is not a valid date. Expected YYYY-MM-DD.",
            param_hint=f"--{option_name}",
        ) from exc


def parse_datetime(
    value: str,
    *,
    option_name: str = "datetime",
) -> datetime:
    """Parse an ISO datetime."""
    try:
        return datetime.fromisoformat(value)
    except ValueError as exc:
        raise typer.BadParameter(
            f"'{value}' is not a valid datetime.",
            param_hint=f"--{option_name}",
        ) from exc


def parse_tracking_method(value: str) -> TrackingMethod:
    """Parse a tracking method."""
    try:
        return TrackingMethod(value.strip().lower())
    except ValueError as exc:
        choices = ", ".join(method.value for method in TrackingMethod)

        raise typer.BadParameter(
            f"Expected one of: {choices}.",
            param_hint="--method",
        ) from exc


def build_duration_seconds(
    *,
    hours: float | None,
    minutes: int | None,
) -> int | None:
    """Convert duration CLI arguments to seconds."""
    if hours is None and minutes is None:
        return None

    if hours is not None and hours < 0:
        raise typer.BadParameter("--hours cannot be negative.")

    if minutes is not None and minutes < 0:
        raise typer.BadParameter("--minutes cannot be negative.")

    seconds = int((hours or 0) * 3600) + (minutes or 0) * 60

    if seconds <= 0:
        raise typer.BadParameter(
            "Duration must be greater than zero.",
        )

    return seconds


def journey_reference(value: str) -> str | int:
    """Normalize a journey name/ID reference."""
    value = value.strip()

    if not value:
        raise typer.BadParameter(
            "Journey cannot be empty.",
        )

    return int(value) if value.isdigit() else value


def resolve_history_range(
    preset: str | None,
    *,
    today: date | None = None,
) -> tuple[date | None, date | None]:
    """Resolve a history range preset into inclusive calendar dates."""
    if preset is None or preset == "all":
        return None, None

    current = today or date.today()

    if preset == "today":
        return current, current

    if preset == "7d":
        return current - timedelta(days=6), current

    if preset == "30d":
        return current - timedelta(days=29), current

    if preset == "this-month":
        return (
            current.replace(day=1),
            current,
        )

    if preset == "last-month":
        first_this_month = current.replace(day=1)
        last_previous_month = first_this_month - timedelta(days=1)

        return (
            last_previous_month.replace(day=1),
            last_previous_month,
        )

    if preset == "this-year":
        return (
            date(current.year, 1, 1),
            current,
        )

    if preset == "last-year":
        return (
            date(current.year - 1, 1, 1),
            date(current.year - 1, 12, 31),
        )

    raise typer.BadParameter(
        "Expected one of: today, 7d, 30d, this-month, last-month, this-year, last-year, all.",
        param_hint="--range",
    )

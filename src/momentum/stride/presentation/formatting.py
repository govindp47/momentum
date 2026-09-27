"""Terminal formatting helpers.

This module contains presentation-only formatting functions. It must not
contain business rules, persistence logic, or Rich-specific rendering logic.
"""

from __future__ import annotations

from datetime import date, datetime


def format_duration(seconds: int | float | None) -> str:
    """Format seconds as a compact human-readable duration.

    Examples:
        3661 -> "1h 1m 1s"
        3660 -> "1h 1m"
        90   -> "1m 30s"
        45   -> "45s"
        0    -> "0s"
    """
    if seconds is None:
        return "—"

    total = max(0, int(seconds))

    hours, remainder = divmod(total, 3600)
    minutes, secs = divmod(remainder, 60)

    parts: list[str] = []

    if hours:
        parts.append(f"{hours}h")

    if minutes:
        parts.append(f"{minutes}m")

    if secs:
        parts.append(f"{secs}s")

    return " ".join(parts) if parts else "0s"


def format_duration_hours(
    hours: float | None,
) -> str:
    """Format decimal hours as a human-readable duration."""
    if hours is None:
        return "—"

    return format_duration(hours * 3600)


def format_number(value: float | int | None) -> str:
    """Format a numeric value without unnecessary decimal places."""
    if value is None:
        return "—"

    if float(value).is_integer():
        return f"{int(value):,}"

    return f"{value:,.2f}"


def format_value(
    value: float | int | None,
    unit: str | None = None,
) -> str:
    """Format a numeric value with an optional unit."""
    if value is None:
        return "—"

    formatted = format_number(value)

    if unit:
        return f"{formatted} {unit}"

    return formatted


def format_percentage(
    percentage: float | None,
) -> str:
    """Format a percentage with one decimal place."""
    if percentage is None:
        return "—"

    return f"{percentage:.1f}%"


def format_date(
    value: date | datetime | None,
) -> str:
    """Format a date for human-readable terminal output."""
    if value is None:
        return "—"

    if isinstance(value, datetime):
        value = value.date()

    return value.strftime("%b %d, %Y")


def format_date_short(
    value: date | datetime | None,
) -> str:
    """Format a date as ISO YYYY-MM-DD."""
    if value is None:
        return "—"

    if isinstance(value, datetime):
        value = value.date()

    return value.isoformat()


def format_datetime(
    value: datetime | None,
) -> str:
    """Format a datetime for terminal output."""
    if value is None:
        return "—"

    return value.strftime("%b %d, %Y %H:%M")


def format_rate(
    rate: float | None,
    unit: str | None,
    per: str = "day",
) -> str:
    """Format a rate with its unit and period."""
    if rate is None:
        return "—"

    if rate == float("inf"):
        return "∞"

    value = format_number(rate)

    if unit:
        return f"{value} {unit}/{per}"

    return f"{value}/{per}"


def make_progress_bar(
    percentage: float,
    width: int = 28,
) -> str:
    """Build a bounded terminal progress bar."""
    if width <= 0:
        raise ValueError("Progress bar width must be positive.")

    percentage = max(0.0, min(100.0, percentage))

    filled = round(width * percentage / 100)
    empty = width - filled

    return "━" * filled + "─" * empty


def format_signed_percentage(
    percentage: float | None,
) -> str:
    """Format a percentage with an explicit sign."""
    if percentage is None:
        return "—"

    return f"{percentage:+.1f}%"

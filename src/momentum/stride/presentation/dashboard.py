"""Dashboard renderer for the Stride CLI.

The dashboard is a presentation-only view over already-derived domain data.

Responsibilities:
- Render active journey progress.
- Render today's activity.
- Highlight streaks.
- Render aggregate dashboard counts.

This module must not:
- Query storage.
- Call services.
- Mutate domain state.
- Perform business calculations.
"""

from __future__ import annotations

from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.text import Text

from momentum.stride.domain.enums import JourneyStatus, TrackingMethod
from momentum.stride.domain.models import (
    DailyActivity,
    Journey,
    ProgressSummary,
    StreakInfo,
)
from momentum.stride.presentation.formatting import (
    format_duration,
    format_duration_hours,
    format_percentage,
    format_value,
    make_progress_bar,
)
from momentum.stride.presentation.layout import (
    render_header,
)


def _unit(journey: Journey) -> str:
    """Return the display unit for a journey."""
    if journey.tracking_method == TrackingMethod.DURATION:
        return "h"

    return journey.unit or ""


def _progress_label(summary: ProgressSummary) -> str:
    """Format the current progress and target for display."""
    journey = summary.journey
    method = journey.tracking_method
    unit = _unit(journey)

    if method == TrackingMethod.MILESTONE:
        return f"{summary.milestones_completed} / {summary.milestones_total} milestones"

    if method == TrackingMethod.DURATION:
        return (
            f"{format_duration_hours(summary.current_value)} / "
            f"{format_duration_hours(summary.target_value)}"
        )

    current = format_value(summary.current_value, unit)
    target = format_value(summary.target_value, unit)

    return f"{current} / {target}"


def _tracking_method_label(method: TrackingMethod) -> str:
    """Return a human-readable tracking method label."""
    labels = {
        TrackingMethod.MILESTONE: "Milestones",
        TrackingMethod.COUNT: "Count",
        TrackingMethod.QUANTITY: "Quantity",
        TrackingMethod.DURATION: "Duration",
    }

    return labels[method]


def _today_activity_detail(
    journey: Journey,
    activity: DailyActivity,
) -> str:
    """Format today's activity according to the journey's tracking method."""
    method = journey.tracking_method
    unit = _unit(journey)

    if method == TrackingMethod.DURATION:
        return format_duration(activity.total_duration_seconds)

    if method == TrackingMethod.MILESTONE:
        count = activity.event_count
        suffix = "" if count == 1 else "s"
        return f"{count} milestone{suffix}"

    return format_value(activity.total_value, unit)


def _build_progress_table(
    active_journeys: list[Journey],
    summaries: dict[int, ProgressSummary],
    streaks: dict[int, StreakInfo],
    today_activity: dict[int, DailyActivity],
) -> Table:
    """Build the active-journey progress table."""
    table = Table(
        show_header=True,
        header_style="bold cyan",
        border_style="dim",
        box=None,
        expand=True,
        padding=(0, 1),
    )

    table.add_column("Journey", ratio=3, no_wrap=True)
    table.add_column("Progress", ratio=3)
    table.add_column("Completion", justify="right", width=12)
    table.add_column("Streak", justify="right", width=10)
    table.add_column("Today", justify="center", width=8)

    for journey in active_journeys:
        summary = summaries.get(journey.id)

        # The dashboard should tolerate incomplete derived data rather than
        # failing the entire CLI screen.
        if summary is None:
            continue

        streak = streaks.get(journey.id)
        has_activity_today = journey.id in today_activity

        percentage = max(0.0, min(100.0, summary.percentage))
        progress_bar = make_progress_bar(percentage, width=18)

        journey_text = Text()
        journey_text.append(journey.name, style="bold")
        journey_text.append(
            f"\n{_tracking_method_label(journey.tracking_method)}",
            style="dim",
        )

        progress_text = Text()
        progress_text.append(progress_bar, style="cyan")
        progress_text.append(
            f"\n{_progress_label(summary)}",
            style="dim",
        )

        completion = format_percentage(percentage)

        if streak is None or streak.current_streak <= 0:
            streak_text = Text("—", style="dim")
        else:
            streak_text = Text(
                f"{streak.current_streak}d",
                style="bold yellow",
            )

        today_text = Text("●", style="green") if has_activity_today else Text("—", style="dim")

        table.add_row(
            journey_text,
            progress_text,
            completion,
            streak_text,
            today_text,
        )

    return table


def _build_today_activity_table(
    journeys: list[Journey],
    today_activity: dict[int, DailyActivity],
) -> Table:
    """Build the today's-activity table."""
    table = Table(
        show_header=True,
        header_style="bold green",
        border_style="dim",
        box=None,
        expand=True,
        padding=(0, 1),
    )

    table.add_column("Journey", ratio=3, no_wrap=True)
    table.add_column("Activity", ratio=2)
    table.add_column("Events", justify="right", width=8)

    journeys_by_id = {journey.id: journey for journey in journeys}

    for journey_id, activity in today_activity.items():
        journey = journeys_by_id.get(journey_id)

        if journey is None:
            continue

        table.add_row(
            journey.name,
            _today_activity_detail(journey, activity),
            str(activity.event_count),
        )

    return table


def _build_summary_panel(
    active_journeys: list[Journey],
    today_activity: dict[int, DailyActivity],
    streaks: dict[int, StreakInfo],
) -> Panel:
    """Build the compact dashboard summary panel."""
    active_count = len(active_journeys)
    active_today_count = sum(journey.id in today_activity for journey in active_journeys)

    current_streaks = [
        streaks[journey.id].current_streak for journey in active_journeys if journey.id in streaks
    ]

    best_current_streak = max(current_streaks, default=0)

    grid = Table.grid(expand=True, padding=(0, 2))
    grid.add_column(justify="center")
    grid.add_column(justify="center")
    grid.add_column(justify="center")

    grid.add_row(
        f"[bold cyan]{active_count}[/bold cyan]\n[dim]Active journeys[/dim]",
        f"[bold green]{active_today_count}[/bold green]\n[dim]Active today[/dim]",
        (f"[bold yellow]{best_current_streak}d[/bold yellow]\n[dim]Best current streak[/dim]"),
    )

    return Panel(
        grid,
        border_style="cyan",
        padding=(1, 1),
    )


def render_dashboard(
    journeys: list[Journey],
    summaries: dict[int, ProgressSummary],
    streaks: dict[int, StreakInfo],
    today_activity: dict[int, DailyActivity],
    *,
    console: Console | None = None,
) -> None:
    """Render the Stride dashboard.

    Args:
        journeys: Journeys available to the dashboard.
        summaries: Derived progress summaries keyed by journey ID.
        streaks: Derived streak information keyed by journey ID.
        today_activity: Today's aggregated activity keyed by journey ID.
        console: Optional Rich console, primarily useful for testing.
    """
    output = console if console is not None else Console()

    active_journeys = [journey for journey in journeys if journey.status == JourneyStatus.ACTIVE]

    render_header(
        output,
        "Stride Dashboard",
        subtitle="Your active journeys at a glance",
    )

    if not active_journeys:
        output.print(
            Panel(
                "[dim]No active journeys.[/dim]\n\n"
                "Create one with "
                "[bold cyan]stride journey create[/bold cyan].",
                title="[bold]Getting Started[/bold]",
                border_style="dim",
                padding=(1, 2),
            )
        )
        return

    # Overall summary.
    output.print(
        _build_summary_panel(
            active_journeys,
            today_activity,
            streaks,
        )
    )
    output.print()

    # Active journeys.
    output.print("[bold]Active Journeys[/bold]")
    output.print()

    progress_table = _build_progress_table(
        active_journeys,
        summaries,
        streaks,
        today_activity,
    )

    output.print(progress_table)

    output.print()

    # Today's activity.
    output.print("[bold]Today's Activity[/bold]")
    output.print()

    if not today_activity:
        output.print(
            Panel(
                "[dim]Nothing logged today.[/dim]",
                border_style="dim",
                padding=(0, 1),
            )
        )
    else:
        output.print(
            _build_today_activity_table(
                active_journeys,
                today_activity,
            )
        )

    output.print()
    output.print("[dim]Progress is built one event at a time.[/dim]")

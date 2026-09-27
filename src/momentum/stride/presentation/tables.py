"""Rich presentation components for Stride.

This module is responsible only for terminal presentation. It must not
perform business operations, mutate domain objects, or access SQLite.
"""

from __future__ import annotations

from datetime import date

from rich import box
from rich.console import Console, Group
from rich.panel import Panel
from rich.table import Table
from rich.text import Text

from momentum.stride.domain.enums import EventType, JourneyStatus, TrackingMethod
from momentum.stride.domain.models import (
    Achievement,
    DailyActivity,
    Journey,
    JourneyStats,
    Milestone,
    PaceInfo,
    ProgressEvent,
    ProgressSummary,
    StreakInfo,
)
from momentum.stride.presentation.formatting import (
    format_date,
    format_date_short,
    format_duration,
    format_duration_hours,
    format_percentage,
    format_rate,
    format_value,
    make_progress_bar,
)

# ---------------------------------------------------------------------------
# Shared presentation constants
# ---------------------------------------------------------------------------

STATUS_STYLES = {
    JourneyStatus.ACTIVE: "green",
    JourneyStatus.PAUSED: "yellow",
    JourneyStatus.COMPLETED: "cyan",
    JourneyStatus.ARCHIVED: "dim",
}

STATUS_ICONS = {
    JourneyStatus.ACTIVE: "●",
    JourneyStatus.PAUSED: "Ⅱ",
    JourneyStatus.COMPLETED: "✓",
    JourneyStatus.ARCHIVED: "◼",
}


def _safe_console(console: Console | None) -> Console:
    """Return the supplied console or create a default one."""
    return console if console is not None else Console()


def _unit_label(journey: Journey) -> str | None:
    """Return the display unit for a journey."""
    if journey.tracking_method == TrackingMethod.DURATION:
        return "hours"

    return journey.unit


def _status_text(status: JourneyStatus) -> Text:
    """Build styled status text."""
    style = STATUS_STYLES.get(status, "white")
    icon = STATUS_ICONS.get(status, "•")

    return Text(
        f"{icon} {status.value}",
        style=style,
    )


def _method_label(method: TrackingMethod) -> str:
    """Return a human-friendly tracking method label."""
    return {
        TrackingMethod.MILESTONE: "Milestones",
        TrackingMethod.COUNT: "Count",
        TrackingMethod.QUANTITY: "Quantity",
        TrackingMethod.DURATION: "Duration",
    }[method]


# ---------------------------------------------------------------------------
# Journey list
# ---------------------------------------------------------------------------


def render_journey_table(
    journeys: list[Journey],
    *,
    console: Console | None = None,
) -> None:
    """Render the journey collection."""
    output = _safe_console(console)

    if not journeys:
        output.print(
            Panel(
                "[dim]No journeys found.[/dim]\n\n"
                "Create one with [cyan]stride journey create[/cyan].",
                title="Journeys",
                border_style="dim",
                padding=(1, 2),
            )
        )
        return

    table = Table(
        box=box.ROUNDED,
        border_style="dim",
        header_style="bold cyan",
        show_header=True,
        expand=True,
        padding=(0, 1),
    )

    table.add_column("ID", style="dim", justify="right", width=4)
    table.add_column("Journey", style="bold", min_width=18)
    table.add_column("Method", min_width=12)
    table.add_column("Progress", justify="right", min_width=12)
    table.add_column("Status", min_width=14)
    table.add_column("Start", style="dim", min_width=12)
    table.add_column("Target", style="dim", min_width=12)

    for journey in journeys:
        target = format_value(
            journey.target_value,
            _unit_label(journey),
        )

        table.add_row(
            str(journey.id),
            journey.name,
            _method_label(journey.tracking_method),
            target,
            _status_text(journey.status),
            format_date_short(journey.start_date),
            format_date_short(journey.target_date),
        )

    output.print(table)
    output.print(f"[dim]{len(journeys)} journey{'' if len(journeys) == 1 else 's'}[/dim]")


# ---------------------------------------------------------------------------
# Milestones
# ---------------------------------------------------------------------------


def render_milestone_table(
    milestones: list[Milestone],
    *,
    console: Console | None = None,
) -> None:
    """Render milestones in their configured order."""
    output = _safe_console(console)

    if not milestones:
        output.print(
            Panel(
                "[dim]No milestones defined for this journey.[/dim]",
                border_style="dim",
            )
        )
        return

    table = Table(
        box=box.ROUNDED,
        border_style="dim",
        header_style="bold cyan",
        expand=True,
    )

    table.add_column("#", style="dim", justify="right", width=4)
    table.add_column("Milestone", style="bold", min_width=24)
    table.add_column("Status", min_width=16)
    table.add_column("Completed", style="dim", min_width=18)

    for milestone in milestones:
        if milestone.is_completed:
            status = Text("✓ Completed", style="green")
        else:
            status = Text("○ Pending", style="yellow")

        table.add_row(
            str(milestone.position + 1),
            milestone.name,
            status,
            format_date(milestone.completed_at),
        )

    output.print(table)


# ---------------------------------------------------------------------------
# History
# ---------------------------------------------------------------------------


def render_history_table(
    events: list[ProgressEvent],
    journey: Journey,
    *,
    console: Console | None = None,
) -> None:
    """Render progress history."""
    output = _safe_console(console)

    if not events:
        output.print(
            Panel(
                "[dim]No activity recorded yet.[/dim]",
                title="History",
                border_style="dim",
            )
        )
        return

    table = Table(
        title=f"[bold]{journey.name}[/bold] · History",
        box=box.ROUNDED,
        border_style="dim",
        header_style="bold cyan",
        expand=True,
    )

    table.add_column("ID", style="dim", justify="right", width=5)
    table.add_column("Date", style="dim", width=12)
    table.add_column("Type", width=20)

    if journey.tracking_method == TrackingMethod.DURATION:
        table.add_column("Duration", justify="right", width=12)
    elif journey.tracking_method == TrackingMethod.MILESTONE:
        table.add_column("Milestone", width=22)
    else:
        table.add_column("Value", justify="right", width=14)

    table.add_column("Note", style="dim", ratio=1)

    for event in events:
        event_type = event.event_type

        if event_type == EventType.MILESTONE_COMPLETED:
            type_text = Text(
                "✓ Milestone",
                style="green",
            )

            value_text = "Completed"

        elif journey.tracking_method == TrackingMethod.DURATION:
            type_text = Text(
                "Progress",
                style="cyan",
            )

            value_text = format_duration(
                event.duration_seconds,
            )

        else:
            type_text = Text(
                "Progress",
                style="cyan",
            )

            value_text = format_value(
                event.value,
                journey.unit,
            )

        table.add_row(
            str(event.id),
            format_date_short(event.occurred_at),
            type_text,
            value_text,
            event.note or "—",
        )

    output.print(table)


# ---------------------------------------------------------------------------
# Progress summary
# ---------------------------------------------------------------------------


def _progress_panel(
    summary: ProgressSummary,
) -> Panel:
    """Build the primary journey progress panel."""
    journey = summary.journey

    bar = make_progress_bar(
        summary.percentage,
        width=34,
    )

    progress_text = Text()
    progress_text.append(bar, style="cyan")
    progress_text.append(
        f"  {format_percentage(summary.percentage)}",
        style="bold",
    )

    table = Table(
        box=None,
        show_header=False,
        padding=(0, 2),
        expand=True,
    )

    table.add_column(
        "Metric",
        style="dim",
        min_width=22,
    )

    table.add_column(
        "Value",
        style="bold",
    )

    if journey.tracking_method == TrackingMethod.MILESTONE:
        table.add_row(
            "Milestones",
            (f"{summary.milestones_completed} / {summary.milestones_total}"),
        )

    elif journey.tracking_method == TrackingMethod.DURATION:
        table.add_row(
            "Time Logged",
            (
                f"{format_duration_hours(summary.current_value)} "
                f"/ {format_duration_hours(summary.target_value)}"
            ),
        )
        table.add_row(
            "Remaining",
            format_duration_hours(summary.remaining),
        )

    else:
        unit = _unit_label(journey)

        table.add_row(
            "Progress",
            format_value(summary.current_value, unit),
        )
        table.add_row(
            "Target",
            format_value(summary.target_value, unit),
        )
        table.add_row(
            "Remaining",
            format_value(summary.remaining, unit),
        )

    table.add_row(
        "Events",
        f"{summary.event_count:,}",
    )

    group = Group(
        progress_text,
        Text(""),
        table,
    )

    return Panel(
        group,
        title="[bold cyan]Progress[/bold cyan]",
        border_style="cyan",
        padding=(1, 2),
    )


# ---------------------------------------------------------------------------
# Pace
# ---------------------------------------------------------------------------


def _pace_panel(
    journey: Journey,
    pace: PaceInfo,
) -> Panel | None:
    """Build the pace panel when trajectory data is meaningful."""
    if pace.days_remaining is None and pace.projected_completion_date is None:
        return None

    unit = _unit_label(journey)

    table = Table(
        box=None,
        show_header=False,
        padding=(0, 2),
    )

    table.add_column(
        "Metric",
        style="dim",
        min_width=22,
    )

    table.add_column(
        "Value",
        style="bold",
    )

    table.add_row(
        "Days Elapsed",
        str(pace.days_elapsed),
    )

    if pace.days_remaining is not None:
        table.add_row(
            "Days Remaining",
            str(pace.days_remaining),
        )

    table.add_row(
        "Actual Rate",
        format_rate(
            pace.actual_daily_rate,
            unit,
        ),
    )

    if pace.required_daily_rate is not None:
        table.add_row(
            "Required Rate",
            format_rate(
                pace.required_daily_rate,
                unit,
            ),
        )

    if pace.projected_completion_date is not None:
        table.add_row(
            "Projected Finish",
            format_date(pace.projected_completion_date),
        )

    if journey.target_date is not None:
        table.add_row(
            "Target Date",
            format_date(journey.target_date),
        )

    if pace.is_on_pace is True:
        status = Text("✓ On pace", style="green")
    elif pace.is_on_pace is False:
        status = Text("! Behind pace", style="yellow")
    else:
        status = Text("—", style="dim")

    table.add_row(
        "Status",
        status,
    )

    return Panel(
        table,
        title="[bold]Pace & Trajectory[/bold]",
        border_style="dim",
        padding=(1, 2),
    )


# ---------------------------------------------------------------------------
# Streak
# ---------------------------------------------------------------------------


def _streak_panel(
    streak: StreakInfo,
) -> Panel:
    """Build streak and consistency panel."""
    table = Table(
        box=None,
        show_header=False,
        padding=(0, 2),
    )

    table.add_column(
        "Metric",
        style="dim",
        min_width=22,
    )

    table.add_column(
        "Value",
        style="bold",
    )

    table.add_row(
        "Current Streak",
        f"[cyan]{streak.current_streak} days[/cyan]",
    )

    table.add_row(
        "Longest Streak",
        f"{streak.longest_streak} days",
    )

    table.add_row(
        "Active Days",
        str(streak.active_days),
    )

    table.add_row(
        "Last Active",
        format_date(streak.last_active_date),
    )

    return Panel(
        table,
        title="[bold]Consistency[/bold]",
        border_style="dim",
        padding=(1, 2),
    )


# ---------------------------------------------------------------------------
# Aggregate statistics
# ---------------------------------------------------------------------------


def _stats_panel(
    stats: JourneyStats,
) -> Panel:
    """Build aggregate statistics panel."""
    journey = stats.journey
    unit = _unit_label(journey)

    table = Table(
        box=None,
        show_header=False,
        padding=(0, 2),
    )

    table.add_column(
        "Metric",
        style="dim",
        min_width=22,
    )

    table.add_column(
        "Value",
        style="bold",
    )

    if journey.tracking_method == TrackingMethod.DURATION:
        table.add_row(
            "Total",
            format_duration_hours(stats.total_value),
        )
        table.add_row(
            "Average / Event",
            format_duration_hours(stats.average_per_event),
        )
        table.add_row(
            "Average / Active Day",
            format_duration_hours(
                stats.average_per_active_day,
            ),
        )
        table.add_row(
            "Best Day",
            format_duration_hours(stats.best_day_value),
        )

    else:
        table.add_row(
            "Total",
            format_value(stats.total_value, unit),
        )
        table.add_row(
            "Average / Event",
            format_value(stats.average_per_event, unit),
        )
        table.add_row(
            "Average / Active Day",
            format_value(
                stats.average_per_active_day,
                unit,
            ),
        )
        table.add_row(
            "Best Day",
            format_value(stats.best_day_value, unit),
        )

    table.add_row(
        "Best Day Date",
        format_date(stats.best_day_date),
    )

    table.add_row(
        "Active Days",
        str(stats.active_days),
    )

    table.add_row(
        "Events",
        str(stats.event_count),
    )

    return Panel(
        table,
        title=f"[bold]Statistics · {stats.period_label}[/bold]",
        border_style="dim",
        padding=(1, 2),
    )


# ---------------------------------------------------------------------------
# Full stats view
# ---------------------------------------------------------------------------


def render_stats(
    summary: ProgressSummary,
    stats: JourneyStats,
    streak: StreakInfo,
    pace: PaceInfo,
    *,
    console: Console | None = None,
) -> None:
    """Render the complete statistics view."""
    output = _safe_console(console)
    journey = summary.journey

    output.print()
    output.print(
        Panel(
            Text(
                journey.name,
                style="bold",
            ),
            subtitle=(f"{_method_label(journey.tracking_method)} · {journey.status.value}"),
            border_style="cyan",
            padding=(0, 2),
        )
    )

    output.print()

    output.print(_progress_panel(summary))
    output.print()

    pace_panel = _pace_panel(journey, pace)

    if pace_panel is not None:
        output.print(pace_panel)
        output.print()

    output.print(_streak_panel(streak))
    output.print()

    output.print(_stats_panel(stats))
    output.print()


# ---------------------------------------------------------------------------
# Calendar
# ---------------------------------------------------------------------------


def render_calendar(
    daily_activity: list[DailyActivity],
    year: int,
    journey: Journey,
    *,
    console: Console | None = None,
) -> None:
    """Render a compact year activity calendar."""
    output = _safe_console(console)

    lookup: dict[date, float] = {}

    for activity in daily_activity:
        if journey.tracking_method == TrackingMethod.DURATION:
            value = activity.total_duration_seconds / 3600.0
        elif journey.tracking_method == TrackingMethod.MILESTONE:
            value = float(activity.event_count)
        else:
            value = activity.total_value

        lookup[activity.date] = value

    max_value = max(
        lookup.values(),
        default=0.0,
    )

    def intensity(value: float) -> str:
        if value <= 0 or max_value <= 0:
            return "·"

        ratio = value / max_value

        if ratio <= 0.25:
            return "░"
        if ratio <= 0.50:
            return "▒"
        if ratio <= 0.75:
            return "▓"

        return "█"

    # Calendar is intentionally text-based. Rich is used for styling,
    # but no external calendar widget is necessary.
    from calendar import month_abbr, monthrange

    output.print(
        Panel(
            f"[dim]Activity intensity for {year}[/dim]\n"
            "[dim]· none  ░ light  ▒ moderate  ▓ high  █ peak[/dim]",
            title=f"[bold cyan]{journey.name} · Activity[/bold cyan]",
            border_style="cyan",
        )
    )

    output.print()

    for month in range(1, 13):
        days = monthrange(year, month)[1]

        cells = []

        for day in range(1, days + 1):
            current = date(year, month, day)
            cells.append(
                intensity(
                    lookup.get(current, 0.0),
                )
            )

        output.print(f"[bold]{month_abbr[month]}[/bold] " + "".join(cells))

    output.print()


# ---------------------------------------------------------------------------
# Achievements
# ---------------------------------------------------------------------------


def render_achievements(
    achievements: list[Achievement],
    *,
    console: Console | None = None,
) -> None:
    """Render unlocked achievements."""
    output = _safe_console(console)

    if not achievements:
        output.print(
            Panel(
                "No achievements unlocked yet.\n\n[dim]Keep making progress.[/dim]",
                title="[bold yellow]Achievements[/bold yellow]",
                border_style="yellow",
                padding=(1, 2),
            )
        )
        return

    table = Table(
        title="🏆 Achievements",
        box=box.ROUNDED,
        border_style="yellow",
        header_style="bold yellow",
        expand=True,
    )

    table.add_column(
        "Achievement",
        style="bold",
        min_width=22,
    )

    table.add_column(
        "Description",
        style="dim",
        min_width=35,
    )

    table.add_column(
        "Journey",
        style="cyan",
        min_width=18,
    )

    for achievement in achievements:
        table.add_row(
            f"🏆 {achievement.title}",
            achievement.description,
            achievement.journey_name or "Global",
        )

    output.print(table)
    output.print(
        f"[dim]{len(achievements)} achievement"
        f"{'' if len(achievements) == 1 else 's'} unlocked[/dim]"
    )

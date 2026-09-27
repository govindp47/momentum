"""Momentum dashboard CLI commands."""

from __future__ import annotations

from typing import Annotated

import typer
from rich.align import Align
from rich.console import Console, Group
from rich.panel import Panel
from rich.table import Table
from rich.text import Text

from momentum.app.context import app_context
from momentum.config import get_config
from momentum.dashboard.service import DashboardData
from momentum.shared.errors import handle_error
from momentum.stride.domain.enums import TrackingMethod
from momentum.stride.domain.models import (
    DailyActivity,
    Journey,
    ProgressSummary,
)
from momentum.stride.presentation.formatting import (
    format_duration,
    format_duration_hours,
    format_percentage,
    format_value,
    make_progress_bar,
)
from momentum.stride.presentation.layout import render_header

console = Console()


app = typer.Typer(
    name="dashboard",
    help="View your combined Momentum dashboard.",
    no_args_is_help=False,
)


def _unit(journey: Journey) -> str:
    """Return the display unit for a journey."""
    if journey.tracking_method == TrackingMethod.DURATION:
        return "h"

    return journey.unit or ""


def _tracking_method_label(method: TrackingMethod) -> str:
    """Return a human-readable tracking method label."""
    labels = {
        TrackingMethod.MILESTONE: "Milestones",
        TrackingMethod.COUNT: "Count",
        TrackingMethod.QUANTITY: "Quantity",
        TrackingMethod.DURATION: "Duration",
    }

    return labels[method]


def _progress_label(summary: ProgressSummary) -> str:
    """Format current journey progress and target."""
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


def _today_activity_detail(
    journey: Journey,
    activity: DailyActivity,
) -> str:
    """Format today's activity according to the journey tracking method."""
    method = journey.tracking_method
    unit = _unit(journey)

    if method == TrackingMethod.DURATION:
        return format_duration(activity.total_duration_seconds)

    if method == TrackingMethod.MILESTONE:
        count = activity.event_count
        suffix = "" if count == 1 else "s"
        return f"{count} milestone{suffix}"

    return format_value(activity.total_value, unit)


def _build_summary_panel(data: DashboardData) -> Panel:
    """Build the combined Momentum summary panel."""
    active_journeys = data.active_journeys
    streaks = data.journey_streaks
    overall = data.ledger_stats

    active_journeys_count = len(active_journeys)

    current_streaks = [
        streaks[journey.id].current_streak for journey in active_journeys if journey.id in streaks
    ]

    best_journey_streak = max(current_streaks, default=0)

    task_stats = getattr(overall, "task_stats", [])

    if task_stats:
        average_rate = sum(getattr(task, "completion_rate", 0.0) for task in task_stats) / len(
            task_stats
        )
    else:
        average_rate = 0.0

    grid = Table.grid(
        expand=True,
        padding=(0, 2),
    )

    grid.add_column(justify="center")
    grid.add_column(justify="center")
    grid.add_column(justify="center")
    grid.add_column(justify="center")

    grid.add_row(
        (f"[bold cyan]{len(task_stats)}[/bold cyan]\n[dim]Commitments[/dim]"),
        (
            f"[bold green]{format_percentage(average_rate)}[/bold green]\n"
            "[dim]Ledger consistency[/dim]"
        ),
        (f"[bold cyan]{active_journeys_count}[/bold cyan]\n[dim]Active journeys[/dim]"),
        (f"[bold yellow]{best_journey_streak}d[/bold yellow]\n[dim]Best journey streak[/dim]"),
    )

    return Panel(
        grid,
        title="[bold]MOMENTUM[/bold]",
        border_style="cyan",
        padding=(1, 1),
    )


def _build_commitment_table(overall: object) -> Table | None:
    """Build the LifeLedger commitment pulse table."""
    task_stats = getattr(overall, "task_stats", [])

    if not task_stats:
        return None

    table = Table(
        show_header=True,
        header_style="bold cyan",
        border_style="dim",
        box=None,
        expand=True,
        padding=(0, 1),
    )

    table.add_column(
        "Commitment",
        ratio=3,
        no_wrap=True,
    )
    table.add_column(
        "Completion",
        ratio=2,
    )
    table.add_column(
        "Rate",
        justify="right",
        width=10,
    )
    table.add_column(
        "Streak",
        justify="right",
        width=10,
    )

    for task in task_stats:
        name = getattr(
            task,
            "task_name",
            getattr(task, "name", "Unknown"),
        )

        completion_rate = getattr(
            task,
            "completion_rate",
            getattr(task, "completion_percentage", 0.0),
        )

        current_streak = getattr(
            task,
            "current_streak",
            getattr(task, "streak", 0),
        )

        percentage = max(
            0.0,
            min(100.0, float(completion_rate)),
        )

        progress_bar = make_progress_bar(
            percentage,
            width=18,
        )

        table.add_row(
            Text(
                name,
                style="bold",
            ),
            Text(
                progress_bar,
                style="cyan",
            ),
            format_percentage(percentage),
            (
                Text(
                    f"{current_streak}d",
                    style="bold yellow",
                )
                if current_streak > 0
                else Text("—", style="dim")
            ),
        )

    return table


def _build_journey_table(
    data: DashboardData,
) -> Table | None:
    """Build the active journey progress table."""
    journeys = data.active_journeys

    if not journeys:
        return None

    table = Table(
        show_header=True,
        header_style="bold cyan",
        border_style="dim",
        box=None,
        expand=True,
        padding=(0, 1),
    )

    table.add_column(
        "Journey",
        ratio=3,
        no_wrap=True,
    )
    table.add_column(
        "Progress",
        ratio=3,
    )
    table.add_column(
        "Completion",
        justify="right",
        width=12,
    )
    table.add_column(
        "Streak",
        justify="right",
        width=10,
    )
    table.add_column(
        "Today",
        justify="center",
        width=8,
    )

    for journey in journeys:
        summary = data.journey_progress.get(journey.id)

        if summary is None:
            continue

        streak = data.journey_streaks.get(journey.id)
        has_activity_today = journey.id in data.today_activity

        percentage = max(
            0.0,
            min(100.0, summary.percentage),
        )

        progress_bar = make_progress_bar(
            percentage,
            width=18,
        )

        journey_text = Text()
        journey_text.append(
            journey.name,
            style="bold",
        )
        journey_text.append(
            f"\n{_tracking_method_label(journey.tracking_method)}",
            style="dim",
        )

        progress_text = Text()
        progress_text.append(
            progress_bar,
            style="cyan",
        )
        progress_text.append(
            f"\n{_progress_label(summary)}",
            style="dim",
        )

        if streak is None or streak.current_streak <= 0:
            streak_text = Text(
                "—",
                style="dim",
            )
        else:
            streak_text = Text(
                f"{streak.current_streak}d",
                style="bold yellow",
            )

        today_text = Text("●", style="green") if has_activity_today else Text("—", style="dim")

        table.add_row(
            journey_text,
            progress_text,
            format_percentage(percentage),
            streak_text,
            today_text,
        )

    return table


def _build_today_activity_table(
    data: DashboardData,
) -> Table | None:
    """Build the combined today's activity table."""
    today_activity = data.today_activity

    if not today_activity:
        return None

    journeys_by_id = {journey.id: journey for journey in data.active_journeys}

    table = Table(
        show_header=True,
        header_style="bold green",
        border_style="dim",
        box=None,
        expand=True,
        padding=(0, 1),
    )

    table.add_column(
        "Journey",
        ratio=3,
        no_wrap=True,
    )
    table.add_column(
        "Activity",
        ratio=2,
    )
    table.add_column(
        "Events",
        justify="right",
        width=8,
    )

    for journey_id, activity in today_activity.items():
        journey = journeys_by_id.get(journey_id)

        if journey is None:
            continue

        table.add_row(
            journey.name,
            _today_activity_detail(
                journey,
                activity,
            ),
            str(activity.event_count),
        )

    return table


def _build_empty_ledger_panel() -> Panel:
    """Build the empty LifeLedger state."""
    return Panel(
        "[dim]No active commitments.[/dim]\n\n"
        "Add one with "
        "[bold cyan]momentum ledger task add[/bold cyan].",
        title="[bold]Daily Commitments[/bold]",
        border_style="dim",
        padding=(1, 2),
    )


def _build_empty_stride_panel() -> Panel:
    """Build the empty Stride state."""
    return Panel(
        "[dim]No active journeys.[/dim]\n\n"
        "Create one with "
        "[bold cyan]momentum stride journey create[/bold cyan].",
        title="[bold]Long-Term Journeys[/bold]",
        border_style="dim",
        padding=(1, 2),
    )


@app.callback(invoke_without_command=True)
def dashboard(
    days: Annotated[
        int,
        typer.Option(
            "--days",
            min=1,
            max=365,
            show_default=True,
            help="Number of calendar days to analyze for commitment statistics.",
        ),
    ] = 30,
) -> None:
    """Show the combined Momentum dashboard."""
    try:
        with app_context(get_config()) as context:
            data = context.dashboard_service.get_dashboard(
                days=days,
            )

        _render_dashboard(data)

    except Exception as exc:
        handle_error(exc)


def _render_dashboard(data: DashboardData) -> None:
    """Render the complete Momentum dashboard."""
    overall = data.ledger_stats

    render_header(
        console,
        "Momentum Dashboard",
        subtitle="Daily commitments + long-term journeys",
    )

    console.print()

    # Overall Momentum summary.
    console.print(
        _build_summary_panel(data),
    )

    console.print()

    # LifeLedger.
    console.print("[bold]DAILY COMMITMENTS[/bold]")
    console.print("[dim]Consistency across your recurring commitments[/dim]")
    console.print()

    commitment_table = _build_commitment_table(overall)

    if commitment_table is None:
        console.print(
            _build_empty_ledger_panel(),
        )
    else:
        console.print(commitment_table)

    console.print()

    # Stride.
    console.print("[bold]LONG-TERM JOURNEYS[/bold]")
    console.print("[dim]Progress toward the things you are building[/dim]")
    console.print()

    journey_table = _build_journey_table(data)

    if journey_table is None:
        console.print(
            _build_empty_stride_panel(),
        )
    else:
        console.print(journey_table)

    console.print()

    # Today's activity.
    console.print("[bold]TODAY'S ACTIVITY[/bold]")
    console.print()

    today_table = _build_today_activity_table(data)

    if today_table is None:
        console.print(
            Panel(
                "[dim]Nothing logged today.[/dim]",
                border_style="dim",
                padding=(0, 1),
            )
        )
    else:
        console.print(today_table)

    console.print()

    # Footer.
    console.print(
        Panel(
            Align.center(
                Group(
                    Text(
                        "Momentum is built one commitment and one progress event at a time.",
                        style="dim",
                    ),
                    Text(
                        f"{data.as_of:%d %b %Y}",
                        style="dim",
                    ),
                )
            ),
            border_style="dim",
            padding=(0, 1),
        )
    )

"""Journey CLI commands."""

from __future__ import annotations

from datetime import date
from typing import Annotated

import typer
from rich.prompt import Confirm, Prompt

from momentum.app.context import app_context
from momentum.config import get_config
from momentum.stride.cli.common import (
    console,
    handle_error,
    parse_date,
    parse_tracking_method,
)
from momentum.stride.domain.enums import JourneyStatus, TrackingMethod
from momentum.stride.domain.errors import StrideError
from momentum.stride.presentation.tables import (
    render_journey_table,
    render_milestone_table,
    render_stats,
)

app = typer.Typer(
    help="Create, inspect, and manage journeys.",
    no_args_is_help=True,
)


def _pick_tracking_method() -> TrackingMethod:
    """Interactively select a tracking method."""
    console.print()
    console.print("[bold cyan]Tracking method[/bold cyan]")
    console.print()
    console.print("  [bold]1[/bold]  Milestone  [dim]checkpoints or stages[/dim]")
    console.print("  [bold]2[/bold]  Count      [dim]one completion at a time[/dim]")
    console.print("  [bold]3[/bold]  Quantity   [dim]numeric amounts[/dim]")
    console.print("  [bold]4[/bold]  Duration   [dim]time spent[/dim]")
    console.print()

    choice = Prompt.ask(
        "Choose",
        choices=["1", "2", "3", "4"],
    )

    return {
        "1": TrackingMethod.MILESTONE,
        "2": TrackingMethod.COUNT,
        "3": TrackingMethod.QUANTITY,
        "4": TrackingMethod.DURATION,
    }[choice]


@app.command("create")
def create_journey(
    name: Annotated[
        str | None,
        typer.Argument(help="Journey name"),
    ] = None,
    description: Annotated[
        str | None,
        typer.Option("--description", "-d"),
    ] = None,
    method: Annotated[
        str | None,
        typer.Option(
            "--method",
            "-m",
            help="milestone/count/quantity/duration",
        ),
    ] = None,
    target: Annotated[
        float | None,
        typer.Option("--target", "-t"),
    ] = None,
    unit: Annotated[
        str | None,
        typer.Option("--unit", "-u"),
    ] = None,
    start: Annotated[
        str | None,
        typer.Option("--start", help="Start date (YYYY-MM-DD)"),
    ] = None,
    target_date: Annotated[
        str | None,
        typer.Option(
            "--target-date",
            help="Target date (YYYY-MM-DD), or 'none'",
        ),
    ] = None,
    milestones: Annotated[
        str | None,
        typer.Option(
            "--milestones",
            help="Comma-separated milestone names",
        ),
    ] = None,
    no_prompt: Annotated[
        bool,
        typer.Option(
            "--no-prompt",
            help="Disable interactive prompts.",
        ),
    ] = False,
) -> None:
    """Create a new journey."""
    try:
        if name is None:
            if no_prompt:
                raise typer.BadParameter("--name is required when using --no-prompt.")
            name = Prompt.ask("[bold]Journey name[/bold]")

        if description is None:
            description = (
                ""
                if no_prompt
                else Prompt.ask(
                    "Description",
                    default="",
                )
            )

        if method is None:
            if no_prompt:
                raise typer.BadParameter("--method is required when using --no-prompt.")
            tracking_method = _pick_tracking_method()
        else:
            tracking_method = parse_tracking_method(method)

        if target is None:
            if no_prompt:
                raise typer.BadParameter("--target is required when using --no-prompt.")

            if tracking_method == TrackingMethod.DURATION:
                target = float(
                    Prompt.ask(
                        "Target hours",
                        default="100",
                    )
                )
            elif tracking_method == TrackingMethod.MILESTONE:
                target = float(
                    Prompt.ask(
                        "Number of milestones",
                        default="10",
                    )
                )
            else:
                target = float(Prompt.ask("Target value"))

        if unit is None:
            if tracking_method == TrackingMethod.DURATION:
                unit = "hours"
            elif tracking_method == TrackingMethod.COUNT:
                unit = (
                    ""
                    if no_prompt
                    else Prompt.ask(
                        "Unit label",
                        default="",
                    )
                )
            elif tracking_method == TrackingMethod.QUANTITY:
                unit = "" if no_prompt else Prompt.ask("Unit")
            else:
                unit = ""

        start_date: date | None = parse_date(start, option_name="start") if start else None

        parsed_target_date: date | None = None

        if target_date:
            if target_date.lower() != "none":
                parsed_target_date = parse_date(
                    target_date,
                    option_name="target-date",
                )
        elif not no_prompt:
            target_date_input = Prompt.ask(
                "Target date (YYYY-MM-DD, or blank to skip)",
                default="",
            )

            if target_date_input.strip():
                parsed_target_date = parse_date(
                    target_date_input,
                    option_name="target-date",
                )

        milestone_names: list[str] | None = None

        if tracking_method == TrackingMethod.MILESTONE:
            if milestones:
                milestone_names = [item.strip() for item in milestones.split(",") if item.strip()]
            elif not no_prompt and Confirm.ask(
                "Add milestones now?",
                default=True,
            ):
                milestone_names = []

                console.print(
                    "[dim]Enter milestone names. Press Enter on an empty line to finish.[/dim]"
                )

                while True:
                    milestone_name = Prompt.ask(
                        f"  Milestone {len(milestone_names) + 1}",
                        default="",
                    )

                    if not milestone_name.strip():
                        break

                    milestone_names.append(milestone_name.strip())

        with app_context(get_config()) as context:
            journey = context.stride_journey_service.create_journey(
                name=name,
                description=description,
                tracking_method=tracking_method,
                target_value=target,
                unit=unit,
                start_date=start_date,
                target_date=parsed_target_date,
                milestone_names=milestone_names,
            )

        console.print()
        console.print(
            f"[bold green]✓[/bold green] "
            f"Created journey [bold]{journey.name}[/bold]"
            f" [dim](ID {journey.id})[/dim]"
        )

        if milestone_names:
            console.print(f"  [dim]Added {len(milestone_names)} milestone(s).[/dim]")

    except StrideError as exc:
        handle_error(exc)


@app.command("list")
def list_journeys(
    status: Annotated[
        str | None,
        typer.Option(
            "--status",
            "-s",
            help="active/paused/completed/archived",
        ),
    ] = None,
) -> None:
    """List journeys."""
    try:
        parsed_status: JourneyStatus | None = None

        if status:
            try:
                parsed_status = JourneyStatus(status.lower())
            except ValueError as exc:
                raise typer.BadParameter(
                    "Expected active, paused, completed, or archived.",
                    param_hint="--status",
                ) from exc

        with app_context(get_config()) as context:
            journeys = context.stride_journey_service.list_journeys(
                status=parsed_status,
            )

        if not journeys:
            console.print(
                "[dim]No journeys found. Create one with "
                "[bold]momentum stride journey create[/bold].[/dim]"
            )
            return

        render_journey_table(
            journeys,
            console=console,
        )

    except StrideError as exc:
        handle_error(exc)


@app.command("show")
def show_journey(
    journey: Annotated[
        str,
        typer.Argument(help="Journey name or ID"),
    ],
) -> None:
    """Show journey details, statistics, and milestones."""
    try:
        with app_context(get_config()) as context:
            current = context.stride_journey_service.get_journey(journey)

            milestones = context.stride_journey_service.get_milestones(
                current,
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
            )

        render_stats(
            progress,
            stats,
            streak,
            pace,
        )

        if milestones:
            console.print()
            render_milestone_table(
                milestones,
                console=console,
            )

    except StrideError as exc:
        handle_error(exc)


@app.command("edit")
def edit_journey(
    journey: Annotated[
        str,
        typer.Argument(help="Journey name or ID"),
    ],
    name: Annotated[
        str | None,
        typer.Option("--name", "-n"),
    ] = None,
    description: Annotated[
        str | None,
        typer.Option("--description", "-d"),
    ] = None,
    target: Annotated[
        float | None,
        typer.Option("--target", "-t"),
    ] = None,
    unit: Annotated[
        str | None,
        typer.Option("--unit", "-u"),
    ] = None,
    target_date: Annotated[
        str | None,
        typer.Option("--target-date"),
    ] = None,
    clear_target_date: Annotated[
        bool,
        typer.Option("--clear-target-date"),
    ] = False,
) -> None:
    """Edit journey metadata."""
    try:
        if target_date and clear_target_date:
            raise typer.BadParameter(
                "--target-date and --clear-target-date cannot be used together."
            )

        parsed_target_date = (
            parse_date(
                target_date,
                option_name="target-date",
            )
            if target_date
            else None
        )

        with app_context(get_config()) as context:
            updated = context.stride_journey_service.edit_journey(
                journey,
                new_name=name,
                description=description,
                target_value=target,
                unit=unit,
                target_date=parsed_target_date,
                clear_target_date=clear_target_date,
            )

        console.print(f"[bold green]✓[/bold green] Updated [bold]{updated.name}[/bold].")

    except StrideError as exc:
        handle_error(exc)


@app.command("pause")
def pause_journey(
    journey: Annotated[
        str,
        typer.Argument(help="Journey name or ID"),
    ],
) -> None:
    """Pause an active journey."""
    _lifecycle("pause", journey)


@app.command("resume")
def resume_journey(
    journey: Annotated[
        str,
        typer.Argument(help="Journey name or ID"),
    ],
) -> None:
    """Resume a paused journey."""
    _lifecycle("resume", journey)


@app.command("complete")
def complete_journey(
    journey: Annotated[
        str,
        typer.Argument(help="Journey name or ID"),
    ],
) -> None:
    """Mark a journey as completed."""
    _lifecycle("complete", journey)


@app.command("archive")
def archive_journey(
    journey: Annotated[
        str,
        typer.Argument(help="Journey name or ID"),
    ],
) -> None:
    """Archive a journey while preserving its history."""
    _lifecycle("archive", journey)


@app.command("reopen")
def reopen_journey(
    journey: Annotated[
        str,
        typer.Argument(help="Journey name or ID"),
    ],
) -> None:
    """Reopen a completed journey."""
    _lifecycle("reopen", journey)


def _lifecycle(action: str, journey: str) -> None:
    try:
        with app_context(get_config()) as context:
            operation = {
                "pause": context.stride_journey_service.pause,
                "resume": context.stride_journey_service.resume,
                "complete": context.stride_journey_service.complete,
                "archive": context.stride_journey_service.archive,
                "reopen": context.stride_journey_service.reopen,
            }[action]

            updated = operation(journey)

        console.print(
            f"[bold green]✓[/bold green] "
            f"[bold]{updated.name}[/bold] "
            f"is now [cyan]{updated.status.value}[/cyan]."
        )

    except StrideError as exc:
        handle_error(exc)

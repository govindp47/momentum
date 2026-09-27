"""Achievement CLI commands."""

from __future__ import annotations

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
from momentum.stride.presentation.tables import render_achievements

app = typer.Typer(
    help="View earned achievements.",
    no_args_is_help=True,
)


@app.command("show")
def show_achievements(
    journey: Annotated[
        str | None,
        typer.Argument(
            help="Optional journey name or ID.",
        ),
    ] = None,
) -> None:
    """Display earned achievements."""
    try:
        with app_context(get_config()) as context:
            current = None

            if journey:
                current = context.stride_journey_service.get_journey(
                    journey_reference(journey),
                )

            achievements = context.stride_achievement_service.get_achievements(
                current,
            )

        render_achievements(
            achievements,
            console=console,
        )

    except StrideError as exc:
        handle_error(exc)

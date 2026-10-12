"""Momentum CLI — unified root application entry point."""

from __future__ import annotations

import logging

import typer

from momentum import __version__
from momentum.dashboard import cli as dashboard
from momentum.ledger.cli import stats as ledger_stats
from momentum.ledger.cli import tasks as ledger_tasks
from momentum.ledger.cli import tracking as ledger_tracking
from momentum.ledger.domain.errors import LifeLedgerError
from momentum.shared.errors import render_error
from momentum.stride.cli import (
    achievements,
    export_cmd,
    journeys,
    milestones,
    progress,
)
from momentum.stride.cli import (
    stats as stride_stats,
)
from momentum.stride.domain.errors import StrideError

logger = logging.getLogger(__name__)

app = typer.Typer(
    name="momentum",
    help="Momentum — your local-first personal tracking system.",
    no_args_is_help=True,
    add_completion=True,
)

ledger_app = typer.Typer(
    name="ledger",
    help="Track daily commitments and consistency.",
    no_args_is_help=True,
)

stride_app = typer.Typer(
    name="stride",
    help="Manage journeys, milestones, and long-term progress.",
    no_args_is_help=True,
)


# ---------------------------------------------------------------------------
# LifeLedger
# ---------------------------------------------------------------------------

ledger_app.add_typer(
    ledger_tasks.app,
    name="task",
    help="Manage daily commitments.",
)

ledger_app.add_typer(
    ledger_tracking.app,
    name="tracking",
    help="Track daily commitment activity.",
)

ledger_app.add_typer(
    ledger_stats.app,
    name="stats",
    help="View commitment statistics.",
)


# ---------------------------------------------------------------------------
# Stride
# ---------------------------------------------------------------------------

stride_app.add_typer(
    journeys.app,
    name="journey",
    help="Manage journeys.",
)

stride_app.add_typer(
    milestones.app,
    name="milestone",
    help="Manage milestones.",
)

stride_app.add_typer(
    progress.app,
    name="progress",
    help="Log and review progress.",
)

stride_app.add_typer(
    stride_stats.app,
    name="stats",
    help="View journey statistics.",
)

stride_app.add_typer(
    achievements.app,
    name="achievements",
    help="View earned achievements.",
)

stride_app.add_typer(
    export_cmd.app,
    name="export",
    help="Export journey data.",
)


app.add_typer(
    ledger_app,
    name="ledger",
)

app.add_typer(
    stride_app,
    name="stride",
)

app.add_typer(
    dashboard.app,
    name="dashboard",
    help="View your combined Momentum dashboard.",
)


# ---------------------------------------------------------------------------
# Root commands
# ---------------------------------------------------------------------------


@app.callback()
def root(
    debug: bool = typer.Option(
        False,
        "--debug",
        hidden=True,
        help="Enable debug logging.",
    ),
) -> None:
    """Momentum — your local-first personal tracking system."""
    logging.basicConfig(
        level=logging.DEBUG if debug else logging.WARNING,
        format="%(levelname)s %(name)s: %(message)s",
    )


@app.command("version")
def version() -> None:
    """Show the Momentum version."""
    typer.echo(f"Momentum {__version__}")


def main() -> None:
    """Application entry point."""
    try:
        app()
    except typer.Exit:
        raise
    except (LifeLedgerError, StrideError) as exc:
        render_error(exc)
        raise SystemExit(1) from None
    except Exception:
        logger.exception(
            "Unhandled exception during CLI command",
            extra={"component": "cli", "operation": "cli_command"},
        )
        render_error(RuntimeError("An unexpected backend error occurred."))
        raise SystemExit(1) from None


if __name__ == "__main__":
    main()

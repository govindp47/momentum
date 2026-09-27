"""CLI — task management commands."""

from __future__ import annotations

import typer
from rich import box
from rich.console import Console
from rich.table import Table

from momentum.app.context import app_context
from momentum.config import get_config
from momentum.ledger.domain.errors import ArchivedTaskError

console = Console()

app = typer.Typer(
    name="task",
    help="Manage tasks (add, list, edit, remove, restore).",
    no_args_is_help=True,
)


@app.command("add")
def task_add() -> None:
    """Add a new task interactively."""
    console.print("\n[bold cyan]Add New Task[/bold cyan]")

    name = typer.prompt("  Task name").strip()
    cutoff = typer.prompt("  Minimum cutoff").strip()

    with app_context(get_config()) as context:
        task = context.ledger_task_service.create_task(
            name,
            cutoff,
        )

    console.print(
        f"\n[green]✓[/green] Task [bold]{task.name!r}[/bold] created.",
    )
    console.print(f"  Cutoff: {task.cutoff_message}")


@app.command("list")
def task_list(
    show_all: bool = typer.Option(
        False,
        "--all",
        help="Include archived tasks.",
    ),
) -> None:
    """List active tasks, or all tasks with --all."""
    with app_context(get_config()) as context:
        svc = context.ledger_task_service

        tasks = svc.list_all_tasks() if show_all else svc.list_active_tasks()

    if not tasks:
        console.print("[dim]No tasks found.[/dim]")
        return

    table = Table(
        box=box.SIMPLE_HEAVY,
        show_header=True,
        header_style="bold cyan",
    )
    table.add_column("ID", style="dim", width=5, justify="right")
    table.add_column("Name", min_width=20)
    table.add_column("Cutoff", min_width=35)
    table.add_column("Status", width=10)
    table.add_column("Created", width=12)

    for task in tasks:
        status = "[green]active[/green]" if task.is_active else "[dim]archived[/dim]"

        table.add_row(
            str(task.id),
            task.name,
            task.cutoff_message,
            status,
            task.created_at.strftime("%Y-%m-%d"),
        )

    console.print()
    console.print(table)

    active_count = sum(1 for task in tasks if task.is_active)
    archived_count = len(tasks) - active_count

    if show_all:
        console.print(
            f"[dim]{active_count} active, {archived_count} archived task(s)[/dim]\n",
        )
    else:
        console.print(
            f"[dim]{active_count} active task(s)[/dim]\n",
        )


@app.command("edit")
def task_edit(
    name: str = typer.Argument(...),
) -> None:
    """Edit an active task's name or cutoff message."""
    with app_context(get_config()) as context:
        svc = context.ledger_task_service

        task = svc.get_task(name)

        if not task.is_active:
            raise ArchivedTaskError(task.name)

        console.print(
            f"\n[bold cyan]Edit Task[/bold cyan]: {task.name}",
        )
        console.print(
            f"  Current cutoff: {task.cutoff_message}",
        )
        console.print(
            "[dim]  Press Enter to keep the current value.[/dim]\n",
        )

        new_name = typer.prompt(
            "  New name",
            default=task.name,
        ).strip()

        new_cutoff = typer.prompt(
            "  New cutoff",
            default=task.cutoff_message,
        ).strip()

        if new_name == task.name and new_cutoff == task.cutoff_message:
            console.print("[dim]No changes made.[/dim]")
            return

        if new_cutoff != task.cutoff_message:
            console.print(
                "\n[yellow]Note:[/yellow] Changing the cutoff changes "
                "the task definition going forward. Historical YES/NO "
                "records remain unchanged.",
            )

        updated = svc.edit_task(
            name,
            new_name,
            new_cutoff,
        )

    console.print("\n[green]✓[/green] Task updated.")
    console.print(f"  Name:   {updated.name}")
    console.print(f"  Cutoff: {updated.cutoff_message}\n")


@app.command("remove")
def task_remove(
    name: str = typer.Argument(...),
) -> None:
    """Archive a task while preserving historical data."""
    with app_context(get_config()) as context:
        task = context.ledger_task_service.archive_task(name)

    console.print(
        f"\n[yellow]✓[/yellow] Task [bold]{task.name!r}[/bold] archived.",
    )
    console.print(
        "  Historical records are preserved and remain queryable.",
    )
    console.print(
        f"  To restore: momentum ledger task restore {task.id}\n",
    )


@app.command("restore")
def task_restore(
    task_id: int = typer.Argument(..., min=1),
) -> None:
    """Restore an archived task by its stable task ID."""
    with app_context(get_config()) as context:
        task = context.ledger_task_service.restore_task_by_id(task_id)

    console.print(
        f"\n[green]✓[/green] Task [bold]{task.name!r}[/bold] restored.",
    )
    console.print("  Historical records are intact.\n")

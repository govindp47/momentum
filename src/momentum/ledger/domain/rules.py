"""Pure LifeLedger domain rules and calculations.

This module contains business rules that do not require repositories,
frameworks, or application services.
"""

from __future__ import annotations

from collections.abc import Sequence
from datetime import date, timedelta

from momentum.ledger.domain.errors import InvalidDateError, InvalidTaskError
from momentum.ledger.domain.models import DailyEntry, Task

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

TREND_FLAT_THRESHOLD = 0.05
TREND_MIN_RECORDED = 3

MAX_NAME_LENGTH = 200
MAX_CUTOFF_LENGTH = 500


# ---------------------------------------------------------------------------
# Streak calculations
# ---------------------------------------------------------------------------


def compute_streaks(
    entries: Sequence[DailyEntry],
    reference_date: date,
) -> tuple[int, int]:
    """Return current and longest completed-day streaks.

    Rules:

    - YES contributes to a streak.
    - NO breaks a streak.
    - NOT RECORDED breaks a streak.
    - Current streak only exists if the reference date is explicitly YES.
    - The longest streak is calculated across all recorded history.
    """
    if not entries:
        return 0, 0

    lookup = {entry.date: entry.completed for entry in entries}

    longest = 0
    run = 0
    previous_date: date | None = None

    for entry_date in sorted(lookup):
        completed = lookup[entry_date]

        if not completed:
            run = 0
            previous_date = entry_date
            continue

        if previous_date is not None and (entry_date - previous_date).days == 1:
            run += 1
        else:
            run = 1

        longest = max(longest, run)
        previous_date = entry_date

    current = 0
    cursor = reference_date

    while lookup.get(cursor) is True:
        current += 1
        cursor -= timedelta(days=1)

    return current, longest


# ---------------------------------------------------------------------------
# Period calculations
# ---------------------------------------------------------------------------


def effective_period(
    task: Task,
    start_date: date,
    end_date: date,
) -> tuple[date, date]:
    """Restrict a requested period to the task's lifecycle."""
    if start_date > end_date:
        raise InvalidDateError("Statistics start date cannot be after end date.")

    effective_start = max(
        start_date,
        task.created_date,
    )

    effective_end = end_date

    if task.archived_date is not None:
        effective_end = min(
            effective_end,
            task.archived_date,
        )

    return effective_start, effective_end


def streak_reference_date(
    task: Task,
    requested_end: date,
) -> date:
    """Return the latest date on which the task could have an active streak."""
    if task.archived_date is None:
        return requested_end

    return min(
        requested_end,
        task.archived_date,
    )


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------


def validate_task_fields(
    name: str,
    cutoff_message: str,
) -> None:
    """Validate user-provided task fields."""
    if not name:
        raise InvalidTaskError("Task name cannot be empty.")

    if len(name) > MAX_NAME_LENGTH:
        raise InvalidTaskError(f"Task name must be at most {MAX_NAME_LENGTH} characters.")

    if not cutoff_message:
        raise InvalidTaskError("Cutoff message cannot be empty.")

    if len(cutoff_message) > MAX_CUTOFF_LENGTH:
        raise InvalidTaskError(f"Cutoff message must be at most {MAX_CUTOFF_LENGTH} characters.")


def validate_days(days: int) -> None:
    """Validate a statistics window."""
    if days <= 0:
        raise InvalidDateError("Statistics period must contain at least one day.")


def validate_date_range(
    from_date: date,
    to_date: date,
) -> None:
    """Validate an inclusive date range."""
    if from_date > to_date:
        raise InvalidDateError("Start date cannot be after end date.")

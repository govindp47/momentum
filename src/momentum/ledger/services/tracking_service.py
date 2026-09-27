"""Application operations for LifeLedger daily tracking."""

from __future__ import annotations

import logging
from datetime import date

from momentum.ledger.domain.errors import (
    ArchivedTaskError,
    InvalidTaskError,
    TaskNotFoundError,
)
from momentum.ledger.domain.models import DailyEntry, Task
from momentum.ledger.domain.rules import validate_date_range
from momentum.ledger.repositories.entry_repository import EntryRepository
from momentum.ledger.repositories.task_repository import TaskRepository

logger = logging.getLogger(__name__)


class TrackingService:
    """Application operations for daily tracking."""

    def __init__(
        self,
        task_repo: TaskRepository,
        entry_repo: EntryRepository,
    ) -> None:
        self._tasks = task_repo
        self._entries = entry_repo

    def record_entry(
        self,
        task_name: str,
        entry_date: date,
        completed: bool,
    ) -> DailyEntry:
        """Record or update a daily entry for an active task."""
        task = self._require_active_task(task_name)

        entry = self._entries.upsert(
            task.id,
            entry_date,
            completed,
        )

        logger.debug(
            "Recorded daily entry for task id=%d on %s",
            task.id,
            entry_date,
        )

        return entry

    def record_entry_by_id(
        self,
        task_id: int,
        entry_date: date,
        completed: bool,
    ) -> DailyEntry:
        """Record or update a daily entry using a task ID."""
        task = self._tasks.get_by_id(task_id)

        if task is None:
            raise TaskNotFoundError(str(task_id))

        if not task.is_active:
            raise ArchivedTaskError(task.name)

        return self._entries.upsert(
            task.id,
            entry_date,
            completed,
        )

    def get_day_entries(
        self,
        entry_date: date,
    ) -> list[tuple[Task, DailyEntry | None]]:
        """Return every active task paired with its entry for a date."""
        result: list[tuple[Task, DailyEntry | None]] = []

        for task in self._tasks.list_active():
            entry = self._entries.get(task.id, entry_date)
            result.append((task, entry))

        return result

    def get_history(
        self,
        task_name: str | None = None,
        from_date: date | None = None,
        to_date: date | None = None,
    ) -> list[tuple[Task, DailyEntry]]:
        """Return historical entries with optional task/date filtering."""
        if from_date is not None and to_date is not None:
            validate_date_range(from_date, to_date)

        if task_name is not None:
            task = self._require_task(task_name)
            tasks = [task]
        else:
            tasks = self._tasks.list_all()

        result: list[tuple[Task, DailyEntry]] = []

        for task in tasks:
            entries = self._entries.list_for_task(
                task.id,
                from_date,
                to_date,
            )

            result.extend((task, entry) for entry in entries)

        result.sort(
            key=lambda item: (
                item[1].date,
                item[0].name.casefold(),
            ),
            reverse=True,
        )

        return result

    def _require_task(self, name: str) -> Task:
        normalized_name = name.strip()

        if not normalized_name:
            raise InvalidTaskError("Task name cannot be empty.")

        task = self._tasks.get_by_name(normalized_name)

        if task is None:
            raise TaskNotFoundError(normalized_name)

        return task

    def _require_active_task(self, name: str) -> Task:
        task = self._require_task(name)

        if not task.is_active:
            raise ArchivedTaskError(task.name)

        return task

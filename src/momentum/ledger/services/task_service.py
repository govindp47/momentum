"""Application operations for LifeLedger task lifecycle management."""

from __future__ import annotations

import logging
import sqlite3

from momentum.ledger.domain.errors import (
    ArchivedTaskError,
    InvalidTaskError,
    NotArchivedError,
    TaskAlreadyExistsError,
    TaskNotFoundError,
)
from momentum.ledger.domain.models import Task
from momentum.ledger.domain.rules import validate_task_fields
from momentum.ledger.repositories.task_repository import TaskRepository

logger = logging.getLogger(__name__)


class TaskService:
    """Application operations for task lifecycle management."""

    def __init__(self, task_repo: TaskRepository) -> None:
        self._tasks = task_repo

    def create_task(self, name: str, cutoff_message: str) -> Task:
        """Create a new active task."""
        name = name.strip()
        cutoff_message = cutoff_message.strip()

        validate_task_fields(name, cutoff_message)

        # Only an active task blocks creation of the same name.
        existing = self._tasks.get_by_name(name)

        if existing is not None and existing.is_active:
            raise TaskAlreadyExistsError(name)

        try:
            task = self._tasks.create(name, cutoff_message)
        except sqlite3.IntegrityError as exc:
            raise TaskAlreadyExistsError(name) from exc

        logger.info("Created task id=%d", task.id)
        return task

    def edit_task(
        self,
        name: str,
        new_name: str | None = None,
        new_cutoff: str | None = None,
    ) -> Task:
        """Edit an active task."""
        task = self._require_task(name)

        if not task.is_active:
            raise ArchivedTaskError(task.name)

        updated_name = new_name.strip() if new_name is not None else task.name
        updated_cutoff = new_cutoff.strip() if new_cutoff is not None else task.cutoff_message

        validate_task_fields(updated_name, updated_cutoff)

        if updated_name.casefold() != task.name.casefold():
            existing = self._tasks.get_by_name(updated_name)

            if existing is not None and existing.id != task.id and existing.is_active:
                raise TaskAlreadyExistsError(updated_name)

            # An archived task with the same name does not block the rename because the
            # database allows multiple archived historical task definitions. The partial
            # unique index only protects active tasks.

        try:
            updated_task = self._tasks.update(
                task.id,
                updated_name,
                updated_cutoff,
            )
        except sqlite3.IntegrityError as exc:
            raise TaskAlreadyExistsError(updated_name) from exc

        logger.info("Edited task id=%d", task.id)
        return updated_task

    def archive_task(self, name: str) -> Task:
        """Archive an active task without deleting its history."""
        task = self._require_task(name)

        if not task.is_active:
            raise ArchivedTaskError(task.name)

        archived_task = self._tasks.archive(task.id)

        logger.info("Archived task id=%d", task.id)
        return archived_task

    def restore_task(self, name: str) -> Task:
        """Restore an archived task.

        Restoration fails if another active task already uses the same name.
        """
        task = self._require_task(name)

        if task.is_active:
            raise NotArchivedError(task.name)

        active_task = self._tasks.get_by_name(task.name)

        if active_task is not None and active_task.is_active and active_task.id != task.id:
            raise TaskAlreadyExistsError(task.name)

        try:
            restored_task = self._tasks.restore(task.id)
        except sqlite3.IntegrityError as exc:
            raise TaskAlreadyExistsError(task.name) from exc

        logger.info("Restored task id=%d", task.id)
        return restored_task

    def restore_task_by_id(self, task_id: int) -> Task:
        task = self._tasks.get_by_id(task_id)

        if task is None:
            raise TaskNotFoundError(str(task_id))

        if task.is_active:
            raise NotArchivedError(task.name)

        existing = self._tasks.get_by_name(task.name)

        if existing is not None and existing.is_active and existing.id != task.id:
            raise TaskAlreadyExistsError(task.name)

        try:
            restored_task = self._tasks.restore(task.id)
        except sqlite3.IntegrityError as exc:
            raise TaskAlreadyExistsError(task.name) from exc

        logger.info("Restored task id=%d", task.id)
        return restored_task

    def list_active_tasks(self) -> list[Task]:
        """Return all active tasks."""
        return self._tasks.list_active()

    def list_all_tasks(self) -> list[Task]:
        """Return all tasks, including archived tasks."""
        return self._tasks.list_all()

    def get_task(self, name: str) -> Task:
        """Return a task by exact case-insensitive name."""
        return self._require_task(name)

    def _require_task(self, name: str) -> Task:
        normalized_name = name.strip()

        if not normalized_name:
            raise InvalidTaskError("Task name cannot be empty.")

        task = self._tasks.get_by_name(normalized_name)

        if task is None:
            raise TaskNotFoundError(normalized_name)

        return task

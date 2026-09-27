"""Domain errors for the LifeLedger bounded context."""

from __future__ import annotations


class LifeLedgerError(Exception):
    """Base exception for LifeLedger domain/application errors."""


class TaskNotFoundError(LifeLedgerError):
    """Raised when a requested task does not exist."""

    def __init__(self, name: str) -> None:
        super().__init__(f"Task not found: {name!r}")
        self.name = name


class TaskAlreadyExistsError(LifeLedgerError):
    """Raised when an active task with the same name already exists."""

    def __init__(self, name: str) -> None:
        super().__init__(f"A task named {name!r} already exists.")
        self.name = name


class ArchivedTaskError(LifeLedgerError):
    """Raised when an operation requires an active task."""

    def __init__(self, name: str) -> None:
        super().__init__(f"Task {name!r} is archived. Restore it first.")
        self.name = name


class NotArchivedError(LifeLedgerError):
    """Raised when restoring a task that is already active."""

    def __init__(self, name: str) -> None:
        super().__init__(f"Task {name!r} is not archived.")
        self.name = name


class InvalidTaskError(LifeLedgerError):
    """Raised when task data violates a domain rule."""


class InvalidDateError(LifeLedgerError):
    """Raised when a supplied date is invalid."""

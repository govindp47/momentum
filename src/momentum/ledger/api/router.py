"""HTTP API routes for the LifeLedger bounded context."""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status

from momentum.api.dependencies import (
    get_ledger_stats_service,
    get_ledger_task_service,
    get_ledger_tracking_service,
)
from momentum.ledger.api.schemas import (
    DailyEntryRecordRequest,
    DailyEntryResponse,
    DayEntryResponse,
    ErrorResponse,
    HistoryEntryResponse,
    OverallStatsResponse,
    TaskCreateRequest,
    TaskResponse,
    TaskStatsResponse,
    TaskUpdateRequest,
    daily_entry_response,
    overall_stats_response,
    task_response,
    task_stats_response,
)
from momentum.ledger.domain.errors import (
    ArchivedTaskError,
    InvalidDateError,
    InvalidTaskError,
    LifeLedgerError,
    NotArchivedError,
    TaskAlreadyExistsError,
    TaskNotFoundError,
)
from momentum.ledger.services.stats_service import StatsService
from momentum.ledger.services.task_service import TaskService
from momentum.ledger.services.tracking_service import TrackingService

router = APIRouter(
    prefix="/ledger",
    tags=["LifeLedger"],
)


# ---------------------------------------------------------------------------
# Error mapping
# ---------------------------------------------------------------------------


def _raise_http_error(error: LifeLedgerError) -> None:
    """Translate a LifeLedger domain error into an HTTP error."""
    if isinstance(error, TaskNotFoundError):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        ) from error

    if isinstance(error, TaskAlreadyExistsError):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(error),
        ) from error

    if isinstance(error, (ArchivedTaskError, NotArchivedError)):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(error),
        ) from error

    if isinstance(error, (InvalidTaskError, InvalidDateError)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error),
        ) from error

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=str(error),
    ) from error


# ---------------------------------------------------------------------------
# Tasks
# ---------------------------------------------------------------------------


@router.get(
    "/tasks",
    response_model=list[TaskResponse],
    summary="List tasks",
)
def list_tasks(
    include_archived: bool = Query(
        False,
        description="Include archived tasks.",
    ),
    service: TaskService = Depends(get_ledger_task_service),
) -> list[TaskResponse]:
    """Return active tasks or all tasks when requested."""
    tasks = service.list_all_tasks() if include_archived else service.list_active_tasks()

    return [task_response(task) for task in tasks]


@router.post(
    "/tasks",
    response_model=TaskResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a task",
    responses={
        409: {"model": ErrorResponse},
        400: {"model": ErrorResponse},
    },
)
def create_task(
    request: TaskCreateRequest,
    service: TaskService = Depends(get_ledger_task_service),
) -> TaskResponse:
    """Create a new active task."""
    try:
        task = service.create_task(
            request.name,
            request.cutoff_message,
        )
    except LifeLedgerError as exc:
        _raise_http_error(exc)

    return task_response(task)


@router.get(
    "/tasks/{task_name}",
    response_model=TaskResponse,
    summary="Get a task",
    responses={
        404: {"model": ErrorResponse},
        400: {"model": ErrorResponse},
    },
)
def get_task(
    task_name: str,
    service: TaskService = Depends(get_ledger_task_service),
) -> TaskResponse:
    """Return a task by exact case-insensitive name."""
    try:
        task = service.get_task(task_name)
    except LifeLedgerError as exc:
        _raise_http_error(exc)

    return task_response(task)


@router.patch(
    "/tasks/{task_name}",
    response_model=TaskResponse,
    summary="Edit a task",
    responses={
        404: {"model": ErrorResponse},
        409: {"model": ErrorResponse},
        400: {"model": ErrorResponse},
    },
)
def update_task(
    task_name: str,
    request: TaskUpdateRequest,
    service: TaskService = Depends(get_ledger_task_service),
) -> TaskResponse:
    """Edit an active task."""
    if request.name is None and request.cutoff_message is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one task field must be provided.",
        )

    try:
        task = service.edit_task(
            task_name,
            request.name,
            request.cutoff_message,
        )
    except LifeLedgerError as exc:
        _raise_http_error(exc)

    return task_response(task)


@router.post(
    "/tasks/{task_name}/archive",
    response_model=TaskResponse,
    summary="Archive a task",
    responses={
        404: {"model": ErrorResponse},
        409: {"model": ErrorResponse},
        400: {"model": ErrorResponse},
    },
)
def archive_task(
    task_name: str,
    service: TaskService = Depends(get_ledger_task_service),
) -> TaskResponse:
    """Archive a task while preserving its historical records."""
    try:
        task = service.archive_task(task_name)
    except LifeLedgerError as exc:
        _raise_http_error(exc)

    return task_response(task)


@router.post(
    "/tasks/{task_id}/restore",
    response_model=TaskResponse,
    summary="Restore a task",
    responses={
        404: {"model": ErrorResponse},
        409: {"model": ErrorResponse},
    },
)
def restore_task(
    task_id: int,
    service: TaskService = Depends(get_ledger_task_service),
) -> TaskResponse:
    """Restore an archived task by its stable ID."""
    if task_id <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Task ID must be positive.",
        )

    try:
        task = service.restore_task_by_id(task_id)
    except LifeLedgerError as exc:
        _raise_http_error(exc)

    return task_response(task)


# ---------------------------------------------------------------------------
# Tracking
# ---------------------------------------------------------------------------


@router.post(
    "/entries",
    response_model=DailyEntryResponse,
    status_code=status.HTTP_200_OK,
    summary="Record a daily entry",
    responses={
        404: {"model": ErrorResponse},
        409: {"model": ErrorResponse},
    },
)
def record_entry(
    request: DailyEntryRecordRequest,
    service: TrackingService = Depends(get_ledger_tracking_service),
) -> DailyEntryResponse:
    """Record or update a YES/NO decision for a task and date."""
    try:
        entry = service.record_entry_by_id(
            request.task_id,
            request.date,
            request.completed,
        )
    except LifeLedgerError as exc:
        _raise_http_error(exc)

    return daily_entry_response(entry)


@router.get(
    "/entries",
    response_model=list[DayEntryResponse],
    summary="Get entries for a day",
)
def get_day_entries(
    entry_date: date = Query(
        ...,
        alias="date",
        description="Calendar date in YYYY-MM-DD format.",
    ),
    service: TrackingService = Depends(get_ledger_tracking_service),
) -> list[DayEntryResponse]:
    """Return all active tasks and their entry for a date."""
    pairs = service.get_day_entries(entry_date)

    return [
        DayEntryResponse(
            task=task_response(task),
            entry=daily_entry_response(entry) if entry is not None else None,
        )
        for task, entry in pairs
    ]


@router.get(
    "/history",
    response_model=list[HistoryEntryResponse],
    summary="Get tracking history",
    responses={
        404: {"model": ErrorResponse},
        400: {"model": ErrorResponse},
    },
)
def get_history(
    task_name: str | None = Query(
        None,
        description="Optional case-insensitive task name.",
    ),
    from_date: date | None = Query(
        None,
        alias="from",
        description="Inclusive start date.",
    ),
    to_date: date | None = Query(
        None,
        alias="to",
        description="Inclusive end date.",
    ),
    service: TrackingService = Depends(get_ledger_tracking_service),
) -> list[HistoryEntryResponse]:
    """Return historical YES/NO entries."""
    try:
        history = service.get_history(
            task_name=task_name,
            from_date=from_date,
            to_date=to_date,
        )
    except LifeLedgerError as exc:
        _raise_http_error(exc)

    return [
        HistoryEntryResponse(
            task=task_response(task),
            entry=daily_entry_response(entry),
        )
        for task, entry in history
    ]


# ---------------------------------------------------------------------------
# Statistics
# ---------------------------------------------------------------------------


@router.get(
    "/stats",
    response_model=OverallStatsResponse,
    summary="Get overall statistics",
)
def get_overall_stats(
    days: int = Query(
        30,
        ge=1,
        description="Number of calendar days to analyze.",
    ),
    reference_date: date | None = Query(
        None,
        description="Optional end date for the statistics period.",
    ),
    service: StatsService = Depends(get_ledger_stats_service),
) -> OverallStatsResponse:
    """Return aggregate statistics across eligible tasks."""
    try:
        stats = service.compute_overall_stats(
            days=days,
            reference_date=reference_date,
        )
    except LifeLedgerError as exc:
        _raise_http_error(exc)

    return overall_stats_response(stats)


@router.get(
    "/stats/tasks/{task_name}",
    response_model=TaskStatsResponse,
    summary="Get task statistics",
    responses={
        404: {"model": ErrorResponse},
        400: {"model": ErrorResponse},
    },
)
def get_task_stats(
    task_name: str,
    days: int = Query(
        30,
        ge=1,
        description="Number of calendar days to analyze.",
    ),
    reference_date: date | None = Query(
        None,
        description="Optional end date for the statistics period.",
    ),
    service: StatsService = Depends(get_ledger_stats_service),
) -> TaskStatsResponse:
    """Return statistics for one task."""
    try:
        stats = service.compute_task_stats_by_name(
            task_name=task_name,
            days=days,
            reference_date=reference_date,
        )
    except LifeLedgerError as exc:
        _raise_http_error(exc)

    return task_stats_response(stats)

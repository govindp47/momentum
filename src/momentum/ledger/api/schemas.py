"""Pydantic schemas for the LifeLedger HTTP API."""

from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from momentum.ledger.domain.models import (
    DailyEntry,
    OverallStats,
    Task,
    TaskStats,
    Trend,
)


class TaskCreateRequest(BaseModel):
    """Request body for creating a task."""

    name: str = Field(min_length=1, max_length=200)
    cutoff_message: str = Field(min_length=1, max_length=500)


class TaskUpdateRequest(BaseModel):
    """Request body for editing a task."""

    name: str | None = Field(default=None, min_length=1, max_length=200)
    cutoff_message: str | None = Field(default=None, min_length=1, max_length=500)


class TaskResponse(BaseModel):
    """Serialized task."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    cutoff_message: str
    created_at: datetime
    archived_at: datetime | None
    is_active: bool


class DailyEntryResponse(BaseModel):
    """Serialized daily tracking entry."""

    model_config = ConfigDict(from_attributes=True)

    task_id: int
    date: date
    completed: bool
    created_at: datetime
    updated_at: datetime


class DailyEntryRecordRequest(BaseModel):
    """Request body for recording a daily task entry."""

    task_id: int = Field(gt=0)
    date: date
    completed: bool


class DayEntryResponse(BaseModel):
    """Task and optional entry for a calendar date."""

    task: TaskResponse
    entry: DailyEntryResponse | None


class HistoryEntryResponse(BaseModel):
    """Historical entry together with its task."""

    task: TaskResponse
    entry: DailyEntryResponse


class TaskStatsResponse(BaseModel):
    """Statistics for one task."""

    task: TaskResponse
    start_date: date
    end_date: date
    completed: int
    missed: int
    recorded: int
    completion_rate: float | None
    current_streak: int
    longest_streak: int
    recent_7d_rate: float | None
    recent_30d_rate: float | None
    recent_90d_rate: float | None
    trend: Trend


class OverallStatsResponse(BaseModel):
    """Aggregate statistics across tasks."""

    start_date: date
    end_date: date
    task_stats: list[TaskStatsResponse]
    avg_rate: float | None
    min_rate: float | None
    max_rate: float | None
    spread: float | None
    tracked_days: int
    total_days: int


class ErrorResponse(BaseModel):
    """Standard application error response."""

    detail: str


# ---------------------------------------------------------------------------
# Serialization
# ---------------------------------------------------------------------------


def task_response(task: Task) -> TaskResponse:
    """Convert a domain Task to an API response."""
    return TaskResponse(
        id=task.id,
        name=task.name,
        cutoff_message=task.cutoff_message,
        created_at=task.created_at,
        archived_at=task.archived_at,
        is_active=task.is_active,
    )


def daily_entry_response(entry: DailyEntry) -> DailyEntryResponse:
    """Convert a domain DailyEntry to an API response."""
    return DailyEntryResponse(
        task_id=entry.task_id,
        date=entry.date,
        completed=entry.completed,
        created_at=entry.created_at,
        updated_at=entry.updated_at,
    )


def task_stats_response(stats: TaskStats) -> TaskStatsResponse:
    """Convert domain task statistics to an API response."""
    return TaskStatsResponse(
        task=task_response(stats.task),
        start_date=stats.start_date,
        end_date=stats.end_date,
        completed=stats.completed,
        missed=stats.missed,
        recorded=stats.recorded,
        completion_rate=stats.completion_rate,
        current_streak=stats.current_streak,
        longest_streak=stats.longest_streak,
        recent_7d_rate=stats.recent_7d_rate,
        recent_30d_rate=stats.recent_30d_rate,
        recent_90d_rate=stats.recent_90d_rate,
        trend=stats.trend,
    )


def overall_stats_response(stats: OverallStats) -> OverallStatsResponse:
    """Convert domain overall statistics to an API response."""
    return OverallStatsResponse(
        start_date=stats.start_date,
        end_date=stats.end_date,
        task_stats=[task_stats_response(task_stats) for task_stats in stats.task_stats],
        avg_rate=stats.avg_rate,
        min_rate=stats.min_rate,
        max_rate=stats.max_rate,
        spread=stats.spread,
        tracked_days=stats.tracked_days,
        total_days=stats.total_days,
    )

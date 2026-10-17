"""Pydantic schemas for the LifeLedger HTTP API."""

from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from momentum.ledger.domain.models import (
    DEFAULT_COMMITMENT_CATEGORY,
    CommitmentCategory,
    DailyEntry,
    InsightsCommitmentStats,
    InsightsSummary,
    InsightsTrend,
    InsightsTrendMode,
    InsightsTrendPoint,
    InsightsTrendSeries,
    OverallStats,
    Task,
    TaskStats,
    Trend,
)


class TaskCreateRequest(BaseModel):
    """Request body for creating a task."""

    name: str = Field(min_length=1, max_length=200)
    cutoff_message: str = Field(min_length=1, max_length=500)
    category: CommitmentCategory = DEFAULT_COMMITMENT_CATEGORY


class TaskUpdateRequest(BaseModel):
    """Request body for editing a task."""

    name: str | None = Field(default=None, min_length=1, max_length=200)
    cutoff_message: str | None = Field(default=None, min_length=1, max_length=500)
    category: CommitmentCategory | None = None


class TaskResponse(BaseModel):
    """Serialized task."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    cutoff_message: str
    category: CommitmentCategory
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


class DailyEntryBatchItemRequest(BaseModel):
    """One task decision in a daily-entry batch."""

    task_id: int = Field(gt=0)
    completed: bool


class DailyEntryBatchRecordRequest(BaseModel):
    """Request body for recording multiple task entries for one date."""

    date: date
    entries: list[DailyEntryBatchItemRequest] = Field(min_length=1, max_length=500)


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


class InsightsCommitmentStatsResponse(BaseModel):
    """Recorded-day and distribution statistics for one selected commitment."""

    task: TaskResponse
    completed_days: int
    not_completed_days: int
    recorded_days: int
    completion_percentage: float
    distribution_percentage: float


class InsightsSummaryResponse(BaseModel):
    """Ledger Insights summary for an explicit commitment/date selection."""

    start_date: date
    end_date: date
    calendar_days: int
    days_with_any_entry: int = Field(
        description="Distinct dates with an entry for at least one selected commitment."
    )
    selected_commitment_ids: list[int]
    total_completed_days: int
    commitment_stats: list[InsightsCommitmentStatsResponse]


class InsightsTrendPointResponse(BaseModel):
    """One inclusive historical completion-share point."""

    start_date: date
    end_date: date
    completed_days: int
    recorded_days: int
    completion_percentage: float
    distribution_percentage: float


class InsightsTrendSeriesResponse(BaseModel):
    """Calendar-based historical points for one selected commitment."""

    task: TaskResponse
    points: list[InsightsTrendPointResponse]


class InsightsTrendResponse(BaseModel):
    """Combined historical trend for an explicit commitment selection."""

    reference_date: date
    year: int
    available_years: list[int]
    mode: InsightsTrendMode
    period_count: int
    selected_commitment_ids: list[int]
    series: list[InsightsTrendSeriesResponse]


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
        category=task.category,
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


def insights_commitment_stats_response(
    stats: InsightsCommitmentStats,
) -> InsightsCommitmentStatsResponse:
    """Convert one commitment's Insights statistics to an API response."""
    return InsightsCommitmentStatsResponse(
        task=task_response(stats.task),
        completed_days=stats.completed_days,
        not_completed_days=stats.not_completed_days,
        recorded_days=stats.recorded_days,
        completion_percentage=stats.completion_percentage,
        distribution_percentage=stats.distribution_percentage,
    )


def insights_summary_response(summary: InsightsSummary) -> InsightsSummaryResponse:
    """Convert a Ledger Insights summary to an API response."""
    return InsightsSummaryResponse(
        start_date=summary.start_date,
        end_date=summary.end_date,
        calendar_days=summary.calendar_days,
        days_with_any_entry=summary.days_with_any_entry,
        selected_commitment_ids=[stats.task.id for stats in summary.commitment_stats],
        total_completed_days=summary.total_completed_days,
        commitment_stats=[
            insights_commitment_stats_response(stats) for stats in summary.commitment_stats
        ],
    )


def insights_trend_point_response(point: InsightsTrendPoint) -> InsightsTrendPointResponse:
    """Convert one Insights trend point to an API response."""
    return InsightsTrendPointResponse(
        start_date=point.start_date,
        end_date=point.end_date,
        completed_days=point.completed_days,
        recorded_days=point.recorded_days,
        completion_percentage=point.completion_percentage,
        distribution_percentage=point.distribution_percentage,
    )


def insights_trend_series_response(
    series: InsightsTrendSeries,
) -> InsightsTrendSeriesResponse:
    """Convert one Insights trend series to an API response."""
    return InsightsTrendSeriesResponse(
        task=task_response(series.task),
        points=[insights_trend_point_response(point) for point in series.points],
    )


def insights_trend_response(trend: InsightsTrend) -> InsightsTrendResponse:
    """Convert a combined Ledger Insights trend to an API response."""
    return InsightsTrendResponse(
        reference_date=trend.reference_date,
        year=trend.year,
        available_years=list(trend.available_years),
        mode=trend.mode,
        period_count=trend.period_count,
        selected_commitment_ids=[series.task.id for series in trend.series],
        series=[insights_trend_series_response(series) for series in trend.series],
    )

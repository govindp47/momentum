"""Pydantic schemas for the Stride HTTP API."""

from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from momentum.stride.domain.enums import (
    EventType,
    JourneyStatus,
    MilestoneStatus,
    TrackingMethod,
)
from momentum.stride.domain.models import (
    Achievement,
    DailyActivity,
    Journey,
    JourneyStats,
    Milestone,
    PaceInfo,
    ProgressEvent,
    ProgressSummary,
    StreakInfo,
)

# ---------------------------------------------------------------------------
# Journeys
# ---------------------------------------------------------------------------


class JourneyCreateRequest(BaseModel):
    """Create a new journey."""

    name: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=2000)
    tracking_method: TrackingMethod
    target_value: float = Field(gt=0)
    unit: str | None = Field(default=None, max_length=100)
    start_date: date | None = None
    target_date: date | None = None
    milestone_names: list[str] | None = None


class JourneyUpdateRequest(BaseModel):
    """Update journey metadata."""

    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    target_value: float | None = Field(default=None, gt=0)
    unit: str | None = Field(default=None, max_length=100)
    clear_unit: bool = False
    target_date: date | None = None
    clear_target_date: bool = False


class JourneyResponse(BaseModel):
    """Journey representation returned by the API."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str
    tracking_method: TrackingMethod
    target_value: float
    unit: str | None
    status: JourneyStatus
    start_date: date
    target_date: date | None
    created_at: datetime
    updated_at: datetime
    is_active: bool
    is_paused: bool
    is_completed: bool
    is_archived: bool
    is_milestone_based: bool
    is_count_based: bool
    is_quantity_based: bool
    is_duration_based: bool
    accepts_progress: bool


# ---------------------------------------------------------------------------
# Milestones
# ---------------------------------------------------------------------------


class MilestoneCreateRequest(BaseModel):
    """Create a milestone."""

    name: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=2000)
    position: int | None = Field(default=None, ge=1)


class MilestoneUpdateRequest(BaseModel):
    """Update milestone metadata."""

    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)


class MilestoneReorderRequest(BaseModel):
    """Specify the complete milestone ordering."""

    ordered_ids: list[int] = Field(min_length=1)


class MilestoneResponse(BaseModel):
    """Milestone representation."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    journey_id: int
    name: str
    description: str
    position: int
    target_value: float | None
    unit: str | None
    status: MilestoneStatus
    created_at: datetime
    completed_at: datetime | None
    is_completed: bool
    is_pending: bool


# ---------------------------------------------------------------------------
# Progress
# ---------------------------------------------------------------------------


class ProgressCreateRequest(BaseModel):
    """Record a progress event."""

    value: float | None = None
    duration_seconds: int | None = Field(default=None, gt=0)
    occurred_at: datetime | None = None
    note: str | None = Field(default=None, max_length=2000)


class MilestoneCompletionRequest(BaseModel):
    """Complete a milestone."""

    occurred_at: datetime | None = None
    note: str | None = Field(default=None, max_length=2000)


class ProgressUpdateRequest(BaseModel):
    """Update a normal progress event."""

    value: float | None = None
    clear_value: bool = False
    duration_seconds: int | None = Field(default=None, gt=0)
    clear_duration: bool = False
    occurred_at: datetime | None = None
    note: str | None = Field(default=None, max_length=2000)
    clear_note: bool = False


class ProgressEventResponse(BaseModel):
    """Progress event representation."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    journey_id: int
    milestone_id: int | None
    event_type: EventType
    value: float | None
    duration_seconds: int | None
    occurred_at: datetime
    note: str | None
    created_at: datetime


# ---------------------------------------------------------------------------
# Statistics
# ---------------------------------------------------------------------------


class ProgressSummaryResponse(BaseModel):
    """Current journey progress."""

    journey: JourneyResponse
    current_value: float
    target_value: float
    remaining: float
    percentage: float
    event_count: int
    milestones_completed: int
    milestones_total: int


class StreakResponse(BaseModel):
    """Journey streak information."""

    current_streak: int
    longest_streak: int
    active_days: int
    last_active_date: date | None


class PaceResponse(BaseModel):
    """Journey pace information."""

    days_elapsed: int
    days_remaining: int | None
    actual_daily_rate: float
    required_daily_rate: float | None
    projected_completion_date: date | None
    is_on_pace: bool | None


class JourneyStatsResponse(BaseModel):
    """Statistics for a selected date range."""

    journey: JourneyResponse
    total_value: float
    event_count: int
    active_days: int
    average_per_event: float
    average_per_active_day: float
    best_day_value: float
    best_day_date: date | None
    period_label: str


class DailyActivityResponse(BaseModel):
    """Aggregated activity for a calendar day."""

    date: date
    total_value: float
    total_duration_seconds: int
    event_count: int
    event_type: EventType


class JourneyAnalyticsResponse(BaseModel):
    """Complete journey analytics response."""

    progress: ProgressSummaryResponse
    streak: StreakResponse
    pace: PaceResponse
    stats: JourneyStatsResponse


class CalendarResponse(BaseModel):
    """Calendar activity response."""

    year: int
    journey: JourneyResponse
    activity: list[DailyActivityResponse]


class DashboardJourneyResponse(BaseModel):
    """Journey information displayed on the Stride dashboard."""

    journey: JourneyResponse
    progress: ProgressSummaryResponse
    streak: StreakResponse


class DashboardResponse(BaseModel):
    """Stride dashboard."""

    journeys: list[DashboardJourneyResponse]
    today_activity: dict[int, DailyActivityResponse]


# ---------------------------------------------------------------------------
# Achievements
# ---------------------------------------------------------------------------


class AchievementResponse(BaseModel):
    """Derived achievement."""

    key: str
    title: str
    description: str
    journey_id: int | None
    journey_name: str | None
    unlocked_at: datetime | None
    is_unlocked: bool


# ---------------------------------------------------------------------------
# Export
# ---------------------------------------------------------------------------


class ExportJsonResponse(BaseModel):
    """JSON export returned inline."""

    journey_count: int
    content: str


# ---------------------------------------------------------------------------
# Serialization helpers
# ---------------------------------------------------------------------------


def journey_response(journey: Journey) -> JourneyResponse:
    return JourneyResponse(
        id=journey.id,
        name=journey.name,
        description=journey.description,
        tracking_method=journey.tracking_method,
        target_value=journey.target_value,
        unit=journey.unit,
        status=journey.status,
        start_date=journey.start_date,
        target_date=journey.target_date,
        created_at=journey.created_at,
        updated_at=journey.updated_at,
        is_active=journey.is_active,
        is_paused=journey.is_paused,
        is_completed=journey.is_completed,
        is_archived=journey.is_archived,
        is_milestone_based=journey.is_milestone_based,
        is_count_based=journey.is_count_based,
        is_quantity_based=journey.is_quantity_based,
        is_duration_based=journey.is_duration_based,
        accepts_progress=journey.accepts_progress,
    )


def milestone_response(milestone: Milestone) -> MilestoneResponse:
    return MilestoneResponse(
        id=milestone.id,
        journey_id=milestone.journey_id,
        name=milestone.name,
        description=milestone.description,
        position=milestone.position,
        target_value=milestone.target_value,
        unit=milestone.unit,
        status=milestone.status,
        created_at=milestone.created_at,
        completed_at=milestone.completed_at,
        is_completed=milestone.is_completed,
        is_pending=milestone.is_pending,
    )


def progress_response(event: ProgressEvent) -> ProgressEventResponse:
    return ProgressEventResponse(
        id=event.id,
        journey_id=event.journey_id,
        milestone_id=event.milestone_id,
        event_type=event.event_type,
        value=event.value,
        duration_seconds=event.duration_seconds,
        occurred_at=event.occurred_at,
        note=event.note,
        created_at=event.created_at,
    )


def progress_summary_response(
    summary: ProgressSummary,
) -> ProgressSummaryResponse:
    return ProgressSummaryResponse(
        journey=journey_response(summary.journey),
        current_value=summary.current_value,
        target_value=summary.target_value,
        remaining=summary.remaining,
        percentage=summary.percentage,
        event_count=summary.event_count,
        milestones_completed=summary.milestones_completed,
        milestones_total=summary.milestones_total,
    )


def streak_response(streak: StreakInfo) -> StreakResponse:
    return StreakResponse(
        current_streak=streak.current_streak,
        longest_streak=streak.longest_streak,
        active_days=streak.active_days,
        last_active_date=streak.last_active_date,
    )


def pace_response(pace: PaceInfo) -> PaceResponse:
    return PaceResponse(
        days_elapsed=pace.days_elapsed,
        days_remaining=pace.days_remaining,
        actual_daily_rate=pace.actual_daily_rate,
        required_daily_rate=pace.required_daily_rate,
        projected_completion_date=pace.projected_completion_date,
        is_on_pace=pace.is_on_pace,
    )


def stats_response(stats: JourneyStats) -> JourneyStatsResponse:
    return JourneyStatsResponse(
        journey=journey_response(stats.journey),
        total_value=stats.total_value,
        event_count=stats.event_count,
        active_days=stats.active_days,
        average_per_event=stats.average_per_event,
        average_per_active_day=stats.average_per_active_day,
        best_day_value=stats.best_day_value,
        best_day_date=stats.best_day_date,
        period_label=stats.period_label,
    )


def activity_response(activity: DailyActivity) -> DailyActivityResponse:
    return DailyActivityResponse(
        date=activity.date,
        total_value=activity.total_value,
        total_duration_seconds=activity.total_duration_seconds,
        event_count=activity.event_count,
        event_type=activity.event_type,
    )


def achievement_response(
    achievement: Achievement,
) -> AchievementResponse:
    return AchievementResponse(
        key=achievement.key,
        title=achievement.title,
        description=achievement.description,
        journey_id=achievement.journey_id,
        journey_name=achievement.journey_name,
        unlocked_at=achievement.unlocked_at,
        is_unlocked=achievement.is_unlocked,
    )

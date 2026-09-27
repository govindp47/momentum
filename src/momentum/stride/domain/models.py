"""Stride Domain Models."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime

from momentum.stride.domain.enums import (
    EventType,
    JourneyStatus,
    MilestoneStatus,
    TrackingMethod,
)

# ── Core domain entities ──────────────────────────────────────────────────────


@dataclass(slots=True)
class Journey:
    """Represents a personal goal/journey being tracked."""

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

    @property
    def is_active(self) -> bool:
        """Return True when the journey is currently active."""
        return self.status == JourneyStatus.ACTIVE

    @property
    def is_paused(self) -> bool:
        """Return True when the journey is currently paused."""
        return self.status == JourneyStatus.PAUSED

    @property
    def is_completed(self) -> bool:
        """Return True when the journey has been completed."""
        return self.status == JourneyStatus.COMPLETED

    @property
    def is_archived(self) -> bool:
        """Return True when the journey has been archived."""
        return self.status == JourneyStatus.ARCHIVED

    @property
    def is_milestone_based(self) -> bool:
        """Return True when progress is milestone-based."""
        return self.tracking_method == TrackingMethod.MILESTONE

    @property
    def is_count_based(self) -> bool:
        """Return True when progress is count-based."""
        return self.tracking_method == TrackingMethod.COUNT

    @property
    def is_quantity_based(self) -> bool:
        """Return True when progress is quantity-based."""
        return self.tracking_method == TrackingMethod.QUANTITY

    @property
    def is_duration_based(self) -> bool:
        """Return True when progress is duration-based."""
        return self.tracking_method == TrackingMethod.DURATION

    @property
    def accepts_progress(self) -> bool:
        """Return True when new progress can be recorded."""
        return self.status == JourneyStatus.ACTIVE


@dataclass(slots=True)
class Milestone:
    """An optional intermediate checkpoint within a journey."""

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

    @property
    def is_completed(self) -> bool:
        """Return True when the milestone has been completed."""
        return self.status == MilestoneStatus.COMPLETED

    @property
    def is_pending(self) -> bool:
        """Return True when the milestone is still pending."""
        return self.status == MilestoneStatus.PENDING


@dataclass(slots=True)
class ProgressEvent:
    """A single recorded real-world activity contributing to a journey.

    ``value`` is used for count and quantity based progress.
    ``duration_seconds`` is used for duration based progress.

    Duration is normalized to seconds internally.
    """

    id: int
    journey_id: int
    milestone_id: int | None
    event_type: EventType
    value: float | None
    duration_seconds: int | None
    occurred_at: datetime
    note: str | None
    created_at: datetime


# ── Derived data structures ───────────────────────────────────────────────────


@dataclass(frozen=True, slots=True)
class ProgressSummary:
    """Derived current progress for a journey.

    This object is never persisted as authoritative state.
    """

    journey: Journey
    current_value: float
    target_value: float
    remaining: float
    percentage: float
    event_count: int
    milestones_completed: int
    milestones_total: int


@dataclass(frozen=True, slots=True)
class StreakInfo:
    """Streak calculations derived from progress events."""

    current_streak: int
    longest_streak: int
    active_days: int
    last_active_date: date | None


@dataclass(frozen=True, slots=True)
class PaceInfo:
    """Pace and trajectory calculations."""

    days_elapsed: int
    days_remaining: int | None
    actual_daily_rate: float
    required_daily_rate: float | None
    projected_completion_date: date | None
    is_on_pace: bool | None


@dataclass(frozen=True, slots=True)
class DailyActivity:
    """Aggregated activity for a single calendar day."""

    date: date
    total_value: float
    total_duration_seconds: int
    event_count: int
    event_type: EventType


@dataclass(frozen=True, slots=True)
class JourneyStats:
    """Aggregated statistics for a journey over a time range."""

    journey: Journey
    total_value: float
    event_count: int
    active_days: int
    average_per_event: float
    average_per_active_day: float
    best_day_value: float
    best_day_date: date | None
    period_label: str


@dataclass(frozen=True, slots=True)
class Achievement:
    """A derived motivational accomplishment."""

    key: str
    title: str
    description: str
    journey_id: int | None
    journey_name: str | None
    unlocked_at: datetime | None = None

    @property
    def is_unlocked(self) -> bool:
        """Return True when the achievement has been unlocked."""
        return self.unlocked_at is not None

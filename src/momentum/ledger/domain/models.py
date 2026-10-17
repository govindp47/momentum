"""Domain models — pure dataclasses, no framework dependencies."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from enum import Enum, StrEnum

# ---------------------------------------------------------------------------
# Core entities
# ---------------------------------------------------------------------------


class CommitmentCategory(StrEnum):
    """Stable category values for Ledger commitments."""

    HEALTH_FITNESS = "health_fitness"
    LEARNING_GROWTH = "learning_growth"
    CAREER_WORK = "career_work"
    PERSONAL_PROJECTS = "personal_projects"
    READING_KNOWLEDGE = "reading_knowledge"
    MENTAL_WELLBEING = "mental_wellbeing"
    NUTRITION_SELF_CARE = "nutrition_self_care"
    RELATIONSHIPS_SOCIAL = "relationships_social"
    HOME_RESPONSIBILITIES = "home_responsibilities"
    HABITS_DISCIPLINE = "habits_discipline"


DEFAULT_COMMITMENT_CATEGORY = CommitmentCategory.HABITS_DISCIPLINE


@dataclass(frozen=True, slots=True)
class Task:
    """A long-lived daily commitment tracked by LifeLedger."""

    id: int
    name: str
    cutoff_message: str
    created_at: datetime
    archived_at: datetime | None = None
    category: CommitmentCategory = DEFAULT_COMMITMENT_CATEGORY

    def __post_init__(self) -> None:
        if self.id <= 0:
            raise ValueError("Task id must be positive.")

        if not self.name.strip():
            raise ValueError("Task name must not be empty.")

        if not self.cutoff_message.strip():
            raise ValueError("Task cutoff message must not be empty.")

        if not isinstance(self.category, CommitmentCategory):
            raise ValueError("Task category must be a valid commitment category.")

        if self.archived_at is not None and self.archived_at < self.created_at:
            raise ValueError("Task cannot be archived before it was created.")

    @property
    def is_active(self) -> bool:
        """Return whether the task is currently active."""
        return self.archived_at is None

    @property
    def created_date(self) -> date:
        """Return the calendar date on which the task was created."""
        return self.created_at.date()

    @property
    def archived_date(self) -> date | None:
        """Return the calendar date on which the task was archived."""
        return self.archived_at.date() if self.archived_at else None


@dataclass(frozen=True, slots=True)
class DailyEntry:
    """A user's explicit YES/NO decision for a task on a calendar date."""

    task_id: int
    date: date
    completed: bool
    created_at: datetime
    updated_at: datetime

    def __post_init__(self) -> None:
        if self.task_id <= 0:
            raise ValueError("Daily entry task_id must be positive.")

        if self.updated_at < self.created_at:
            raise ValueError("Daily entry cannot be updated before it was created.")


# ---------------------------------------------------------------------------
# Statistics
# ---------------------------------------------------------------------------


class Trend(Enum):
    """Direction of change between comparable statistics periods."""

    UP = "↑"
    DOWN = "↓"
    FLAT = "→"
    INSUFFICIENT = "—"


@dataclass(frozen=True, slots=True)
class TaskStats:
    """Statistics for a single task over a defined calendar period."""

    task: Task
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

    @property
    def period_days(self) -> int:
        """Return the number of calendar days in the statistics period."""
        return (self.end_date - self.start_date).days + 1

    def __post_init__(self) -> None:
        if self.end_date < self.start_date:
            raise ValueError("Statistics end date cannot precede start date.")

        if self.completed < 0:
            raise ValueError("Completed count cannot be negative.")

        if self.missed < 0:
            raise ValueError("Missed count cannot be negative.")

        if self.recorded != self.completed + self.missed:
            raise ValueError("Recorded count must equal completed + missed.")

        if self.current_streak < 0:
            raise ValueError("Current streak cannot be negative.")

        if self.longest_streak < 0:
            raise ValueError("Longest streak cannot be negative.")

        if self.current_streak > self.longest_streak:
            raise ValueError("Current streak cannot exceed longest streak.")

        if self.completion_rate is None:
            if self.recorded != 0:
                raise ValueError("Completion rate must be present when entries are recorded.")
        else:
            if self.recorded == 0:
                raise ValueError("Completion rate must be None when no entries are recorded.")
            if not 0.0 <= self.completion_rate <= 1.0:
                raise ValueError("Completion rate must be between 0 and 1.")


@dataclass(frozen=True, slots=True)
class OverallStats:
    """Aggregate statistics across active tasks for a calendar period."""

    start_date: date
    end_date: date
    task_stats: tuple[TaskStats, ...]
    avg_rate: float | None
    min_rate: float | None
    max_rate: float | None
    spread: float | None
    tracked_days: int
    total_days: int

    @property
    def period_days(self) -> int:
        """Return the number of calendar days in the statistics period."""
        return (self.end_date - self.start_date).days + 1

    def __post_init__(self) -> None:
        if self.end_date < self.start_date:
            raise ValueError("Statistics end date cannot precede start date.")

        if self.total_days != self.period_days:
            raise ValueError("total_days must match the statistics date range.")

        if self.tracked_days < 0:
            raise ValueError("Tracked days cannot be negative.")

        if self.tracked_days > self.total_days:
            raise ValueError("Tracked days cannot exceed total days.")

        rates = [
            stats.completion_rate for stats in self.task_stats if stats.completion_rate is not None
        ]

        if not rates:
            if any(
                value is not None
                for value in (self.avg_rate, self.min_rate, self.max_rate, self.spread)
            ):
                raise ValueError("Aggregate rates must be None when no task has recorded data.")
            return

        if self.avg_rate is None:
            raise ValueError("Average rate must be present when task rates exist.")

        if self.min_rate is None or self.max_rate is None:
            raise ValueError("Minimum and maximum rates must be present when task rates exist.")

        if not 0.0 <= self.avg_rate <= 1.0:
            raise ValueError("Average rate must be between 0 and 1.")

        if not 0.0 <= self.min_rate <= 1.0:
            raise ValueError("Minimum rate must be between 0 and 1.")

        if not 0.0 <= self.max_rate <= 1.0:
            raise ValueError("Maximum rate must be between 0 and 1.")

        if self.min_rate > self.max_rate:
            raise ValueError("Minimum rate cannot exceed maximum rate.")

        if self.spread is not None and not 0.0 <= self.spread <= 1.0:
            raise ValueError("Spread must be between 0 and 1.")

        if len(rates) < 2:
            if self.spread is not None:
                raise ValueError("Spread must be None when fewer than two tasks have data.")
        else:
            if self.spread is None:
                raise ValueError("Spread must be present when at least two tasks have data.")


class InsightsTrendMode(StrEnum):
    """Supported calendar-based views for Ledger Insights trends."""

    MONTHLY = "monthly"
    CUMULATIVE = "cumulative"

    @property
    def point_count(self) -> int:
        """Return the number of points produced by this trend view."""
        return 12 if self is InsightsTrendMode.MONTHLY else 24


@dataclass(frozen=True, slots=True)
class InsightsCommitmentStats:
    """Recorded-entry statistics for one selected commitment."""

    task: Task
    completed_days: int
    not_completed_days: int
    recorded_days: int
    completion_percentage: float
    distribution_percentage: float

    def __post_init__(self) -> None:
        if self.completed_days < 0 or self.not_completed_days < 0:
            raise ValueError("Insights counts cannot be negative.")
        if self.recorded_days != self.completed_days + self.not_completed_days:
            raise ValueError("Recorded days must equal completed + not-completed days.")
        if not 0.0 <= self.completion_percentage <= 100.0:
            raise ValueError("Completion percentage must be between 0 and 100.")
        if not 0.0 <= self.distribution_percentage <= 100.0:
            raise ValueError("Distribution percentage must be between 0 and 100.")


@dataclass(frozen=True, slots=True)
class InsightsSummary:
    """Portfolio summary for selected commitments and an inclusive date range."""

    start_date: date
    end_date: date
    calendar_days: int
    days_with_any_entry: int
    total_completed_days: int
    commitment_stats: tuple[InsightsCommitmentStats, ...]

    def __post_init__(self) -> None:
        period_days = (self.end_date - self.start_date).days + 1
        if self.end_date < self.start_date:
            raise ValueError("Insights end date cannot precede start date.")
        if self.calendar_days != period_days:
            raise ValueError("Calendar days must match the inclusive date range.")
        if not 0 <= self.days_with_any_entry <= self.calendar_days:
            raise ValueError("Days with entries must fit within the date range.")
        if self.total_completed_days != sum(
            stats.completed_days for stats in self.commitment_stats
        ):
            raise ValueError("Total completed days must match the commitment totals.")


@dataclass(frozen=True, slots=True)
class InsightsTrendPoint:
    """One calendar-range completion and portfolio-share point for a commitment."""

    start_date: date
    end_date: date
    completed_days: int
    recorded_days: int
    completion_percentage: float
    distribution_percentage: float

    def __post_init__(self) -> None:
        if self.end_date < self.start_date:
            raise ValueError("Trend point end date cannot precede its start date.")
        if not 0 <= self.completed_days <= self.recorded_days:
            raise ValueError("Completed days must fit within recorded days.")
        if not 0.0 <= self.completion_percentage <= 100.0:
            raise ValueError("Completion percentage must be between 0 and 100.")
        if not 0.0 <= self.distribution_percentage <= 100.0:
            raise ValueError("Distribution percentage must be between 0 and 100.")


@dataclass(frozen=True, slots=True)
class InsightsTrendSeries:
    """The calendar-based trend points for one selected commitment."""

    task: Task
    points: tuple[InsightsTrendPoint, ...]

    def __post_init__(self) -> None:
        if not self.points:
            raise ValueError("An Insights trend series must contain at least one point.")


@dataclass(frozen=True, slots=True)
class InsightsTrend:
    """Shared calendar boundaries and per-commitment historical series."""

    reference_date: date
    year: int
    available_years: tuple[int, ...]
    mode: InsightsTrendMode
    period_count: int
    series: tuple[InsightsTrendSeries, ...]

    def __post_init__(self) -> None:
        if self.year > self.reference_date.year:
            raise ValueError("Insights trend year cannot follow its reference year.")
        if self.available_years != tuple(sorted(set(self.available_years), reverse=True)):
            raise ValueError("Available Insights trend years must be unique and newest first.")
        if self.reference_date.year not in self.available_years:
            raise ValueError("Available Insights trend years must include the reference year.")
        if self.period_count != self.mode.point_count:
            raise ValueError("Insights trend point count must match its mode.")
        if any(len(series.points) != self.period_count for series in self.series):
            raise ValueError("Every Insights trend series must match the shared point count.")

"""Statistics service — derives all statistics from the event ledger.

Statistics are never stored as authoritative state. Every calculation is
performed from current journey, milestone, and progress-event data so that
historical corrections are reflected automatically.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from itertools import pairwise
from math import ceil

from momentum.stride.domain.enums import EventType, TrackingMethod
from momentum.stride.domain.models import (
    DailyActivity,
    Journey,
    JourneyStats,
    PaceInfo,
    ProgressSummary,
    StreakInfo,
)
from momentum.stride.repositories.journey_repository import JourneyRepository
from momentum.stride.repositories.milestone_repository import MilestoneRepository
from momentum.stride.repositories.progress_repository import ProgressRepository


@dataclass(frozen=True, slots=True)
class DateRange:
    """Represents a bounded calendar-date range for statistics."""

    start: date | None
    end: date | None
    label: str

    @classmethod
    def all_time(cls) -> DateRange:
        return cls(
            start=None,
            end=None,
            label="All Time",
        )

    @classmethod
    def today(cls) -> DateRange:
        today = date.today()
        return cls(
            start=today,
            end=today,
            label="Today",
        )

    @classmethod
    def yesterday(cls) -> DateRange:
        yesterday = date.today() - timedelta(days=1)
        return cls(
            start=yesterday,
            end=yesterday,
            label="Yesterday",
        )

    @classmethod
    def last_n_days(cls, n: int) -> DateRange:
        if n <= 0:
            raise ValueError("Number of days must be greater than zero.")

        end = date.today()
        start = end - timedelta(days=n - 1)

        return cls(
            start=start,
            end=end,
            label=f"Last {n} Days",
        )

    @classmethod
    def this_month(cls) -> DateRange:
        today = date.today()
        return cls(
            start=today.replace(day=1),
            end=today,
            label="This Month",
        )

    @classmethod
    def last_month(cls) -> DateRange:
        today = date.today()
        first_of_this_month = today.replace(day=1)
        last_of_previous_month = first_of_this_month - timedelta(days=1)

        return cls(
            start=last_of_previous_month.replace(day=1),
            end=last_of_previous_month,
            label="Last Month",
        )

    @classmethod
    def this_year(cls) -> DateRange:
        today = date.today()
        return cls(
            start=today.replace(month=1, day=1),
            end=today,
            label="This Year",
        )

    @classmethod
    def last_year(cls) -> DateRange:
        year = date.today().year - 1

        return cls(
            start=date(year, 1, 1),
            end=date(year, 12, 31),
            label="Last Year",
        )

    @classmethod
    def custom(
        cls,
        start: date | None,
        end: date | None,
    ) -> DateRange:
        if start is None and end is None:
            raise ValueError("At least one boundary must be provided.")

        if start is None:
            assert end is not None
            label = f"Through {end.isoformat()}"
        elif end is None:
            label = f"From {start.isoformat()}"
        else:
            if end < start:
                raise ValueError("Date range end must not precede start.")
            label = f"{start.isoformat()} - {end.isoformat()}"

        return cls(
            start=start,
            end=end,
            label=label,
        )


def get_range_presets() -> dict[str, DateRange]:
    """Return current date-range presets."""
    return {
        "today": DateRange.today(),
        "yesterday": DateRange.yesterday(),
        "7d": DateRange.last_n_days(7),
        "30d": DateRange.last_n_days(30),
        "this-month": DateRange.this_month(),
        "last-month": DateRange.last_month(),
        "this-year": DateRange.this_year(),
        "last-year": DateRange.last_year(),
        "all": DateRange.all_time(),
    }


class StatsService:
    """Derive statistics from current journey and event data."""

    def __init__(
        self,
        journey_repo: JourneyRepository,
        milestone_repo: MilestoneRepository,
        progress_repo: ProgressRepository,
    ) -> None:
        self._journeys = journey_repo
        self._milestones = milestone_repo
        self._events = progress_repo

    # ------------------------------------------------------------------
    # Progress summary
    # ------------------------------------------------------------------

    def get_progress(
        self,
        journey: Journey,
    ) -> ProgressSummary:
        """Calculate current progress toward a journey target."""
        if journey.tracking_method == TrackingMethod.MILESTONE:
            return self._get_milestone_progress(journey)

        if journey.tracking_method == TrackingMethod.DURATION:
            total_seconds = self._events.sum_duration_for_journey(
                journey.id,
            )

            current_value = total_seconds / 3600.0
            event_count = self._events.event_count_for_journey(
                journey.id,
            )

            return self._build_progress_summary(
                journey=journey,
                current_value=current_value,
                event_count=event_count,
                milestones_completed=0,
                milestones_total=0,
            )

        current_value = self._events.sum_value_for_journey(
            journey.id,
        )

        event_count = self._events.event_count_for_journey(
            journey.id,
        )

        return self._build_progress_summary(
            journey=journey,
            current_value=current_value,
            event_count=event_count,
            milestones_completed=0,
            milestones_total=0,
        )

    def _get_milestone_progress(
        self,
        journey: Journey,
    ) -> ProgressSummary:
        """Calculate current progress for a milestone journey."""
        total = self._milestones.count_for_journey(journey.id)
        completed = self._milestones.count_completed_for_journey(
            journey.id,
        )

        # A milestone journey's effective target is its milestone count.
        target = float(total) if total > 0 else journey.target_value

        return self._build_progress_summary(
            journey=journey,
            current_value=float(completed),
            event_count=completed,
            milestones_completed=completed,
            milestones_total=total,
            target_value=target,
        )

    @staticmethod
    def _build_progress_summary(
        *,
        journey: Journey,
        current_value: float,
        event_count: int,
        milestones_completed: int,
        milestones_total: int,
        target_value: float | None = None,
    ) -> ProgressSummary:
        """Build a normalized progress summary."""
        target = target_value if target_value is not None else journey.target_value

        remaining = max(target - current_value, 0.0)

        percentage = min(100.0, (current_value / target) * 100.0) if target > 0 else 0.0

        return ProgressSummary(
            journey=journey,
            current_value=current_value,
            target_value=target,
            remaining=remaining,
            percentage=percentage,
            event_count=event_count,
            milestones_completed=milestones_completed,
            milestones_total=milestones_total,
        )

    # ------------------------------------------------------------------
    # Streaks
    # ------------------------------------------------------------------

    def get_streak(
        self,
        journey: Journey,
    ) -> StreakInfo:
        """Calculate active-day streaks for a journey.

        Both normal progress events and milestone completion events count
        as activity.
        """
        daily = self._events.daily_activity_for_journey(
            journey.id,
        )

        if not daily:
            return StreakInfo(
                current_streak=0,
                longest_streak=0,
                active_days=0,
                last_active_date=None,
            )

        active_dates = sorted(activity.date for activity in daily)

        longest_streak = self._calculate_longest_streak(
            active_dates,
        )

        current_streak = self._calculate_current_streak(
            active_dates,
        )

        return StreakInfo(
            current_streak=current_streak,
            longest_streak=longest_streak,
            active_days=len(active_dates),
            last_active_date=active_dates[-1],
        )

    @staticmethod
    def _calculate_longest_streak(
        active_dates: list[date],
    ) -> int:
        if not active_dates:
            return 0

        longest = 1
        current = 1

        for previous, current_date in pairwise(active_dates):
            if current_date - previous == timedelta(days=1):
                current += 1
                longest = max(longest, current)
            else:
                current = 1

        return longest

    @staticmethod
    def _calculate_current_streak(
        active_dates: list[date],
    ) -> int:
        if not active_dates:
            return 0

        today = date.today()
        latest = active_dates[-1]

        # A streak is still current if the last activity was today or
        # yesterday. Older activity means the streak has ended.
        if latest < today - timedelta(days=1):
            return 0

        streak = 1

        for previous, current in zip(
            reversed(active_dates[:-1]),
            reversed(active_dates),
            strict=False,
        ):
            if current - previous != timedelta(days=1):
                break

            streak += 1

        return streak

    # ------------------------------------------------------------------
    # Pace and trajectory
    # ------------------------------------------------------------------

    def get_pace(
        self,
        journey: Journey,
        progress: ProgressSummary,
    ) -> PaceInfo:
        """Calculate actual pace, required pace and projected completion."""
        today = date.today()

        days_elapsed = max(
            1,
            (today - journey.start_date).days + 1,
        )

        days_remaining: int | None = None

        if journey.target_date is not None:
            days_remaining = (journey.target_date - today).days

        actual_rate = self._calculate_actual_daily_rate(
            journey,
            progress,
            days_elapsed,
        )

        required_rate: float | None = None
        is_on_pace: bool | None = None

        if journey.target_date is not None:
            if progress.remaining <= 0:
                required_rate = 0.0
                is_on_pace = True
            elif days_remaining is not None and days_remaining > 0:
                required_rate = progress.remaining / days_remaining
                is_on_pace = actual_rate >= required_rate
            else:
                # Target date has arrived/passed and target is still
                # incomplete.
                required_rate = float("inf")
                is_on_pace = False

        projected_completion_date = self._project_completion_date(
            today=today,
            remaining=progress.remaining,
            actual_rate=actual_rate,
        )

        return PaceInfo(
            days_elapsed=days_elapsed,
            days_remaining=(max(days_remaining, 0) if days_remaining is not None else None),
            actual_daily_rate=actual_rate,
            required_daily_rate=required_rate,
            projected_completion_date=projected_completion_date,
            is_on_pace=is_on_pace,
        )

    def _calculate_actual_daily_rate(
        self,
        journey: Journey,
        progress: ProgressSummary,
        days_elapsed: int,
    ) -> float:
        if journey.tracking_method == TrackingMethod.MILESTONE:
            return progress.milestones_completed / days_elapsed

        if journey.tracking_method == TrackingMethod.DURATION:
            total_seconds = self._events.sum_duration_for_journey(
                journey.id,
            )

            total_hours = total_seconds / 3600.0

            return total_hours / days_elapsed

        return progress.current_value / days_elapsed

    @staticmethod
    def _project_completion_date(
        *,
        today: date,
        remaining: float,
        actual_rate: float,
    ) -> date | None:
        if remaining <= 0:
            return today

        if actual_rate <= 0:
            return None

        days_to_finish = ceil(
            remaining / actual_rate,
        )

        return today + timedelta(days=days_to_finish)

    # ------------------------------------------------------------------
    # Aggregate statistics
    # ------------------------------------------------------------------

    def get_stats(
        self,
        journey: Journey,
        date_range: DateRange | None = None,
    ) -> JourneyStats:
        """Calculate aggregate statistics for a date range."""
        if date_range is None:
            date_range = DateRange.all_time()

        daily = self._events.daily_activity_for_journey(
            journey.id,
            start_date=date_range.start,
            end_date=date_range.end,
        )

        active_days = len(daily)

        if journey.tracking_method == TrackingMethod.DURATION:
            total_value = sum(activity.total_duration_seconds for activity in daily) / 3600.0
        elif journey.tracking_method == TrackingMethod.MILESTONE:
            total_value = sum(
                activity.total_value
                for activity in daily
                if activity.event_type == EventType.MILESTONE_COMPLETED
            )
        else:
            total_value = sum(
                activity.total_value
                for activity in daily
                if activity.event_type == EventType.PROGRESS
            )

        event_count = sum(
            activity.event_count
            for activity in daily
            if self._counts_as_statistical_event(
                journey,
                activity,
            )
        )

        average_per_event = total_value / event_count if event_count > 0 else 0.0

        average_per_active_day = total_value / active_days if active_days > 0 else 0.0

        best_day = self._find_best_day(
            journey,
            daily,
        )

        return JourneyStats(
            journey=journey,
            total_value=total_value,
            event_count=event_count,
            active_days=active_days,
            average_per_event=average_per_event,
            average_per_active_day=average_per_active_day,
            best_day_value=(
                self._activity_value_for_stats(
                    journey,
                    best_day,
                )
                if best_day is not None
                else 0.0
            ),
            best_day_date=(best_day.date if best_day is not None else None),
            period_label=date_range.label,
        )

    @staticmethod
    def _counts_as_statistical_event(
        journey: Journey,
        activity: DailyActivity,
    ) -> bool:
        """Determine whether an activity event contributes to statistics."""
        if journey.tracking_method == TrackingMethod.MILESTONE:
            return activity.event_type == EventType.MILESTONE_COMPLETED

        return activity.event_type == EventType.PROGRESS

    @staticmethod
    def _activity_value_for_stats(
        journey: Journey,
        activity: DailyActivity,
    ) -> float:
        if journey.tracking_method == TrackingMethod.DURATION:
            return activity.total_duration_seconds / 3600.0

        return activity.total_value

    def _find_best_day(
        self,
        journey: Journey,
        daily: list[DailyActivity],
    ) -> DailyActivity | None:
        relevant = [
            activity
            for activity in daily
            if self._counts_as_statistical_event(
                journey,
                activity,
            )
        ]

        if not relevant:
            return None

        return max(
            relevant,
            key=lambda activity: self._activity_value_for_stats(
                journey,
                activity,
            ),
        )

    # ------------------------------------------------------------------
    # Dashboard / calendar
    # ------------------------------------------------------------------

    def get_today_activity(
        self,
        journeys: list[Journey],
    ) -> dict[int, DailyActivity]:
        """Return today's activity for each journey with activity."""
        today = date.today()
        result: dict[int, DailyActivity] = {}

        for journey in journeys:
            daily = self._events.daily_activity_for_journey(
                journey.id,
                start_date=today,
                end_date=today,
            )

            if daily:
                result[journey.id] = daily[0]

        return result

    def get_calendar_data(
        self,
        journey: Journey,
        year: int,
    ) -> list[DailyActivity]:
        """Return activity data for a complete calendar year."""
        start = date(year, 1, 1)
        end = date(year, 12, 31)

        return self._events.daily_activity_for_journey(
            journey.id,
            start_date=start,
            end_date=end,
        )

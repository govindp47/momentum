"""Application operations for LifeLedger statistics."""

from __future__ import annotations

import logging
from datetime import date, timedelta

from momentum.ledger.domain.errors import TaskNotFoundError
from momentum.ledger.domain.models import (
    OverallStats,
    Task,
    TaskStats,
    Trend,
)
from momentum.ledger.domain.rules import (
    TREND_FLAT_THRESHOLD,
    TREND_MIN_RECORDED,
    compute_streaks,
    effective_period,
    streak_reference_date,
    validate_days,
)
from momentum.ledger.repositories.entry_repository import EntryRepository
from momentum.ledger.repositories.task_repository import TaskRepository

logger = logging.getLogger(__name__)


class StatsService:
    """Calculate transparent historical and balance statistics."""

    def __init__(
        self,
        task_repo: TaskRepository,
        entry_repo: EntryRepository,
    ) -> None:
        self._tasks = task_repo
        self._entries = entry_repo

    def compute_overall_stats(
        self,
        days: int,
        reference_date: date | None = None,
    ) -> OverallStats:
        """Calculate statistics for tasks whose lifecycle overlaps the period."""
        validate_days(days)

        end_date = reference_date or date.today()
        start_date = end_date - timedelta(days=days - 1)

        eligible_tasks = [
            task
            for task in self._tasks.list_all()
            if task.created_date <= end_date
            and (task.archived_date is None or task.archived_date >= start_date)
        ]

        task_stats = [
            self._compute_task_stats(
                task=task,
                start_date=start_date,
                end_date=end_date,
            )
            for task in eligible_tasks
        ]

        task_stats.sort(key=lambda stats: stats.task.name.casefold())

        rates = [stats.completion_rate for stats in task_stats if stats.completion_rate is not None]

        avg_rate = sum(rates) / len(rates) if rates else None

        min_rate = min(rates) if rates else None
        max_rate = max(rates) if rates else None

        spread = (
            max_rate - min_rate
            if len(rates) >= 2 and min_rate is not None and max_rate is not None
            else None
        )

        tracked_days = self._count_tracked_days(
            start_date,
            end_date,
        )

        return OverallStats(
            start_date=start_date,
            end_date=end_date,
            task_stats=tuple(task_stats),
            avg_rate=avg_rate,
            min_rate=min_rate,
            max_rate=max_rate,
            spread=spread,
            tracked_days=tracked_days,
            total_days=days,
        )

    def compute_task_stats_by_name(
        self,
        task_name: str,
        days: int,
        reference_date: date | None = None,
    ) -> TaskStats:
        """Calculate statistics for a specific task."""
        validate_days(days)

        task = self._tasks.get_by_name(task_name.strip())

        if task is None:
            raise TaskNotFoundError(task_name)

        end_date = reference_date or date.today()
        start_date = end_date - timedelta(days=days - 1)

        return self._compute_task_stats(
            task=task,
            start_date=start_date,
            end_date=end_date,
        )

    def _compute_task_stats(
        self,
        task: Task,
        start_date: date,
        end_date: date,
    ) -> TaskStats:
        """Calculate statistics for one task over a date range."""
        effective_start, effective_end = effective_period(
            task,
            start_date,
            end_date,
        )

        if effective_start > effective_end:
            completed = 0
            missed = 0
            completion_rate = None
        else:
            completed, missed = self._entries.get_period_stats(
                task.id,
                effective_start,
                effective_end,
            )

            recorded = completed + missed
            completion_rate = completed / recorded if recorded > 0 else None

        entries = self._entries.get_all_entries_for_task(task.id)

        streak_reference = streak_reference_date(
            task,
            end_date,
        )

        current_streak, longest_streak = compute_streaks(
            entries,
            streak_reference,
        )

        recent_7d_rate = self._rate_for_period(
            task,
            end_date - timedelta(days=6),
            end_date,
        )

        recent_30d_rate = self._rate_for_period(
            task,
            end_date - timedelta(days=29),
            end_date,
        )

        recent_90d_rate = self._rate_for_period(
            task,
            end_date - timedelta(days=89),
            end_date,
        )

        trend = self._compute_trend(
            task,
            end_date,
            period_days=end_date.toordinal() - start_date.toordinal() + 1,
        )

        return TaskStats(
            task=task,
            start_date=start_date,
            end_date=end_date,
            completed=completed,
            missed=missed,
            recorded=completed + missed,
            completion_rate=completion_rate,
            current_streak=current_streak,
            longest_streak=longest_streak,
            recent_7d_rate=recent_7d_rate,
            recent_30d_rate=recent_30d_rate,
            recent_90d_rate=recent_90d_rate,
            trend=trend,
        )

    def _rate_for_period(
        self,
        task: Task,
        start_date: date,
        end_date: date,
    ) -> float | None:
        """Calculate completion rate for an inclusive date range."""
        effective_start, effective_end = effective_period(
            task,
            start_date,
            end_date,
        )

        if effective_start > effective_end:
            return None

        completed, missed = self._entries.get_period_stats(
            task.id,
            effective_start,
            effective_end,
        )

        recorded = completed + missed

        if recorded == 0:
            return None

        return completed / recorded

    def _compute_trend(
        self,
        task: Task,
        reference_date: date,
        period_days: int,
    ) -> Trend:
        """Compare the current period with the previous comparable period."""
        current_end = reference_date
        current_start = current_end - timedelta(days=period_days - 1)

        previous_end = current_start - timedelta(days=1)
        previous_start = previous_end - timedelta(days=period_days - 1)

        current_rate = self._rate_for_period(
            task,
            current_start,
            current_end,
        )

        previous_rate = self._rate_for_period(
            task,
            previous_start,
            previous_end,
        )

        current_recorded = self._recorded_count(
            task,
            current_start,
            current_end,
        )

        previous_recorded = self._recorded_count(
            task,
            previous_start,
            previous_end,
        )

        if (
            current_rate is None
            or previous_rate is None
            or current_recorded < TREND_MIN_RECORDED
            or previous_recorded < TREND_MIN_RECORDED
        ):
            return Trend.INSUFFICIENT

        delta = current_rate - previous_rate

        if delta > TREND_FLAT_THRESHOLD:
            return Trend.UP

        if delta < -TREND_FLAT_THRESHOLD:
            return Trend.DOWN

        return Trend.FLAT

    def _recorded_count(
        self,
        task: Task,
        start_date: date,
        end_date: date,
    ) -> int:
        """Return the number of explicit YES/NO records in a period."""
        effective_start, effective_end = effective_period(
            task,
            start_date,
            end_date,
        )

        if effective_start > effective_end:
            return 0

        completed, missed = self._entries.get_period_stats(
            task.id,
            effective_start,
            effective_end,
        )

        return completed + missed

    def _count_tracked_days(
        self,
        start_date: date,
        end_date: date,
    ) -> int:
        """Count distinct calendar days with at least one recorded entry.

        Historical records are included even if their task is now archived.
        This keeps tracking coverage a historical measure rather than an
        active-task-only measure.
        """
        tracked_dates: set[date] = set()

        for task in self._tasks.list_all():
            entries = self._entries.list_for_task(
                task.id,
                start_date,
                end_date,
            )

            tracked_dates.update(entry.date for entry in entries)

        return len(tracked_dates)

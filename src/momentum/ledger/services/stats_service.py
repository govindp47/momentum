"""Application operations for LifeLedger statistics."""

from __future__ import annotations

from collections.abc import Sequence
from datetime import date, timedelta

from momentum.ledger.domain.errors import InvalidDateError, InvalidTaskError, TaskNotFoundError
from momentum.ledger.domain.models import (
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
from momentum.ledger.domain.rules import (
    TREND_FLAT_THRESHOLD,
    TREND_MIN_RECORDED,
    compute_streaks,
    effective_period,
    streak_reference_date,
    validate_days,
    validate_insights_date_range,
)
from momentum.ledger.repositories.entry_repository import EntryRepository
from momentum.ledger.repositories.task_repository import TaskRepository


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

    def compute_insights_summary(
        self,
        task_ids: Sequence[int],
        start_date: date,
        end_date: date,
    ) -> InsightsSummary:
        """Calculate authoritative statistics for explicitly selected commitments.

        ``days_with_any_entry`` is scoped to the selected commitments. Missing
        calendar dates are never interpreted as not-completed entries.
        """
        calendar_days = validate_insights_date_range(start_date, end_date)
        tasks = self._resolve_insights_tasks(task_ids)
        counts, days_with_any_entry = self._entries.get_insights_summary_counts(
            [task.id for task in tasks],
            start_date,
            end_date,
        )
        total_completed_days = sum(counts.get(task.id, (0, 0))[0] for task in tasks)
        commitment_stats = tuple(
            self._build_insights_commitment_stats(
                task,
                counts.get(task.id, (0, 0)),
                total_completed_days,
            )
            for task in tasks
        )
        return InsightsSummary(
            start_date=start_date,
            end_date=end_date,
            calendar_days=calendar_days,
            days_with_any_entry=days_with_any_entry,
            total_completed_days=total_completed_days,
            commitment_stats=commitment_stats,
        )

    def compute_insights_trend(
        self,
        task_ids: Sequence[int],
        reference_date: date,
        year: int,
        mode: InsightsTrendMode,
    ) -> InsightsTrend:
        """Calculate calendar-month shares or cumulative twice-monthly shares."""
        if year > reference_date.year:
            raise InvalidDateError("Trend year cannot be after the current year.")
        if year < 1:
            raise InvalidDateError("Trend year must be a valid calendar year.")

        tasks = self._resolve_insights_tasks(task_ids)
        selected_task_ids = [task.id for task in tasks]
        boundaries = _insights_trend_boundaries(reference_date, year, mode)
        counts = self._entries.get_insights_range_counts(
            selected_task_ids,
            boundaries,
        )
        available_years = tuple(
            sorted(
                {
                    reference_date.year,
                    *(
                        entry_year
                        for entry_year in self._entries.get_insights_available_years(
                            selected_task_ids
                        )
                        if entry_year <= reference_date.year
                    ),
                },
                reverse=True,
            )
        )
        total_completed_by_period = tuple(
            sum(counts.get((task.id, period_index), (0, 0))[0] for task in tasks)
            for period_index in range(len(boundaries))
        )
        series = tuple(
            InsightsTrendSeries(
                task=task,
                points=tuple(
                    self._build_insights_trend_point(
                        start_date=period_start,
                        end_date=period_end,
                        counts=counts.get((task.id, period_index), (0, 0)),
                        total_completed_days=total_completed_by_period[period_index],
                    )
                    for period_index, (period_start, period_end) in enumerate(boundaries)
                ),
            )
            for task in tasks
        )
        return InsightsTrend(
            reference_date=reference_date,
            year=year,
            available_years=available_years,
            mode=mode,
            period_count=len(boundaries),
            series=series,
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

    def _resolve_insights_tasks(self, task_ids: Sequence[int]) -> list[Task]:
        """Validate and resolve an explicit commitment selection without broadening it."""
        if not task_ids:
            raise InvalidTaskError("At least one commitment must be selected.")
        if len(task_ids) > 500:
            raise InvalidTaskError("No more than 500 commitments can be selected.")
        if any(task_id <= 0 for task_id in task_ids):
            raise InvalidTaskError("Commitment IDs must be positive.")
        if len(set(task_ids)) != len(task_ids):
            raise InvalidTaskError("Each commitment can only be selected once.")

        tasks = self._tasks.list_by_ids(task_ids)
        found_ids = {task.id for task in tasks}
        missing_id = next((task_id for task_id in task_ids if task_id not in found_ids), None)
        if missing_id is not None:
            raise TaskNotFoundError(str(missing_id))
        return tasks

    @staticmethod
    def _build_insights_commitment_stats(
        task: Task,
        counts: tuple[int, int],
        total_completed_days: int,
    ) -> InsightsCommitmentStats:
        completed_days, not_completed_days = counts
        recorded_days = completed_days + not_completed_days
        return InsightsCommitmentStats(
            task=task,
            completed_days=completed_days,
            not_completed_days=not_completed_days,
            recorded_days=recorded_days,
            completion_percentage=_percentage(completed_days, recorded_days),
            distribution_percentage=_percentage(completed_days, total_completed_days),
        )

    @staticmethod
    def _build_insights_trend_point(
        start_date: date,
        end_date: date,
        counts: tuple[int, int],
        total_completed_days: int,
    ) -> InsightsTrendPoint:
        completed_days, recorded_days = counts
        return InsightsTrendPoint(
            start_date=start_date,
            end_date=end_date,
            completed_days=completed_days,
            recorded_days=recorded_days,
            completion_percentage=_percentage(completed_days, recorded_days),
            distribution_percentage=_percentage(completed_days, total_completed_days),
        )


def _percentage(numerator: int, denominator: int) -> float:
    """Return an unrounded 0..100 percentage with an explicit zero denominator."""
    return (numerator / denominator) * 100.0 if denominator else 0.0


def _insights_trend_boundaries(
    reference_date: date,
    year: int,
    mode: InsightsTrendMode,
) -> tuple[tuple[date, date], ...]:
    """Build the current rolling year or a previous January-to-December year."""
    if year == reference_date.year:
        current_month = date(reference_date.year, reference_date.month, 1)
        first_month = _shift_month(current_month, -11)
    else:
        first_month = date(year, 1, 1)
    month_starts = tuple(_shift_month(first_month, offset) for offset in range(12))

    if mode is InsightsTrendMode.MONTHLY:
        return tuple((month_start, _month_end(month_start)) for month_start in month_starts)

    return tuple(
        (first_month, checkpoint)
        for month_start in month_starts
        for checkpoint in (
            date(month_start.year, month_start.month, 15),
            _month_end(month_start),
        )
    )


def _shift_month(month_start: date, offset: int) -> date:
    """Shift a first-of-month date by a whole number of calendar months."""
    month_index = (month_start.year * 12) + month_start.month - 1 + offset
    year, zero_based_month = divmod(month_index, 12)
    return date(year, zero_based_month + 1, 1)


def _month_end(month_start: date) -> date:
    """Return the final calendar date of a month."""
    return _shift_month(month_start, 1) - timedelta(days=1)

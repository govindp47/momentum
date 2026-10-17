"""Ledger Insights filtering, percentages, and period-boundary tests."""

from __future__ import annotations

import sqlite3
from datetime import date, timedelta

import pytest

from momentum.ledger.domain.errors import InvalidDateError, InvalidTaskError, TaskNotFoundError
from momentum.ledger.domain.models import InsightsTrendMode
from momentum.ledger.repositories.entry_repository import EntryRepository
from momentum.ledger.repositories.task_repository import TaskRepository
from momentum.ledger.services.stats_service import StatsService
from momentum.ledger.services.task_service import TaskService


def test_summary_counts_only_distinct_recorded_dates_and_preserves_selection_order(
    task_svc: TaskService,
    entry_repo: EntryRepository,
    stats_svc: StatsService,
) -> None:
    exercise = task_svc.create_task("Exercise", "Move")
    reading = task_svc.create_task("Read", "Read")
    start_date = date(2024, 2, 27)
    end_date = date(2024, 3, 2)

    entry_repo.upsert(exercise.id, date(2024, 2, 27), True)
    entry_repo.upsert(exercise.id, date(2024, 2, 29), True)
    entry_repo.upsert(exercise.id, date(2024, 3, 1), False)
    entry_repo.upsert(reading.id, date(2024, 2, 28), False)
    entry_repo.upsert(reading.id, date(2024, 2, 29), True)
    entry_repo.upsert(reading.id, date(2024, 3, 3), True)

    summary = stats_svc.compute_insights_summary(
        [reading.id, exercise.id],
        start_date,
        end_date,
    )

    assert summary.start_date == start_date
    assert summary.end_date == end_date
    assert summary.calendar_days == 5
    assert summary.days_with_any_entry == 4
    assert summary.total_completed_days == 3
    assert [item.task.id for item in summary.commitment_stats] == [reading.id, exercise.id]

    reading_stats, exercise_stats = summary.commitment_stats
    assert (
        reading_stats.completed_days,
        reading_stats.not_completed_days,
        reading_stats.recorded_days,
    ) == (1, 1, 2)
    assert reading_stats.completion_percentage == pytest.approx(50.0)
    assert reading_stats.distribution_percentage == pytest.approx(100 / 3)
    assert (
        exercise_stats.completed_days,
        exercise_stats.not_completed_days,
        exercise_stats.recorded_days,
    ) == (2, 1, 3)
    assert exercise_stats.completion_percentage == pytest.approx(200 / 3)
    assert exercise_stats.distribution_percentage == pytest.approx(200 / 3)
    assert sum(item.distribution_percentage for item in summary.commitment_stats) == pytest.approx(
        100.0
    )


def test_summary_zero_completion_and_unrecorded_commitments_have_zero_percentages(
    task_svc: TaskService,
    entry_repo: EntryRepository,
    stats_svc: StatsService,
) -> None:
    recorded = task_svc.create_task("Recorded", "Record")
    missing = task_svc.create_task("Missing", "No entry")
    entry_repo.upsert(recorded.id, date(2026, 1, 10), False)

    summary = stats_svc.compute_insights_summary(
        [recorded.id, missing.id],
        date(2026, 1, 10),
        date(2026, 1, 10),
    )

    assert summary.total_completed_days == 0
    assert summary.calendar_days == 1
    assert summary.days_with_any_entry == 1
    assert [item.completion_percentage for item in summary.commitment_stats] == [0.0, 0.0]
    assert [item.distribution_percentage for item in summary.commitment_stats] == [0.0, 0.0]
    assert summary.commitment_stats[1].recorded_days == 0


def test_summary_supports_archived_commitments(
    task_svc: TaskService,
    entry_repo: EntryRepository,
    stats_svc: StatsService,
) -> None:
    task = task_svc.create_task("Archived", "Preserve history")
    entry_date = date.today()
    entry_repo.upsert(task.id, entry_date, True)
    task_svc.archive_task(task.name)

    summary = stats_svc.compute_insights_summary([task.id], entry_date, entry_date)

    assert summary.commitment_stats[0].task.is_active is False
    assert summary.commitment_stats[0].completed_days == 1


def test_monthly_trend_uses_twelve_static_calendar_months(
    task_svc: TaskService,
    entry_repo: EntryRepository,
    stats_svc: StatsService,
) -> None:
    first = task_svc.create_task("First", "First")
    second = task_svc.create_task("Second", "Second")
    reference_date = date(2024, 3, 20)
    first_start = date(2023, 4, 1)
    entry_repo.upsert(first.id, first_start, True)
    entry_repo.upsert(first.id, date(2023, 4, 30), False)
    entry_repo.upsert(second.id, first_start, True)
    entry_repo.upsert(second.id, reference_date, True)

    trend = stats_svc.compute_insights_trend(
        [first.id, second.id],
        reference_date,
        reference_date.year,
        InsightsTrendMode.MONTHLY,
    )

    assert trend.reference_date == reference_date
    assert trend.year == 2024
    assert trend.available_years == (2024, 2023)
    assert trend.mode is InsightsTrendMode.MONTHLY
    assert trend.period_count == 12
    assert len(trend.series) == 2
    assert all(len(series.points) == 12 for series in trend.series)

    expected_boundaries = [
        (date(2023, 4, 1), date(2023, 4, 30)),
        (date(2023, 5, 1), date(2023, 5, 31)),
        (date(2023, 6, 1), date(2023, 6, 30)),
        (date(2023, 7, 1), date(2023, 7, 31)),
        (date(2023, 8, 1), date(2023, 8, 31)),
        (date(2023, 9, 1), date(2023, 9, 30)),
        (date(2023, 10, 1), date(2023, 10, 31)),
        (date(2023, 11, 1), date(2023, 11, 30)),
        (date(2023, 12, 1), date(2023, 12, 31)),
        (date(2024, 1, 1), date(2024, 1, 31)),
        (date(2024, 2, 1), date(2024, 2, 29)),
        (date(2024, 3, 1), date(2024, 3, 31)),
    ]
    for series in trend.series:
        assert [(point.start_date, point.end_date) for point in series.points] == (
            expected_boundaries
        )

    assert trend.series[0].points[0].completed_days == 1
    assert trend.series[0].points[0].recorded_days == 2
    assert trend.series[0].points[0].completion_percentage == pytest.approx(50.0)
    assert trend.series[0].points[0].distribution_percentage == pytest.approx(50.0)
    assert all(point.completion_percentage == 0.0 for point in trend.series[0].points[1:])
    assert all(point.distribution_percentage == 0.0 for point in trend.series[0].points[1:])
    assert trend.series[1].points[0].completion_percentage == pytest.approx(100.0)
    assert trend.series[1].points[0].distribution_percentage == pytest.approx(50.0)
    assert trend.series[1].points[-1].completion_percentage == pytest.approx(100.0)
    assert trend.series[1].points[-1].distribution_percentage == pytest.approx(100.0)
    assert all(point.recorded_days == 0 for point in trend.series[1].points[1:-1])


def test_cumulative_trend_uses_midmonth_and_month_end_checkpoints(
    task_svc: TaskService,
    entry_repo: EntryRepository,
    stats_svc: StatsService,
) -> None:
    first = task_svc.create_task("First", "First")
    second = task_svc.create_task("Second", "Second")
    reference_date = date(2024, 3, 20)
    first_start = date(2023, 4, 1)
    entry_repo.upsert(first.id, first_start, True)
    entry_repo.upsert(first.id, date(2023, 4, 20), False)
    entry_repo.upsert(second.id, first_start, True)
    entry_repo.upsert(second.id, reference_date, True)

    trend = stats_svc.compute_insights_trend(
        [first.id, second.id],
        reference_date,
        reference_date.year,
        InsightsTrendMode.CUMULATIVE,
    )

    assert trend.mode is InsightsTrendMode.CUMULATIVE
    assert trend.period_count == 24
    assert all(len(series.points) == 24 for series in trend.series)
    expected_end_dates = [
        checkpoint
        for month_start, month_end in [
            (date(2023, 4, 1), date(2023, 4, 30)),
            (date(2023, 5, 1), date(2023, 5, 31)),
            (date(2023, 6, 1), date(2023, 6, 30)),
            (date(2023, 7, 1), date(2023, 7, 31)),
            (date(2023, 8, 1), date(2023, 8, 31)),
            (date(2023, 9, 1), date(2023, 9, 30)),
            (date(2023, 10, 1), date(2023, 10, 31)),
            (date(2023, 11, 1), date(2023, 11, 30)),
            (date(2023, 12, 1), date(2023, 12, 31)),
            (date(2024, 1, 1), date(2024, 1, 31)),
            (date(2024, 2, 1), date(2024, 2, 29)),
            (date(2024, 3, 1), date(2024, 3, 31)),
        ]
        for checkpoint in (date(month_start.year, month_start.month, 15), month_end)
    ]
    for series in trend.series:
        assert all(point.start_date == first_start for point in series.points)
        assert [point.end_date for point in series.points] == expected_end_dates

    assert trend.series[0].points[0].completed_days == 1
    assert trend.series[0].points[0].recorded_days == 1
    assert trend.series[0].points[1].recorded_days == 2
    assert trend.series[0].points[-1].distribution_percentage == pytest.approx(100 / 3)
    assert trend.series[1].points[-1].completed_days == 2
    assert trend.series[1].points[-1].distribution_percentage == pytest.approx(200 / 3)


@pytest.mark.parametrize(
    ("mode", "expected_start_dates", "expected_end_dates"),
    [
        (
            InsightsTrendMode.MONTHLY,
            [date(2023, month, 1) for month in range(1, 13)],
            [
                date(2023, month + 1, 1) - timedelta(days=1) if month < 12 else date(2023, 12, 31)
                for month in range(1, 13)
            ],
        ),
        (
            InsightsTrendMode.CUMULATIVE,
            [date(2023, 1, 1)] * 24,
            [
                checkpoint
                for month in range(1, 13)
                for checkpoint in (
                    date(2023, month, 15),
                    date(2023, month + 1, 1) - timedelta(days=1)
                    if month < 12
                    else date(2023, 12, 31),
                )
            ],
        ),
    ],
)
def test_previous_year_trend_uses_january_through_december(
    task_svc: TaskService,
    entry_repo: EntryRepository,
    stats_svc: StatsService,
    mode: InsightsTrendMode,
    expected_start_dates: list[date],
    expected_end_dates: list[date],
) -> None:
    task = task_svc.create_task("Earlier year", "Earlier year")
    entry_repo.upsert(task.id, date(2023, 1, 5), True)
    entry_repo.upsert(task.id, date(2023, 12, 20), True)

    trend = stats_svc.compute_insights_trend(
        [task.id],
        date(2024, 3, 20),
        2023,
        mode,
    )

    assert trend.year == 2023
    assert trend.available_years == (2024, 2023)
    assert [point.start_date for point in trend.series[0].points] == expected_start_dates
    assert [point.end_date for point in trend.series[0].points] == expected_end_dates
    assert trend.series[0].points[-1].completed_days == (
        1 if mode is InsightsTrendMode.MONTHLY else 2
    )


def test_trend_rejects_a_future_year(
    task_svc: TaskService,
    stats_svc: StatsService,
) -> None:
    task = task_svc.create_task("Valid", "Valid")

    with pytest.raises(InvalidDateError, match="after the current year"):
        stats_svc.compute_insights_trend(
            [task.id],
            date(2024, 3, 20),
            2025,
            InsightsTrendMode.MONTHLY,
        )


def test_insights_rejects_invalid_ranges_and_commitment_selections(
    task_svc: TaskService,
    stats_svc: StatsService,
) -> None:
    task = task_svc.create_task("Valid", "Valid")

    with pytest.raises(InvalidDateError, match="after end"):
        stats_svc.compute_insights_summary(
            [task.id],
            date(2026, 1, 2),
            date(2026, 1, 1),
        )
    with pytest.raises(InvalidDateError, match="3660"):
        stats_svc.compute_insights_summary(
            [task.id],
            date(2010, 1, 1),
            date(2026, 1, 1),
        )
    with pytest.raises(InvalidTaskError, match="At least one"):
        stats_svc.compute_insights_summary([], date(2026, 1, 1), date(2026, 1, 1))
    with pytest.raises(InvalidTaskError, match="only be selected once"):
        stats_svc.compute_insights_summary(
            [task.id, task.id],
            date(2026, 1, 1),
            date(2026, 1, 1),
        )
    with pytest.raises(TaskNotFoundError, match="999"):
        stats_svc.compute_insights_summary([999], date(2026, 1, 1), date(2026, 1, 1))


def test_insights_does_not_translate_unexpected_database_failures(
    monkeypatch: pytest.MonkeyPatch,
    task_repo: TaskRepository,
    entry_repo: EntryRepository,
) -> None:
    task = task_repo.create("Exercise", "Move")
    service = StatsService(task_repo, entry_repo)

    def fail_query(*_args: object) -> tuple[dict[int, tuple[int, int]], int]:
        raise sqlite3.OperationalError("simulated query failure")

    monkeypatch.setattr(entry_repo, "get_insights_summary_counts", fail_query)

    with pytest.raises(sqlite3.OperationalError, match="simulated query failure"):
        service.compute_insights_summary([task.id], date(2026, 1, 1), date(2026, 1, 1))

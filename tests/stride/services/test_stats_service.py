"""Tests for StatsService."""

from __future__ import annotations

from datetime import date, datetime, timedelta

from momentum.storage.database import Database
from momentum.stride.domain.enums import TrackingMethod
from momentum.stride.domain.models import Journey
from momentum.stride.repositories.journey_repository import JourneyRepository
from momentum.stride.repositories.milestone_repository import MilestoneRepository
from momentum.stride.repositories.progress_repository import ProgressRepository
from momentum.stride.services.journey_service import JourneyService
from momentum.stride.services.progress_service import ProgressService
from momentum.stride.services.stats_service import DateRange, StatsService


def _progress_service(db: Database) -> ProgressService:
    """Create a ProgressService using the application database."""
    return ProgressService(
        JourneyRepository(db.conn),
        MilestoneRepository(db.conn),
        ProgressRepository(db.conn),
        db.transaction,
    )


def _stats_service(db: Database) -> StatsService:
    """Create a StatsService using the application repositories."""
    return StatsService(
        JourneyRepository(db.conn),
        MilestoneRepository(db.conn),
        ProgressRepository(db.conn),
    )


def _journey_service(db: Database) -> JourneyService:
    """Create a JourneyService using the application database."""
    return JourneyService(
        JourneyRepository(db.conn),
        MilestoneRepository(db.conn),
        db.transaction,
    )


class TestProgressCalculation:
    def test_quantity_progress(
        self,
        running_journey: Journey,
        db: Database,
    ) -> None:
        progress_service = _progress_service(db)
        stats_service = _stats_service(db)

        for value in (5.2, 8.4, 6.1):
            progress_service.log_progress(
                running_journey.id,
                value=value,
            )

        progress = stats_service.get_progress(
            running_journey,
        )

        assert abs(progress.current_value - 19.7) < 0.001
        assert abs(progress.remaining - 980.3) < 0.001
        assert abs(progress.percentage - 1.97) < 0.01

    def test_count_progress(
        self,
        gym_journey: Journey,
        db: Database,
    ) -> None:
        progress_service = _progress_service(db)
        stats_service = _stats_service(db)

        for _ in range(5):
            progress_service.log_progress(
                gym_journey.id,
            )

        progress = stats_service.get_progress(
            gym_journey,
        )

        assert progress.current_value == 5.0
        assert progress.target_value == 200.0
        assert abs(progress.percentage - 2.5) < 0.01

    def test_duration_progress(
        self,
        study_journey: Journey,
        db: Database,
    ) -> None:
        progress_service = _progress_service(db)
        stats_service = _stats_service(db)

        for seconds in (5400, 7200, 2700):
            progress_service.log_progress(
                study_journey.id,
                duration_seconds=seconds,
            )

        progress = stats_service.get_progress(
            study_journey,
        )

        assert abs(progress.current_value - 4.25) < 0.01
        assert abs(progress.remaining - 95.75) < 0.01

    def test_milestone_progress(
        self,
        milestone_journey: Journey,
        db: Database,
    ) -> None:
        milestone_repository = MilestoneRepository(db.conn)
        progress_service = _progress_service(db)
        stats_service = _stats_service(db)

        milestones = [
            milestone_repository.create(
                journey_id=milestone_journey.id,
                name=name,
            )
            for name in ("A", "B", "C", "D")
        ]

        progress_service.complete_milestone(
            milestone_journey.id,
            milestones[0].id,
        )
        progress_service.complete_milestone(
            milestone_journey.id,
            milestones[1].id,
        )

        progress = stats_service.get_progress(
            milestone_journey,
        )

        assert progress.milestones_completed == 2
        assert progress.milestones_total == 4
        assert abs(progress.percentage - 50.0) < 0.1

    def test_progress_reflects_deletion(
        self,
        running_journey: Journey,
        db: Database,
    ) -> None:
        progress_service = _progress_service(db)
        stats_service = _stats_service(db)

        event = progress_service.log_progress(
            running_journey.id,
            value=500.0,
        )

        assert (
            stats_service.get_progress(
                running_journey,
            ).current_value
            == 500.0
        )

        progress_service.delete_event(event.id)

        assert (
            stats_service.get_progress(
                running_journey,
            ).current_value
            == 0.0
        )


class TestStreaks:
    def test_consecutive_streak(
        self,
        running_journey: Journey,
        db: Database,
    ) -> None:
        progress_service = _progress_service(db)
        stats_service = _stats_service(db)

        today = date.today()

        for offset in range(4, -1, -1):
            day = today - timedelta(days=offset)

            progress_service.log_progress(
                running_journey.id,
                value=5.0,
                occurred_at=datetime(
                    day.year,
                    day.month,
                    day.day,
                ),
            )

        streak = stats_service.get_streak(
            running_journey,
        )

        assert streak.current_streak == 5
        assert streak.longest_streak == 5
        assert streak.active_days == 5

    def test_broken_streak(
        self,
        running_journey: Journey,
        db: Database,
    ) -> None:
        progress_service = _progress_service(db)
        stats_service = _stats_service(db)

        today = date.today()

        for offset in (6, 5, 2, 1, 0):
            day = today - timedelta(days=offset)

            progress_service.log_progress(
                running_journey.id,
                value=5.0,
                occurred_at=datetime(
                    day.year,
                    day.month,
                    day.day,
                ),
            )

        streak = stats_service.get_streak(
            running_journey,
        )

        assert streak.current_streak == 3
        assert streak.longest_streak == 3
        assert streak.active_days == 5

    def test_no_events_zero_streak(
        self,
        running_journey: Journey,
        db: Database,
    ) -> None:
        stats_service = _stats_service(db)

        streak = stats_service.get_streak(
            running_journey,
        )

        assert streak.current_streak == 0
        assert streak.longest_streak == 0
        assert streak.active_days == 0


class TestPace:
    def test_pace_calculated(
        self,
        running_journey: Journey,
        db: Database,
    ) -> None:
        progress_service = _progress_service(db)
        stats_service = _stats_service(db)

        progress_service.log_progress(
            running_journey.id,
            value=100.0,
        )

        progress = stats_service.get_progress(
            running_journey,
        )
        pace = stats_service.get_pace(
            running_journey,
            progress,
        )

        assert pace.days_elapsed >= 1
        assert pace.actual_daily_rate > 0

    def test_target_date_produces_required_rate(
        self,
        db: Database,
    ) -> None:
        journey_service = _journey_service(db)
        progress_service = _progress_service(db)
        stats_service = _stats_service(db)

        today = date.today()

        journey = journey_service.create_journey(
            name="Dated Journey",
            tracking_method=TrackingMethod.QUANTITY,
            target_value=100.0,
            unit="km",
            start_date=today,
            target_date=today + timedelta(days=100),
        )

        progress_service.log_progress(
            journey.id,
            value=10.0,
        )

        progress = stats_service.get_progress(journey)
        pace = stats_service.get_pace(journey, progress)

        assert pace.days_remaining is not None
        assert pace.days_remaining == 100
        assert pace.required_daily_rate is not None
        assert pace.required_daily_rate == 0.9
        assert pace.actual_daily_rate > 0
        assert pace.is_on_pace is not None

    def test_completed_target_requires_no_remaining_rate(
        self,
        db: Database,
    ) -> None:
        journey_service = _journey_service(db)
        progress_service = _progress_service(db)
        stats_service = _stats_service(db)

        today = date.today()

        journey = journey_service.create_journey(
            name="Complete",
            tracking_method=TrackingMethod.QUANTITY,
            target_value=10.0,
            unit="km",
            start_date=today - timedelta(days=10),
            target_date=today,
        )

        progress_service.log_progress(
            journey.id,
            value=10.0,
        )

        progress = stats_service.get_progress(journey)
        pace = stats_service.get_pace(journey, progress)

        assert progress.remaining == 0.0
        assert pace.required_daily_rate == 0
        assert pace.is_on_pace is True


class TestAggregateStats:
    def test_stats_all_time(
        self,
        running_journey: Journey,
        db: Database,
    ) -> None:
        progress_service = _progress_service(db)
        stats_service = _stats_service(db)

        for value in (5.0, 10.0, 15.0):
            progress_service.log_progress(
                running_journey.id,
                value=value,
                occurred_at=datetime(2026, 9, 1),
            )

        stats = stats_service.get_stats(
            running_journey,
        )

        assert stats.total_value == 30.0
        assert stats.event_count == 3

    def test_stats_date_range(
        self,
        running_journey: Journey,
        db: Database,
    ) -> None:
        progress_service = _progress_service(db)
        stats_service = _stats_service(db)

        progress_service.log_progress(
            running_journey.id,
            value=10.0,
            occurred_at=datetime(2026, 9, 1),
        )
        progress_service.log_progress(
            running_journey.id,
            value=20.0,
            occurred_at=datetime(2026, 10, 1),
        )

        date_range = DateRange.custom(
            date(2026, 9, 1),
            date(2026, 9, 30),
        )

        stats = stats_service.get_stats(
            running_journey,
            date_range,
        )

        assert stats.total_value == 10.0
        assert stats.event_count == 1

    def test_best_day(
        self,
        running_journey: Journey,
        db: Database,
    ) -> None:
        progress_service = _progress_service(db)
        stats_service = _stats_service(db)

        progress_service.log_progress(
            running_journey.id,
            value=5.0,
            occurred_at=datetime(2026, 9, 1),
        )
        progress_service.log_progress(
            running_journey.id,
            value=15.0,
            occurred_at=datetime(2026, 9, 2),
        )
        progress_service.log_progress(
            running_journey.id,
            value=8.0,
            occurred_at=datetime(2026, 9, 3),
        )

        stats = stats_service.get_stats(
            running_journey,
        )

        assert stats.best_day_value == 15.0
        assert stats.best_day_date == date(2026, 9, 2)

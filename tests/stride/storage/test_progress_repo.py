"""Tests for the ProgressRepository."""

from __future__ import annotations

from datetime import date, datetime, timedelta

import pytest

from momentum.storage.database import Database
from momentum.stride.domain.enums import EventType
from momentum.stride.domain.errors import ProgressEventNotFound
from momentum.stride.domain.models import Journey
from momentum.stride.repositories.milestone_repository import MilestoneRepository
from momentum.stride.repositories.progress_repository import ProgressRepository


class TestProgressRepository:
    def test_create_and_get(
        self,
        progress_repo: ProgressRepository,
        running_journey: Journey,
    ) -> None:
        event = progress_repo.create(
            journey_id=running_journey.id,
            event_type=EventType.PROGRESS,
            value=5.2,
            occurred_at=datetime(2026, 9, 1),
        )

        fetched = progress_repo.get_by_id(event.id)

        assert fetched.id == event.id
        assert fetched.journey_id == running_journey.id
        assert fetched.value == 5.2
        assert fetched.duration_seconds is None
        assert fetched.event_type == EventType.PROGRESS

    def test_create_duration_event(
        self,
        progress_repo: ProgressRepository,
        study_journey: Journey,
    ) -> None:
        event = progress_repo.create(
            journey_id=study_journey.id,
            event_type=EventType.PROGRESS,
            value=None,
            duration_seconds=5400,
            occurred_at=datetime(2026, 9, 1),
        )

        fetched = progress_repo.get_by_id(event.id)

        assert fetched.value is None
        assert fetched.duration_seconds == 5400

    def test_create_milestone_completion_event(
        self,
        progress_repo: ProgressRepository,
        milestone_repo: MilestoneRepository,
        milestone_journey: Journey,
    ) -> None:
        milestone = milestone_repo.create(
            journey_id=milestone_journey.id,
            name="First milestone",
            description="",
            position=1,
        )

        event = progress_repo.create(
            journey_id=milestone_journey.id,
            milestone_id=milestone.id,
            event_type=EventType.MILESTONE_COMPLETED,
            value=1.0,
            duration_seconds=None,
            occurred_at=datetime.today(),
            note=None,
        )

        assert event.id > 0
        assert event.journey_id == milestone_journey.id
        assert event.milestone_id == milestone.id
        assert event.event_type == EventType.MILESTONE_COMPLETED
        assert event.value == 1.0
        assert event.duration_seconds is None

    def test_get_not_found(
        self,
        progress_repo: ProgressRepository,
    ) -> None:
        with pytest.raises(ProgressEventNotFound):
            progress_repo.get_by_id(99999)

    def test_sum_value(
        self,
        progress_repo: ProgressRepository,
        running_journey: Journey,
    ) -> None:
        for index, value in enumerate((5.2, 8.4, 6.1)):
            progress_repo.create(
                journey_id=running_journey.id,
                event_type=EventType.PROGRESS,
                value=value,
                occurred_at=datetime(2026, 9, 1) + timedelta(days=index),
            )

        total = progress_repo.sum_value_for_journey(
            running_journey.id,
        )

        assert abs(total - 19.7) < 0.001

    def test_sum_value_ignores_milestone_completion_events(
        self,
        progress_repo: ProgressRepository,
        milestone_repo: MilestoneRepository,
        milestone_journey: Journey,
    ) -> None:
        milestone = milestone_repo.create(
            journey_id=milestone_journey.id,
            name="First milestone",
            description="",
            position=1,
        )

        progress_repo.create(
            journey_id=milestone_journey.id,
            milestone_id=None,
            event_type=EventType.PROGRESS,
            value=10.0,
            duration_seconds=None,
            occurred_at=datetime.today(),
            note=None,
        )

        progress_repo.create(
            journey_id=milestone_journey.id,
            milestone_id=milestone.id,
            event_type=EventType.MILESTONE_COMPLETED,
            value=1.0,
            duration_seconds=None,
            occurred_at=datetime.today(),
            note=None,
        )

        assert progress_repo.sum_value_for_journey(milestone_journey.id) == 10.0

    def test_sum_duration(
        self,
        progress_repo: ProgressRepository,
        study_journey: Journey,
    ) -> None:
        for seconds in (5400, 7200, 2700):
            progress_repo.create(
                journey_id=study_journey.id,
                event_type=EventType.PROGRESS,
                value=None,
                duration_seconds=seconds,
                occurred_at=datetime(2026, 9, 1),
            )

        total = progress_repo.sum_duration_for_journey(
            study_journey.id,
        )

        assert total == 15300

    def test_list_for_journey(
        self,
        progress_repo: ProgressRepository,
        running_journey: Journey,
    ) -> None:
        for value in (1.0, 2.0, 3.0):
            progress_repo.create(
                journey_id=running_journey.id,
                event_type=EventType.PROGRESS,
                value=value,
                occurred_at=datetime(2026, 9, 1),
            )

        events = progress_repo.list_for_journey(
            running_journey.id,
        )

        assert len(events) == 3

    def test_date_range_filter(
        self,
        progress_repo: ProgressRepository,
        running_journey: Journey,
    ) -> None:
        progress_repo.create(
            journey_id=running_journey.id,
            event_type=EventType.PROGRESS,
            value=5.0,
            occurred_at=datetime(2026, 9, 1),
        )
        progress_repo.create(
            journey_id=running_journey.id,
            event_type=EventType.PROGRESS,
            value=5.0,
            occurred_at=datetime(2026, 10, 1),
        )

        events = progress_repo.list_for_journey(
            running_journey.id,
            start_date=date(2026, 9, 1),
            end_date=date(2026, 9, 30),
        )

        assert len(events) == 1
        assert events[0].occurred_at.date() == date(2026, 9, 1)

    def test_start_date_filter_is_open_ended(
        self,
        progress_repo: ProgressRepository,
        running_journey: Journey,
    ) -> None:
        progress_repo.create(
            journey_id=running_journey.id,
            event_type=EventType.PROGRESS,
            value=5.0,
            occurred_at=datetime(2026, 8, 1),
        )
        progress_repo.create(
            journey_id=running_journey.id,
            event_type=EventType.PROGRESS,
            value=10.0,
            occurred_at=datetime(2026, 9, 1),
        )

        events = progress_repo.list_for_journey(
            running_journey.id,
            start_date=date(2026, 9, 1),
        )

        assert len(events) == 1
        assert events[0].value == 10.0

    def test_end_date_filter_is_open_ended(
        self,
        progress_repo: ProgressRepository,
        running_journey: Journey,
    ) -> None:
        progress_repo.create(
            journey_id=running_journey.id,
            event_type=EventType.PROGRESS,
            value=5.0,
            occurred_at=datetime(2026, 8, 1),
        )
        progress_repo.create(
            journey_id=running_journey.id,
            event_type=EventType.PROGRESS,
            value=10.0,
            occurred_at=datetime(2026, 9, 1),
        )

        events = progress_repo.list_for_journey(
            running_journey.id,
            end_date=date(2026, 8, 31),
        )

        assert len(events) == 1
        assert events[0].value == 5.0

    def test_delete_event(
        self,
        progress_repo: ProgressRepository,
        running_journey: Journey,
    ) -> None:
        event = progress_repo.create(
            journey_id=running_journey.id,
            event_type=EventType.PROGRESS,
            value=5.0,
            occurred_at=datetime(2026, 9, 1),
        )

        progress_repo.delete(event.id)

        with pytest.raises(ProgressEventNotFound):
            progress_repo.get_by_id(event.id)

    def test_delete_not_found(
        self,
        progress_repo: ProgressRepository,
    ) -> None:
        with pytest.raises(ProgressEventNotFound):
            progress_repo.delete(99999)

    def test_sum_reflects_deletion(
        self,
        progress_repo: ProgressRepository,
        running_journey: Journey,
    ) -> None:
        event = progress_repo.create(
            journey_id=running_journey.id,
            event_type=EventType.PROGRESS,
            value=10.0,
            occurred_at=datetime(2026, 9, 1),
        )
        progress_repo.create(
            journey_id=running_journey.id,
            event_type=EventType.PROGRESS,
            value=5.0,
            occurred_at=datetime(2026, 9, 2),
        )

        assert (
            progress_repo.sum_value_for_journey(
                running_journey.id,
            )
            == 15.0
        )

        progress_repo.delete(event.id)

        assert (
            progress_repo.sum_value_for_journey(
                running_journey.id,
            )
            == 5.0
        )

    def test_daily_totals(
        self,
        progress_repo: ProgressRepository,
        running_journey: Journey,
    ) -> None:
        progress_repo.create(
            journey_id=running_journey.id,
            event_type=EventType.PROGRESS,
            value=5.0,
            occurred_at=datetime(2026, 9, 1, 8, 0),
        )
        progress_repo.create(
            journey_id=running_journey.id,
            event_type=EventType.PROGRESS,
            value=3.0,
            occurred_at=datetime(2026, 9, 1, 17, 0),
        )
        progress_repo.create(
            journey_id=running_journey.id,
            event_type=EventType.PROGRESS,
            value=7.0,
            occurred_at=datetime(2026, 9, 2),
        )

        daily = progress_repo.daily_totals_for_journey(
            running_journey.id,
        )

        assert len(daily) == 2

        sep1 = next(item for item in daily if item.date == date(2026, 9, 1))

        assert sep1.total_value == 8.0

    def test_active_days_count(
        self,
        progress_repo: ProgressRepository,
        running_journey: Journey,
    ) -> None:
        for day in range(1, 6):
            progress_repo.create(
                journey_id=running_journey.id,
                event_type=EventType.PROGRESS,
                value=float(day),
                occurred_at=datetime(2026, 9, day),
            )

        count = progress_repo.active_days_count(
            running_journey.id,
        )

        assert count == 5

    def test_active_days_count_uses_distinct_dates(
        self,
        progress_repo: ProgressRepository,
        running_journey: Journey,
    ) -> None:
        for hour in (8, 12, 18):
            progress_repo.create(
                journey_id=running_journey.id,
                event_type=EventType.PROGRESS,
                value=1.0,
                occurred_at=datetime(2026, 9, 1, hour),
            )

        count = progress_repo.active_days_count(
            running_journey.id,
        )

        assert count == 1

    def test_update_event(
        self,
        progress_repo: ProgressRepository,
        running_journey: Journey,
    ) -> None:
        event = progress_repo.create(
            journey_id=running_journey.id,
            event_type=EventType.PROGRESS,
            value=5.0,
            occurred_at=datetime(2026, 9, 1),
        )

        updated = progress_repo.update(
            event.id,
            value=8.0,
            note="Corrected",
        )

        assert updated.value == 8.0
        assert updated.note == "Corrected"

    def test_update_not_found(
        self,
        progress_repo: ProgressRepository,
    ) -> None:
        with pytest.raises(ProgressEventNotFound):
            progress_repo.update(
                99999,
                value=8.0,
            )

    def test_clear_note(
        self,
        progress_repo: ProgressRepository,
        running_journey: Journey,
    ) -> None:
        event = progress_repo.create(
            journey_id=running_journey.id,
            event_type=EventType.PROGRESS,
            value=5.0,
            note="Morning run",
            occurred_at=datetime(2026, 9, 1),
        )

        updated = progress_repo.update(
            event.id,
            clear_note=True,
        )

        assert updated.note is None

    def test_transaction_rolls_back_repository_changes(
        self,
        progress_repo: ProgressRepository,
        running_journey: Journey,
        db: Database,
    ) -> None:
        with (
            pytest.raises(RuntimeError, match="Force transaction rollback"),
            db.transaction(),
        ):
            progress_repo.create(
                journey_id=running_journey.id,
                event_type=EventType.PROGRESS,
                value=5.0,
                occurred_at=datetime(2026, 9, 1),
            )

            raise RuntimeError("Force transaction rollback")

        assert (
            progress_repo.list_for_journey(
                running_journey.id,
            )
            == []
        )

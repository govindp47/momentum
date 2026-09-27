"""Tests for ProgressService."""

from __future__ import annotations

from datetime import date, datetime

import pytest

from momentum.storage.database import Database
from momentum.stride.domain.enums import EventType, JourneyStatus, MilestoneStatus
from momentum.stride.domain.errors import (
    InvalidDuration,
    InvalidMilestoneState,
    InvalidProgressValue,
    JourneyArchived,
    JourneyCompleted,
    JourneyPaused,
    MilestoneNotBelongingToJourney,
    ProgressEventNotFound,
)
from momentum.stride.domain.models import Journey
from momentum.stride.repositories.journey_repository import JourneyRepository
from momentum.stride.repositories.milestone_repository import MilestoneRepository
from momentum.stride.repositories.progress_repository import ProgressRepository
from momentum.stride.services.journey_service import JourneyService
from momentum.stride.services.progress_service import ProgressService


def _progress_service(db: Database) -> ProgressService:
    """Create a ProgressService using the application database abstraction."""
    connection = db.conn

    return ProgressService(
        JourneyRepository(connection),
        MilestoneRepository(connection),
        ProgressRepository(connection),
        db.transaction,
    )


def _journey_service(db: Database) -> JourneyService:
    """Create a JourneyService using the application database abstraction."""
    connection = db.conn

    return JourneyService(
        JourneyRepository(connection),
        MilestoneRepository(connection),
        db.transaction,
    )


class TestCountJourney:
    def test_log_adds_one(
        self,
        gym_journey: Journey,
        db: Database,
    ) -> None:
        service = _progress_service(db)

        event = service.log_progress(gym_journey.id)

        assert event.value == 1.0
        assert event.duration_seconds is None
        assert event.event_type == EventType.PROGRESS

    def test_multiple_logs_aggregate(
        self,
        gym_journey: Journey,
        db: Database,
    ) -> None:
        service = _progress_service(db)
        repository = ProgressRepository(db.conn)

        for _ in range(3):
            service.log_progress(gym_journey.id)

        assert repository.sum_value_for_journey(gym_journey.id) == 3.0

    def test_count_journey_rejects_custom_value(
        self,
        gym_journey: Journey,
        db: Database,
    ) -> None:
        service = _progress_service(db)

        with pytest.raises(InvalidProgressValue):
            service.log_progress(
                gym_journey.id,
                value=2.0,
            )

    def test_paused_journey_rejects_progress(
        self,
        gym_journey: Journey,
        db: Database,
    ) -> None:
        journey_service = _journey_service(db)
        journey_service.pause(gym_journey.name)

        service = _progress_service(db)

        with pytest.raises(JourneyPaused):
            service.log_progress(gym_journey.id)

    def test_completed_journey_rejects_progress(
        self,
        gym_journey: Journey,
        db: Database,
    ) -> None:
        journey_service = _journey_service(db)
        journey_service.complete(gym_journey.name)

        service = _progress_service(db)

        with pytest.raises(JourneyCompleted):
            service.log_progress(gym_journey.id)

    def test_archived_journey_rejects_progress(
        self,
        gym_journey: Journey,
        db: Database,
    ) -> None:
        journey_service = _journey_service(db)
        journey_service.archive(gym_journey.name)

        service = _progress_service(db)

        with pytest.raises(JourneyArchived):
            service.log_progress(gym_journey.id)


class TestQuantityJourney:
    def test_log_quantity(
        self,
        running_journey: Journey,
        db: Database,
    ) -> None:
        service = _progress_service(db)

        event = service.log_progress(
            running_journey.id,
            value=7.4,
        )

        assert event.value is not None
        assert abs(event.value - 7.4) < 0.001
        assert event.duration_seconds is None

    def test_three_events_sum_correctly(
        self,
        running_journey: Journey,
        db: Database,
    ) -> None:
        service = _progress_service(db)
        repository = ProgressRepository(db.conn)

        for value in (5.2, 8.4, 6.1):
            service.log_progress(
                running_journey.id,
                value=value,
            )

        total = repository.sum_value_for_journey(
            running_journey.id,
        )

        assert abs(total - 19.7) < 0.001

    def test_zero_value_raises(
        self,
        running_journey: Journey,
        db: Database,
    ) -> None:
        service = _progress_service(db)

        with pytest.raises(InvalidProgressValue):
            service.log_progress(
                running_journey.id,
                value=0.0,
            )

    def test_negative_value_raises(
        self,
        running_journey: Journey,
        db: Database,
    ) -> None:
        service = _progress_service(db)

        with pytest.raises(InvalidProgressValue):
            service.log_progress(
                running_journey.id,
                value=-1.0,
            )

    def test_missing_value_raises(
        self,
        running_journey: Journey,
        db: Database,
    ) -> None:
        service = _progress_service(db)

        with pytest.raises(InvalidProgressValue):
            service.log_progress(running_journey.id)


class TestDurationJourney:
    def test_log_duration(
        self,
        study_journey: Journey,
        db: Database,
    ) -> None:
        service = _progress_service(db)

        event = service.log_progress(
            study_journey.id,
            duration_seconds=5400,
        )

        assert event.value is None
        assert event.duration_seconds == 5400
        assert event.event_type == EventType.PROGRESS

    def test_three_sessions_total(
        self,
        study_journey: Journey,
        db: Database,
    ) -> None:
        service = _progress_service(db)
        repository = ProgressRepository(db.conn)

        for seconds in (5400, 7200, 2700):
            service.log_progress(
                study_journey.id,
                duration_seconds=seconds,
            )

        assert (
            repository.sum_duration_for_journey(
                study_journey.id,
            )
            == 15300
        )

    def test_missing_duration_raises(
        self,
        study_journey: Journey,
        db: Database,
    ) -> None:
        service = _progress_service(db)

        with pytest.raises(InvalidDuration):
            service.log_progress(study_journey.id)

    def test_zero_duration_is_rejected(
        self,
        study_journey: Journey,
        db: Database,
    ) -> None:
        service = _progress_service(db)

        with pytest.raises(InvalidDuration):
            service.log_progress(
                study_journey.id,
                duration_seconds=0,
            )


class TestMilestoneJourney:
    def test_complete_milestone_creates_completion_event(
        self,
        milestone_journey: Journey,
        db: Database,
    ) -> None:
        milestone_repository = MilestoneRepository(db.conn)

        milestone = milestone_repository.create(
            journey_id=milestone_journey.id,
            name="Networking",
        )

        service = _progress_service(db)

        event = service.complete_milestone(
            milestone_journey.id,
            milestone.id,
        )

        updated = milestone_repository.get_by_id(
            milestone.id,
        )

        progress_repository = ProgressRepository(db.conn)
        completion_event = progress_repository.find_milestone_completion_event(
            milestone.id,
        )

        assert event.event_type == EventType.MILESTONE_COMPLETED
        assert event.value == 1.0
        assert event.duration_seconds is None

        assert updated.status == MilestoneStatus.COMPLETED
        assert updated.completed_at is not None

        assert completion_event is not None
        assert completion_event.id == event.id

    def test_completing_last_milestone_completes_journey(
        self,
        milestone_journey: Journey,
        db: Database,
    ) -> None:
        milestone_repository = MilestoneRepository(db.conn)
        journey_service = _journey_service(db)
        progress_service = _progress_service(db)

        milestones = [
            milestone_repository.create(
                journey_id=milestone_journey.id,
                name=name,
            )
            for name in ("A", "B", "C")
        ]

        for milestone in milestones:
            progress_service.complete_milestone(
                milestone_journey.id,
                milestone.id,
            )

        journey = journey_service.get_journey(
            milestone_journey.name,
        )

        assert journey.status == JourneyStatus.COMPLETED

    def test_completing_non_last_milestone_does_not_complete_journey(
        self,
        milestone_journey: Journey,
        db: Database,
    ) -> None:
        milestone_repository = MilestoneRepository(db.conn)
        journey_service = _journey_service(db)
        progress_service = _progress_service(db)

        first = milestone_repository.create(
            journey_id=milestone_journey.id,
            name="A",
        )

        milestone_repository.create(
            journey_id=milestone_journey.id,
            name="B",
        )

        milestone_repository.create(
            journey_id=milestone_journey.id,
            name="C",
        )

        progress_service.complete_milestone(
            milestone_journey.id,
            first.id,
        )

        journey = journey_service.get_journey(
            milestone_journey.name,
        )

        assert journey.status == JourneyStatus.ACTIVE

    def test_complete_already_completed_raises(
        self,
        milestone_journey: Journey,
        db: Database,
    ) -> None:
        milestone_repository = MilestoneRepository(db.conn)

        first = milestone_repository.create(
            journey_id=milestone_journey.id,
            name="M",
        )

        milestone_repository.create(
            journey_id=milestone_journey.id,
            name="N",
        )

        service = _progress_service(db)

        service.complete_milestone(
            milestone_journey.id,
            first.id,
        )

        with pytest.raises(InvalidMilestoneState):
            service.complete_milestone(
                milestone_journey.id,
                first.id,
            )

    def test_milestone_from_another_journey_is_rejected(
        self,
        milestone_journey: Journey,
        journey_repo: JourneyRepository,
        db: Database,
    ) -> None:
        milestone_repository = MilestoneRepository(db.conn)

        other_journey = journey_repo.create(
            name="Other",
            description="",
            tracking_method=milestone_journey.tracking_method,
            target_value=1,
            unit=None,
            start_date=milestone_journey.start_date,
        )

        milestone = milestone_repository.create(
            journey_id=other_journey.id,
            name="Other milestone",
        )

        service = _progress_service(db)

        with pytest.raises(MilestoneNotBelongingToJourney):
            service.complete_milestone(
                milestone_journey.id,
                milestone.id,
            )

    def test_reopen_milestone_removes_completion_event(
        self,
        milestone_journey: Journey,
        db: Database,
    ) -> None:
        milestone_repository = MilestoneRepository(db.conn)
        progress_repository = ProgressRepository(db.conn)

        milestone = milestone_repository.create(
            journey_id=milestone_journey.id,
            name="M",
        )

        service = _progress_service(db)

        service.complete_milestone(
            milestone_journey.id,
            milestone.id,
        )

        service.reopen_milestone(
            milestone_journey.id,
            milestone.id,
        )

        reopened = milestone_repository.get_by_id(
            milestone.id,
        )

        completion_event = progress_repository.find_milestone_completion_event(
            milestone.id,
        )

        assert reopened.status == MilestoneStatus.PENDING
        assert reopened.completed_at is None
        assert completion_event is None

    def test_reopen_completed_milestone_reopens_auto_completed_journey(
        self,
        milestone_journey: Journey,
        db: Database,
    ) -> None:
        milestone_repository = MilestoneRepository(db.conn)
        journey_service = _journey_service(db)
        progress_service = _progress_service(db)

        milestones = [
            milestone_repository.create(
                journey_id=milestone_journey.id,
                name=name,
            )
            for name in ("A", "B", "C")
        ]

        for milestone in milestones:
            progress_service.complete_milestone(
                milestone_journey.id,
                milestone.id,
            )

        completed = journey_service.get_journey(
            milestone_journey.name,
        )

        assert completed.status == JourneyStatus.COMPLETED

        progress_service.reopen_milestone(
            milestone_journey.id,
            milestones[-1].id,
        )

        reopened = journey_service.get_journey(
            milestone_journey.name,
        )

        assert reopened.status == JourneyStatus.ACTIVE


class TestHistoricalEvents:
    def test_log_historical_date(
        self,
        running_journey: Journey,
        db: Database,
    ) -> None:
        occurred_at = datetime(2026, 5, 15, 10, 0)

        service = _progress_service(db)

        event = service.log_progress(
            running_journey.id,
            value=8.0,
            occurred_at=occurred_at,
        )

        assert event.occurred_at == occurred_at
        assert event.occurred_at.date() == date(2026, 5, 15)


class TestEventEditDelete:
    def test_delete_event_reduces_aggregate(
        self,
        running_journey: Journey,
        db: Database,
    ) -> None:
        service = _progress_service(db)
        repository = ProgressRepository(db.conn)

        first = service.log_progress(
            running_journey.id,
            value=10.0,
        )

        service.log_progress(
            running_journey.id,
            value=5.0,
        )

        assert (
            repository.sum_value_for_journey(
                running_journey.id,
            )
            == 15.0
        )

        service.delete_event(first.id)

        assert (
            repository.sum_value_for_journey(
                running_journey.id,
            )
            == 5.0
        )

    def test_edit_event_updates_aggregate(
        self,
        running_journey: Journey,
        db: Database,
    ) -> None:
        service = _progress_service(db)
        repository = ProgressRepository(db.conn)

        event = service.log_progress(
            running_journey.id,
            value=10.0,
        )

        service.edit_event(
            event.id,
            value=20.0,
        )

        assert (
            repository.sum_value_for_journey(
                running_journey.id,
            )
            == 20.0
        )

    def test_delete_nonexistent_raises(
        self,
        db: Database,
    ) -> None:
        service = _progress_service(db)

        with pytest.raises(ProgressEventNotFound):
            service.delete_event(99999)

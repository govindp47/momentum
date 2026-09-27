"""Tests for JourneyService."""

from __future__ import annotations

from datetime import date

import pytest

from momentum.storage.database import Database
from momentum.stride.domain.enums import JourneyStatus, TrackingMethod
from momentum.stride.domain.errors import (
    DuplicateJourneyName,
    InvalidLifecycleTransition,
    InvalidTarget,
    JourneyArchived,
    JourneyNotFound,
    ValidationError,
)
from momentum.stride.repositories.journey_repository import JourneyRepository
from momentum.stride.repositories.milestone_repository import MilestoneRepository
from momentum.stride.services.journey_service import JourneyService


def _service(db: Database) -> JourneyService:
    """Create a JourneyService using the application's database abstraction."""
    connection = db.conn

    return JourneyService(
        JourneyRepository(connection),
        MilestoneRepository(connection),
        db.transaction,
    )


class TestJourneyServiceCreate:
    def test_create_basic_journey(self, db: Database) -> None:
        service = _service(db)

        journey = service.create_journey(
            name="Run 1000 km",
            tracking_method=TrackingMethod.QUANTITY,
            target_value=1000,
            unit="km",
        )

        assert journey.name == "Run 1000 km"
        assert journey.status == JourneyStatus.ACTIVE
        assert journey.tracking_method == TrackingMethod.QUANTITY
        assert journey.target_value == 1000.0
        assert journey.unit == "km"

    def test_create_with_description(self, db: Database) -> None:
        service = _service(db)

        journey = service.create_journey(
            name="Run",
            description="Complete a running goal",
            tracking_method=TrackingMethod.QUANTITY,
            target_value=1000,
            unit="km",
        )

        assert journey.description == "Complete a running goal"

    def test_create_with_target_date(self, db: Database) -> None:
        service = _service(db)

        journey = service.create_journey(
            name="Run",
            tracking_method=TrackingMethod.QUANTITY,
            target_value=1000,
            unit="km",
            target_date=date(2026, 12, 31),
        )

        assert journey.target_date == date(2026, 12, 31)

    def test_start_date_defaults_to_today(self, db: Database) -> None:
        service = _service(db)

        journey = service.create_journey(
            name="J",
            tracking_method=TrackingMethod.COUNT,
            target_value=10,
        )

        assert journey.start_date == date.today()

    def test_explicit_start_date_is_preserved(self, db: Database) -> None:
        service = _service(db)

        journey = service.create_journey(
            name="J",
            tracking_method=TrackingMethod.COUNT,
            target_value=10,
            start_date=date(2026, 1, 1),
        )

        assert journey.start_date == date(2026, 1, 1)

    def test_create_with_milestones(self, db: Database) -> None:
        service = _service(db)

        journey = service.create_journey(
            name="Master DS",
            tracking_method=TrackingMethod.MILESTONE,
            target_value=3,
            milestone_names=[
                "Networking",
                "Replication",
                "Consistency",
            ],
        )

        milestones = service.get_milestones(journey)

        assert len(milestones) == 3
        assert [milestone.name for milestone in milestones] == [
            "Networking",
            "Replication",
            "Consistency",
        ]
        assert [milestone.position for milestone in milestones] == [0, 1, 2]

    def test_duplicate_name_raises(self, db: Database) -> None:
        service = _service(db)

        service.create_journey(
            name="Unique",
            tracking_method=TrackingMethod.COUNT,
            target_value=10,
        )

        with pytest.raises(DuplicateJourneyName):
            service.create_journey(
                name="Unique",
                tracking_method=TrackingMethod.COUNT,
                target_value=10,
            )

    def test_empty_name_raises(self, db: Database) -> None:
        service = _service(db)

        with pytest.raises(ValidationError):
            service.create_journey(
                name="",
                tracking_method=TrackingMethod.COUNT,
                target_value=10,
            )

    def test_whitespace_name_raises(self, db: Database) -> None:
        service = _service(db)

        with pytest.raises(ValidationError):
            service.create_journey(
                name="   ",
                tracking_method=TrackingMethod.COUNT,
                target_value=10,
            )

    def test_zero_target_raises(self, db: Database) -> None:
        service = _service(db)

        with pytest.raises(InvalidTarget):
            service.create_journey(
                name="J",
                tracking_method=TrackingMethod.COUNT,
                target_value=0,
            )

    def test_negative_target_raises(self, db: Database) -> None:
        service = _service(db)

        with pytest.raises(InvalidTarget):
            service.create_journey(
                name="J",
                tracking_method=TrackingMethod.COUNT,
                target_value=-1,
            )


class TestJourneyServiceLifecycle:
    def test_pause_active_journey(self, db: Database) -> None:
        service = _service(db)

        journey = service.create_journey(
            name="J",
            tracking_method=TrackingMethod.COUNT,
            target_value=10,
        )

        updated = service.pause(journey.name)

        assert updated.status == JourneyStatus.PAUSED

    def test_resume_paused_journey(self, db: Database) -> None:
        service = _service(db)

        journey = service.create_journey(
            name="J",
            tracking_method=TrackingMethod.COUNT,
            target_value=10,
        )

        service.pause(journey.name)
        updated = service.resume(journey.name)

        assert updated.status == JourneyStatus.ACTIVE

    def test_complete_active_journey(self, db: Database) -> None:
        service = _service(db)

        journey = service.create_journey(
            name="J",
            tracking_method=TrackingMethod.COUNT,
            target_value=10,
        )

        updated = service.complete(journey.name)

        assert updated.status == JourneyStatus.COMPLETED

    def test_archive_active_journey(self, db: Database) -> None:
        service = _service(db)

        journey = service.create_journey(
            name="J",
            tracking_method=TrackingMethod.COUNT,
            target_value=10,
        )

        updated = service.archive(journey.name)

        assert updated.status == JourneyStatus.ARCHIVED

    def test_pause_then_archive(self, db: Database) -> None:
        service = _service(db)

        journey = service.create_journey(
            name="J",
            tracking_method=TrackingMethod.COUNT,
            target_value=10,
        )

        service.pause(journey.name)
        updated = service.archive(journey.name)

        assert updated.status == JourneyStatus.ARCHIVED

    def test_complete_then_reopen(self, db: Database) -> None:
        service = _service(db)

        journey = service.create_journey(
            name="J",
            tracking_method=TrackingMethod.COUNT,
            target_value=10,
        )

        service.complete(journey.name)
        updated = service.reopen(journey.name)

        assert updated.status == JourneyStatus.ACTIVE

    def test_complete_then_archive(self, db: Database) -> None:
        service = _service(db)

        journey = service.create_journey(
            name="J",
            tracking_method=TrackingMethod.COUNT,
            target_value=10,
        )

        service.complete(journey.name)
        updated = service.archive(journey.name)

        assert updated.status == JourneyStatus.ARCHIVED

    def test_archived_journey_is_terminal(self, db: Database) -> None:
        service = _service(db)

        journey = service.create_journey(
            name="J",
            tracking_method=TrackingMethod.COUNT,
            target_value=10,
        )

        service.archive(journey.name)

        with pytest.raises(InvalidLifecycleTransition):
            service.resume(journey.name)

    def test_paused_journey_cannot_be_completed(self, db: Database) -> None:
        service = _service(db)

        journey = service.create_journey(
            name="J",
            tracking_method=TrackingMethod.COUNT,
            target_value=10,
        )

        service.pause(journey.name)

        with pytest.raises(InvalidLifecycleTransition):
            service.complete(journey.name)

    def test_completed_journey_cannot_be_paused(self, db: Database) -> None:
        service = _service(db)

        journey = service.create_journey(
            name="J",
            tracking_method=TrackingMethod.COUNT,
            target_value=10,
        )

        service.complete(journey.name)

        with pytest.raises(InvalidLifecycleTransition):
            service.pause(journey.name)

    def test_get_journey_by_name(self, db: Database) -> None:
        service = _service(db)

        service.create_journey(
            name="Named",
            tracking_method=TrackingMethod.COUNT,
            target_value=10,
        )

        journey = service.get_journey("Named")

        assert journey.name == "Named"

    def test_get_journey_not_found(self, db: Database) -> None:
        service = _service(db)

        with pytest.raises(JourneyNotFound):
            service.get_journey("Nonexistent")


class TestJourneyServiceEdit:
    def test_edit_name(self, db: Database) -> None:
        service = _service(db)

        journey = service.create_journey(
            name="Old",
            tracking_method=TrackingMethod.COUNT,
            target_value=10,
        )

        updated = service.edit_journey(
            journey.name,
            new_name="New",
        )

        assert updated.name == "New"

    def test_edit_description(self, db: Database) -> None:
        service = _service(db)

        journey = service.create_journey(
            name="J",
            tracking_method=TrackingMethod.COUNT,
            target_value=10,
        )

        updated = service.edit_journey(
            journey.name,
            description="Updated description",
        )

        assert updated.description == "Updated description"

    def test_edit_target(self, db: Database) -> None:
        service = _service(db)

        journey = service.create_journey(
            name="J",
            tracking_method=TrackingMethod.QUANTITY,
            target_value=100,
            unit="km",
        )

        updated = service.edit_journey(
            journey.name,
            target_value=250,
        )

        assert updated.target_value == 250.0

    def test_edit_target_date(self, db: Database) -> None:
        service = _service(db)

        journey = service.create_journey(
            name="J",
            tracking_method=TrackingMethod.QUANTITY,
            target_value=100,
            unit="km",
        )

        updated = service.edit_journey(
            journey.name,
            target_date=date(2026, 12, 31),
        )

        assert updated.target_date == date(2026, 12, 31)

    def test_edit_archived_raises(self, db: Database) -> None:
        service = _service(db)

        journey = service.create_journey(
            name="J",
            tracking_method=TrackingMethod.COUNT,
            target_value=10,
        )

        service.archive(journey.name)

        with pytest.raises(JourneyArchived):
            service.edit_journey(
                journey.name,
                new_name="New",
            )

    def test_edit_duplicate_name_raises(self, db: Database) -> None:
        service = _service(db)

        service.create_journey(
            name="Existing",
            tracking_method=TrackingMethod.COUNT,
            target_value=10,
        )

        journey = service.create_journey(
            name="Original",
            tracking_method=TrackingMethod.COUNT,
            target_value=10,
        )

        with pytest.raises(DuplicateJourneyName):
            service.edit_journey(
                journey.name,
                new_name="Existing",
            )

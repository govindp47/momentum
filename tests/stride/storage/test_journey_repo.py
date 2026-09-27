"""Tests for the JourneyRepository."""

from __future__ import annotations

import sqlite3
from datetime import date

import pytest

from momentum.storage.database import Database
from momentum.stride.domain.enums import JourneyStatus, TrackingMethod
from momentum.stride.domain.errors import JourneyNotFound
from momentum.stride.repositories.journey_repository import JourneyRepository


class TestJourneyRepository:
    def test_create_and_get_by_id(
        self,
        journey_repo: JourneyRepository,
    ) -> None:
        journey = journey_repo.create(
            name="Run 1000 km",
            description="A running journey",
            tracking_method=TrackingMethod.QUANTITY,
            target_value=1000,
            unit="km",
            start_date=date(2026, 1, 1),
        )

        fetched = journey_repo.get_by_id(journey.id)

        assert fetched.id == journey.id
        assert fetched.name == "Run 1000 km"
        assert fetched.description == "A running journey"
        assert fetched.tracking_method == TrackingMethod.QUANTITY
        assert fetched.target_value == 1000.0
        assert fetched.unit == "km"
        assert fetched.status == JourneyStatus.ACTIVE
        assert fetched.start_date == date(2026, 1, 1)

    def test_create_without_optional_fields(
        self,
        journey_repo: JourneyRepository,
    ) -> None:
        journey = journey_repo.create(
            name="Gym",
            description="",
            tracking_method=TrackingMethod.COUNT,
            target_value=200,
            unit=None,
            start_date=date(2026, 1, 1),
        )

        fetched = journey_repo.get_by_id(journey.id)

        assert fetched.unit is None
        assert fetched.target_date is None

    def test_get_by_name(
        self,
        journey_repo: JourneyRepository,
    ) -> None:
        journey_repo.create(
            name="Gym Journey",
            description="",
            tracking_method=TrackingMethod.COUNT,
            target_value=200,
            unit="days",
            start_date=date(2026, 1, 1),
        )

        journey = journey_repo.get_by_name("Gym Journey")

        assert journey.name == "Gym Journey"

    def test_get_by_id_not_found(
        self,
        journey_repo: JourneyRepository,
    ) -> None:
        with pytest.raises(JourneyNotFound):
            journey_repo.get_by_id(99999)

    def test_get_by_name_not_found(
        self,
        journey_repo: JourneyRepository,
    ) -> None:
        with pytest.raises(JourneyNotFound):
            journey_repo.get_by_name("Nonexistent")

    def test_find_by_name_returns_none(
        self,
        journey_repo: JourneyRepository,
    ) -> None:
        result = journey_repo.find_by_name("Nonexistent")

        assert result is None

    def test_find_by_name_returns_journey(
        self,
        journey_repo: JourneyRepository,
    ) -> None:
        created = journey_repo.create(
            name="Existing",
            description="",
            tracking_method=TrackingMethod.COUNT,
            target_value=10,
            unit=None,
            start_date=date(2026, 1, 1),
        )

        result = journey_repo.find_by_name("Existing")

        assert result is not None
        assert result.id == created.id

    def test_list_all(
        self,
        journey_repo: JourneyRepository,
    ) -> None:
        for name in ("J1", "J2", "J3"):
            journey_repo.create(
                name=name,
                description="",
                tracking_method=TrackingMethod.COUNT,
                target_value=10,
                unit=None,
                start_date=date(2026, 1, 1),
            )

        journeys = journey_repo.list_all()

        assert [journey.name for journey in journeys] == [
            "J1",
            "J2",
            "J3",
        ]

    def test_list_by_status(
        self,
        journey_repo: JourneyRepository,
    ) -> None:
        active = journey_repo.create(
            name="Active",
            description="",
            tracking_method=TrackingMethod.COUNT,
            target_value=10,
            unit=None,
            start_date=date(2026, 1, 1),
        )
        paused = journey_repo.create(
            name="Paused",
            description="",
            tracking_method=TrackingMethod.COUNT,
            target_value=10,
            unit=None,
            start_date=date(2026, 1, 1),
        )

        journey_repo.update(
            paused.id,
            status=JourneyStatus.PAUSED,
        )

        result = journey_repo.list_by_status(JourneyStatus.ACTIVE)

        assert len(result) == 1
        assert result[0].id == active.id

    def test_list_active(
        self,
        journey_repo: JourneyRepository,
    ) -> None:
        active = journey_repo.create(
            name="Active",
            description="",
            tracking_method=TrackingMethod.COUNT,
            target_value=10,
            unit=None,
            start_date=date(2026, 1, 1),
        )
        archived = journey_repo.create(
            name="Archived",
            description="",
            tracking_method=TrackingMethod.COUNT,
            target_value=10,
            unit=None,
            start_date=date(2026, 1, 1),
        )

        journey_repo.update(
            archived.id,
            status=JourneyStatus.ARCHIVED,
        )

        result = journey_repo.list_active()

        assert len(result) == 1
        assert result[0].id == active.id

    def test_update_status(
        self,
        journey_repo: JourneyRepository,
    ) -> None:
        journey = journey_repo.create(
            name="J",
            description="",
            tracking_method=TrackingMethod.COUNT,
            target_value=10,
            unit=None,
            start_date=date(2026, 1, 1),
        )

        updated = journey_repo.update(
            journey.id,
            status=JourneyStatus.PAUSED,
        )

        assert updated.status == JourneyStatus.PAUSED

    def test_update_name(
        self,
        journey_repo: JourneyRepository,
    ) -> None:
        journey = journey_repo.create(
            name="Old Name",
            description="",
            tracking_method=TrackingMethod.COUNT,
            target_value=10,
            unit=None,
            start_date=date(2026, 1, 1),
        )

        updated = journey_repo.update(
            journey.id,
            name="New Name",
        )

        assert updated.name == "New Name"

    def test_update_description(
        self,
        journey_repo: JourneyRepository,
    ) -> None:
        journey = journey_repo.create(
            name="Journey",
            description="Old",
            tracking_method=TrackingMethod.COUNT,
            target_value=10,
            unit=None,
            start_date=date(2026, 1, 1),
        )

        updated = journey_repo.update(
            journey.id,
            description="New",
        )

        assert updated.description == "New"

    def test_update_target_value(
        self,
        journey_repo: JourneyRepository,
    ) -> None:
        journey = journey_repo.create(
            name="Journey",
            description="",
            tracking_method=TrackingMethod.QUANTITY,
            target_value=100,
            unit="km",
            start_date=date(2026, 1, 1),
        )

        updated = journey_repo.update(
            journey.id,
            target_value=250,
        )

        assert updated.target_value == 250.0

    def test_update_target_date(
        self,
        journey_repo: JourneyRepository,
    ) -> None:
        journey = journey_repo.create(
            name="Dated",
            description="",
            tracking_method=TrackingMethod.QUANTITY,
            target_value=100,
            unit="km",
            start_date=date(2026, 1, 1),
        )

        updated = journey_repo.update(
            journey.id,
            target_date=date(2026, 12, 31),
        )

        assert updated.target_date == date(2026, 12, 31)

    def test_clear_target_date(
        self,
        journey_repo: JourneyRepository,
    ) -> None:
        journey = journey_repo.create(
            name="Dated",
            description="",
            tracking_method=TrackingMethod.QUANTITY,
            target_value=100,
            unit="km",
            start_date=date(2026, 1, 1),
            target_date=date(2026, 12, 31),
        )

        updated = journey_repo.update(
            journey.id,
            clear_target_date=True,
        )

        assert updated.target_date is None

    def test_clear_unit(
        self,
        journey_repo: JourneyRepository,
    ) -> None:
        journey = journey_repo.create(
            name="Run",
            description="",
            tracking_method=TrackingMethod.QUANTITY,
            target_value=100,
            unit="km",
            start_date=date(2026, 1, 1),
        )

        updated = journey_repo.update(
            journey.id,
            clear_unit=True,
        )

        assert updated.unit is None

    def test_update_preserves_omitted_fields(
        self,
        journey_repo: JourneyRepository,
    ) -> None:
        journey = journey_repo.create(
            name="Original",
            description="Description",
            tracking_method=TrackingMethod.QUANTITY,
            target_value=100,
            unit="km",
            start_date=date(2026, 1, 1),
            target_date=date(2026, 12, 31),
        )

        updated = journey_repo.update(
            journey.id,
            name="Updated",
        )

        assert updated.name == "Updated"
        assert updated.description == "Description"
        assert updated.target_value == 100.0
        assert updated.unit == "km"
        assert updated.target_date == date(2026, 12, 31)

    def test_update_not_found(
        self,
        journey_repo: JourneyRepository,
    ) -> None:
        with pytest.raises(JourneyNotFound):
            journey_repo.update(
                99999,
                name="Missing",
            )

    def test_delete_not_found(
        self,
        journey_repo: JourneyRepository,
    ) -> None:
        with pytest.raises(JourneyNotFound):
            journey_repo.delete(99999)

    def test_delete(
        self,
        journey_repo: JourneyRepository,
    ) -> None:
        journey = journey_repo.create(
            name="To Delete",
            description="",
            tracking_method=TrackingMethod.COUNT,
            target_value=10,
            unit=None,
            start_date=date(2026, 1, 1),
        )

        journey_repo.delete(journey.id)

        with pytest.raises(JourneyNotFound):
            journey_repo.get_by_id(journey.id)

    def test_transaction_rolls_back(
        self,
        journey_repo: JourneyRepository,
        db: Database,
    ) -> None:
        with pytest.raises(RuntimeError), db.transaction():
            journey_repo.create(
                name="Rolled Back",
                description="",
                tracking_method=TrackingMethod.COUNT,
                target_value=10,
                unit=None,
                start_date=date(2026, 1, 1),
            )

            assert db.conn.in_transaction

            raise RuntimeError("force rollback")

        with pytest.raises(JourneyNotFound):
            journey_repo.get_by_name("Rolled Back")

    def test_unique_name_constraint(
        self,
        journey_repo: JourneyRepository,
    ) -> None:
        journey_repo.create(
            name="Unique",
            description="",
            tracking_method=TrackingMethod.COUNT,
            target_value=10,
            unit=None,
            start_date=date(2026, 1, 1),
        )

        with pytest.raises(sqlite3.IntegrityError):
            journey_repo.create(
                name="Unique",
                description="",
                tracking_method=TrackingMethod.COUNT,
                target_value=10,
                unit=None,
                start_date=date(2026, 1, 1),
            )

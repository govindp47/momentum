"""Tests for the MilestoneRepository."""

from __future__ import annotations

from datetime import datetime

import pytest

from momentum.storage.database import Database
from momentum.stride.domain.enums import MilestoneStatus
from momentum.stride.domain.errors import MilestoneNotFound
from momentum.stride.domain.models import Journey
from momentum.stride.repositories.journey_repository import JourneyRepository
from momentum.stride.repositories.milestone_repository import MilestoneRepository


class TestMilestoneRepository:
    def test_create_and_get(
        self,
        milestone_repo: MilestoneRepository,
        milestone_journey: Journey,
    ) -> None:
        milestone = milestone_repo.create(
            journey_id=milestone_journey.id,
            name="Networking",
        )

        fetched = milestone_repo.get_by_id(milestone.id)

        assert fetched.id == milestone.id
        assert fetched.journey_id == milestone_journey.id
        assert fetched.name == "Networking"
        assert fetched.status == MilestoneStatus.PENDING
        assert fetched.completed_at is None

    def test_auto_position(
        self,
        milestone_repo: MilestoneRepository,
        milestone_journey: Journey,
    ) -> None:
        first = milestone_repo.create(
            journey_id=milestone_journey.id,
            name="A",
        )
        second = milestone_repo.create(
            journey_id=milestone_journey.id,
            name="B",
        )
        third = milestone_repo.create(
            journey_id=milestone_journey.id,
            name="C",
        )

        assert first.position == 0
        assert second.position == 1
        assert third.position == 2

    def test_list_for_journey_is_position_ordered(
        self,
        milestone_repo: MilestoneRepository,
        milestone_journey: Journey,
    ) -> None:
        for name in ("A", "B", "C"):
            milestone_repo.create(
                journey_id=milestone_journey.id,
                name=name,
            )

        milestones = milestone_repo.list_for_journey(
            milestone_journey.id,
        )

        assert [milestone.name for milestone in milestones] == [
            "A",
            "B",
            "C",
        ]

    def test_list_for_journey_only_returns_requested_journey(
        self,
        milestone_repo: MilestoneRepository,
        milestone_journey: Journey,
        journey_repo: JourneyRepository,
    ) -> None:
        other_journey = journey_repo.create(
            name="Other",
            description="",
            tracking_method=milestone_journey.tracking_method,
            target_value=2,
            unit=None,
            start_date=milestone_journey.start_date,
        )

        milestone_repo.create(
            journey_id=milestone_journey.id,
            name="A",
        )
        milestone_repo.create(
            journey_id=other_journey.id,
            name="B",
        )

        milestones = milestone_repo.list_for_journey(
            milestone_journey.id,
        )

        assert len(milestones) == 1
        assert milestones[0].name == "A"

    def test_get_not_found(
        self,
        milestone_repo: MilestoneRepository,
    ) -> None:
        with pytest.raises(MilestoneNotFound):
            milestone_repo.get_by_id(99999)

    def test_update_name(
        self,
        milestone_repo: MilestoneRepository,
        milestone_journey: Journey,
    ) -> None:
        milestone = milestone_repo.create(
            journey_id=milestone_journey.id,
            name="Old",
        )

        updated = milestone_repo.update(
            milestone.id,
            name="New",
        )

        assert updated.name == "New"

    def test_update_description(
        self,
        milestone_repo: MilestoneRepository,
        milestone_journey: Journey,
    ) -> None:
        milestone = milestone_repo.create(
            journey_id=milestone_journey.id,
            name="Milestone",
            description="Old",
        )

        updated = milestone_repo.update(
            milestone.id,
            description="New",
        )

        assert updated.description == "New"

    def test_complete_milestone(
        self,
        milestone_repo: MilestoneRepository,
        milestone_journey: Journey,
    ) -> None:
        milestone = milestone_repo.create(
            journey_id=milestone_journey.id,
            name="M",
        )
        now = datetime.now()

        updated = milestone_repo.update(
            milestone.id,
            status=MilestoneStatus.COMPLETED,
            completed_at=now,
        )

        assert updated.status == MilestoneStatus.COMPLETED
        assert updated.completed_at == now

    def test_clear_completed_at(
        self,
        milestone_repo: MilestoneRepository,
        milestone_journey: Journey,
    ) -> None:
        milestone = milestone_repo.create(
            journey_id=milestone_journey.id,
            name="M",
        )
        completed_at = datetime.now()

        milestone_repo.update(
            milestone.id,
            status=MilestoneStatus.COMPLETED,
            completed_at=completed_at,
        )

        updated = milestone_repo.update(
            milestone.id,
            status=MilestoneStatus.PENDING,
            clear_completed_at=True,
        )

        assert updated.status == MilestoneStatus.PENDING
        assert updated.completed_at is None

    def test_count_for_journey(
        self,
        milestone_repo: MilestoneRepository,
        milestone_journey: Journey,
    ) -> None:
        for name in ("A", "B", "C", "D"):
            milestone_repo.create(
                journey_id=milestone_journey.id,
                name=name,
            )

        assert (
            milestone_repo.count_for_journey(
                milestone_journey.id,
            )
            == 4
        )

    def test_count_completed(
        self,
        milestone_repo: MilestoneRepository,
        milestone_journey: Journey,
    ) -> None:
        first = milestone_repo.create(
            journey_id=milestone_journey.id,
            name="A",
        )
        second = milestone_repo.create(
            journey_id=milestone_journey.id,
            name="B",
        )
        milestone_repo.create(
            journey_id=milestone_journey.id,
            name="C",
        )

        milestone_repo.update(
            first.id,
            status=MilestoneStatus.COMPLETED,
        )
        milestone_repo.update(
            second.id,
            status=MilestoneStatus.COMPLETED,
        )

        assert (
            milestone_repo.count_completed_for_journey(
                milestone_journey.id,
            )
            == 2
        )

    def test_reorder(
        self,
        milestone_repo: MilestoneRepository,
        milestone_journey: Journey,
    ) -> None:
        first = milestone_repo.create(
            journey_id=milestone_journey.id,
            name="A",
        )
        second = milestone_repo.create(
            journey_id=milestone_journey.id,
            name="B",
        )
        third = milestone_repo.create(
            journey_id=milestone_journey.id,
            name="C",
        )

        milestone_repo.reorder(
            milestone_journey.id,
            [third.id, second.id, first.id],
        )

        milestones = milestone_repo.list_for_journey(
            milestone_journey.id,
        )

        assert [milestone.name for milestone in milestones] == [
            "C",
            "B",
            "A",
        ]

    def test_delete(
        self,
        milestone_repo: MilestoneRepository,
        milestone_journey: Journey,
    ) -> None:
        milestone = milestone_repo.create(
            journey_id=milestone_journey.id,
            name="M",
        )

        milestone_repo.delete(milestone.id)

        with pytest.raises(MilestoneNotFound):
            milestone_repo.get_by_id(milestone.id)

    def test_delete_not_found(
        self,
        milestone_repo: MilestoneRepository,
    ) -> None:
        with pytest.raises(MilestoneNotFound):
            milestone_repo.delete(99999)

    def test_repository_does_not_commit(
        self,
        milestone_repo: MilestoneRepository,
        milestone_journey: Journey,
        db: Database,
    ) -> None:
        db.conn.execute("BEGIN")

        milestone_repo.create(
            journey_id=milestone_journey.id,
            name="Uncommitted",
        )

        db.conn.rollback()

        assert (
            milestone_repo.list_for_journey(
                milestone_journey.id,
            )
            == []
        )

"""Application service for milestone management."""

from __future__ import annotations

from collections.abc import Callable
from contextlib import AbstractContextManager

from momentum.stride.domain.enums import MilestoneStatus, TrackingMethod
from momentum.stride.domain.errors import (
    InvalidMilestoneState,
    MilestoneNotFound,
)
from momentum.stride.domain.models import Journey, Milestone
from momentum.stride.domain.rules import validate_milestone_name
from momentum.stride.repositories.milestone_repository import MilestoneRepository


class MilestoneService:
    """Coordinate milestone operations and persistence.

    Milestone completion and reopening are intentionally handled by
    ProgressService because those workflows also synchronize the
    progress-event ledger and journey lifecycle.

    The service does not own or expose the database connection. The
    repository owns its database connection, while the injected
    transaction manager controls transaction boundaries.
    """

    def __init__(
        self,
        milestone_repo: MilestoneRepository,
        transaction_manager: Callable[[], AbstractContextManager[None]],
    ) -> None:
        self._milestones = milestone_repo
        self._transaction_manager = transaction_manager

    # ------------------------------------------------------------------
    # Queries
    # ------------------------------------------------------------------

    def list_milestones(
        self,
        journey_id: int,
    ) -> list[Milestone]:
        """Return milestones for a journey in position order."""
        return self._milestones.list_for_journey(journey_id)

    def get_milestone(
        self,
        journey: Journey,
        milestone_id: int,
    ) -> Milestone:
        """Return a milestone belonging to the specified journey."""
        milestone = self._milestones.get_by_id(milestone_id)

        if milestone.journey_id != journey.id:
            raise MilestoneNotFound(
                f"Milestone {milestone_id} does not belong to journey '{journey.name}'.",
            )

        return milestone

    # ------------------------------------------------------------------
    # Mutations
    # ------------------------------------------------------------------

    def add_milestone(
        self,
        journey: Journey,
        *,
        name: str,
        description: str = "",
        position: int | None = None,
    ) -> Milestone:
        """Add a milestone to a milestone-based journey."""
        self._ensure_milestone_journey(journey)

        normalized_name = validate_milestone_name(name)
        normalized_description = description.strip()

        with self._transaction_manager():
            return self._milestones.create(
                journey_id=journey.id,
                name=normalized_name,
                description=normalized_description,
                position=position,
            )

    def edit_milestone(
        self,
        journey: Journey,
        milestone_id: int,
        *,
        name: str | None = None,
        description: str | None = None,
    ) -> Milestone:
        """Edit milestone metadata."""
        self._ensure_milestone_journey(journey)

        milestone = self.get_milestone(
            journey,
            milestone_id,
        )

        if name is None and description is None:
            return milestone

        normalized_name = validate_milestone_name(name) if name is not None else None

        normalized_description = description.strip() if description is not None else None

        with self._transaction_manager():
            return self._milestones.update(
                milestone_id,
                name=normalized_name,
                description=normalized_description,
            )

    def reorder_milestones(
        self,
        journey: Journey,
        ordered_ids: list[int],
    ) -> None:
        """Reorder all milestones in a journey.

        The supplied IDs must contain every milestone belonging to
        the journey exactly once.
        """
        self._ensure_milestone_journey(journey)

        milestones = self.list_milestones(journey.id)

        expected_ids = {milestone.id for milestone in milestones}
        supplied_ids = set(ordered_ids)

        if len(ordered_ids) != len(supplied_ids):
            raise InvalidMilestoneState(
                "Milestone IDs must be unique.",
            )

        if supplied_ids != expected_ids:
            raise InvalidMilestoneState(
                "Reorder requires exactly all milestone IDs belonging to the journey.",
            )

        with self._transaction_manager():
            self._milestones.reorder(
                journey.id,
                ordered_ids,
            )

    def delete_milestone(
        self,
        journey: Journey,
        milestone_id: int,
    ) -> None:
        """Delete a pending milestone."""
        self._ensure_milestone_journey(journey)

        milestone = self.get_milestone(
            journey,
            milestone_id,
        )

        if milestone.status == MilestoneStatus.COMPLETED:
            raise InvalidMilestoneState(
                f"Milestone '{milestone.name}' is completed. Reopen it before deleting.",
            )

        with self._transaction_manager():
            self._milestones.delete(milestone_id)

    # ------------------------------------------------------------------
    # Internal validation
    # ------------------------------------------------------------------

    @staticmethod
    def _ensure_milestone_journey(
        journey: Journey,
    ) -> None:
        """Ensure the journey supports milestone operations."""
        if journey.tracking_method != TrackingMethod.MILESTONE:
            raise InvalidMilestoneState(
                f"Journey '{journey.name}' is not milestone-based.",
            )

        if journey.is_archived:
            raise InvalidMilestoneState(
                f"Journey '{journey.name}' is archived.",
            )

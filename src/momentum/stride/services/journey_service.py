"""Journey service — orchestrates journey lifecycle operations."""

from __future__ import annotations

from collections.abc import Callable
from contextlib import AbstractContextManager
from datetime import date

from momentum.stride.domain import rules
from momentum.stride.domain.enums import JourneyStatus, TrackingMethod
from momentum.stride.domain.errors import (
    DuplicateJourneyName,
    JourneyArchived,
)
from momentum.stride.domain.models import Journey, Milestone
from momentum.stride.repositories.journey_repository import JourneyRepository
from momentum.stride.repositories.milestone_repository import MilestoneRepository


class JourneyService:
    """Application-level operations for journey management.

    The service layer owns transaction boundaries and coordinates multiple
    repositories when an operation affects more than one aggregate.

    The service does not own or expose the database connection. Repositories
    retain the connection they were created with, while the injected
    transaction manager controls atomicity.
    """

    def __init__(
        self,
        journey_repo: JourneyRepository,
        milestone_repo: MilestoneRepository,
        transaction_manager: Callable[[], AbstractContextManager[None]],
    ) -> None:
        self._journeys = journey_repo
        self._milestones = milestone_repo
        self._transaction_manager = transaction_manager

    # ------------------------------------------------------------------
    # Create
    # ------------------------------------------------------------------

    def create_journey(
        self,
        *,
        name: str,
        description: str = "",
        tracking_method: TrackingMethod,
        target_value: float,
        unit: str | None = None,
        start_date: date | None = None,
        target_date: date | None = None,
        milestone_names: list[str] | None = None,
    ) -> Journey:
        """Create a journey and optional initial milestones atomically."""
        normalized_name = rules.validate_journey_name(name)

        rules.validate_target_value(
            target_value,
            tracking_method,
        )

        normalized_unit = rules.validate_unit(
            unit,
            tracking_method,
        )

        resolved_start_date = start_date if start_date is not None else date.today()

        rules.validate_journey_dates(
            resolved_start_date,
            target_date,
        )

        if self._journeys.find_by_name(normalized_name) is not None:
            raise DuplicateJourneyName(normalized_name)

        normalized_milestones = self._validate_milestone_names(milestone_names)

        with self._transaction_manager():
            journey = self._journeys.create(
                name=normalized_name,
                description=description.strip(),
                tracking_method=tracking_method,
                target_value=target_value,
                unit=normalized_unit,
                start_date=resolved_start_date,
                target_date=target_date,
            )

            for position, milestone_name in enumerate(normalized_milestones):
                self._milestones.create(
                    journey_id=journey.id,
                    name=milestone_name,
                    position=position,
                )

        return journey

    # ------------------------------------------------------------------
    # Read
    # ------------------------------------------------------------------

    def get_journey(
        self,
        name_or_id: str | int,
    ) -> Journey:
        """Resolve a journey by integer ID or name."""
        return self._get_journey(name_or_id)

    def list_journeys(
        self,
        *,
        status: JourneyStatus | None = None,
    ) -> list[Journey]:
        """List journeys, optionally filtered by lifecycle status."""
        if status is None:
            return self._journeys.list_all()

        return self._journeys.list_by_status(status)

    def get_milestones(
        self,
        journey: Journey,
    ) -> list[Milestone]:
        """Return all milestones belonging to a journey."""
        return self._milestones.list_for_journey(journey.id)

    # ------------------------------------------------------------------
    # Update
    # ------------------------------------------------------------------

    def edit_journey(
        self,
        name_or_id: str | int,
        *,
        new_name: str | None = None,
        description: str | None = None,
        target_value: float | None = None,
        unit: str | None = None,
        clear_unit: bool = False,
        target_date: date | None = None,
        clear_target_date: bool = False,
    ) -> Journey:
        """Edit journey metadata.

        Editing does not require the journey to be active. Archived journeys
        are immutable.
        """
        journey = self._get_journey(name_or_id)

        self._ensure_not_archived(journey)

        normalized_name = journey.name

        if new_name is not None:
            normalized_name = rules.validate_journey_name(new_name)

            existing = self._journeys.find_by_name(normalized_name)

            if existing is not None and existing.id != journey.id:
                raise DuplicateJourneyName(normalized_name)

        if target_value is not None:
            rules.validate_target_value(
                target_value,
                journey.tracking_method,
            )

        updated_unit = None if clear_unit else unit if unit is not None else journey.unit

        updated_target_date = (
            None
            if clear_target_date
            else target_date
            if target_date is not None
            else journey.target_date
        )

        rules.validate_unit(
            updated_unit,
            journey.tracking_method,
        )

        rules.validate_journey_dates(
            journey.start_date,
            updated_target_date,
        )

        with self._transaction_manager():
            return self._journeys.update(
                journey.id,
                name=normalized_name,
                description=(description if description is not None else journey.description),
                target_value=target_value,
                unit=updated_unit,
                clear_unit=clear_unit,
                target_date=target_date,
                clear_target_date=clear_target_date,
            )

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    def pause(
        self,
        name_or_id: str | int,
    ) -> Journey:
        """Pause an active journey."""
        return self._transition(
            name_or_id,
            JourneyStatus.PAUSED,
        )

    def resume(
        self,
        name_or_id: str | int,
    ) -> Journey:
        """Resume a paused journey."""
        return self._transition(
            name_or_id,
            JourneyStatus.ACTIVE,
        )

    def complete(
        self,
        name_or_id: str | int,
    ) -> Journey:
        """Mark a journey as completed."""
        return self._transition(
            name_or_id,
            JourneyStatus.COMPLETED,
        )

    def archive(
        self,
        name_or_id: str | int,
    ) -> Journey:
        """Archive a journey."""
        return self._transition(
            name_or_id,
            JourneyStatus.ARCHIVED,
        )

    def reopen(
        self,
        name_or_id: str | int,
    ) -> Journey:
        """Reopen a completed journey as active."""
        return self._transition(
            name_or_id,
            JourneyStatus.ACTIVE,
        )

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _get_journey(
        self,
        name_or_id: str | int,
    ) -> Journey:
        """Resolve a journey identifier."""
        if isinstance(name_or_id, int):
            return self._journeys.get_by_id(name_or_id)

        normalized = name_or_id.strip()

        if not normalized:
            raise ValueError("Journey name or ID must not be empty.")

        if normalized.isdigit():
            return self._journeys.get_by_id(int(normalized))

        return self._journeys.get_by_name(normalized)

    def _transition(
        self,
        name_or_id: str | int,
        target_status: JourneyStatus,
    ) -> Journey:
        """Apply a validated lifecycle transition atomically."""
        journey = self._get_journey(name_or_id)

        rules.validate_lifecycle_transition(
            journey.status,
            target_status,
        )

        with self._transaction_manager():
            return self._journeys.update(
                journey.id,
                status=target_status,
            )

    @staticmethod
    def _ensure_not_archived(journey: Journey) -> None:
        """Reject modifications to archived journeys."""
        if journey.status == JourneyStatus.ARCHIVED:
            raise JourneyArchived(journey.name)

    @staticmethod
    def _validate_milestone_names(
        milestone_names: list[str] | None,
    ) -> list[str]:
        """Validate and normalize initial milestone names."""
        if not milestone_names:
            return []

        normalized: list[str] = []

        for name in milestone_names:
            value = name.strip()

            if not value:
                raise ValueError("Milestone names must not be empty.")

            if len(value) > 200:
                raise ValueError(
                    "Milestone names must be 200 characters or fewer.",
                )

            normalized.append(value)

        return normalized

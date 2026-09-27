"""Progress service — orchestrates progress and milestone operations."""

from __future__ import annotations

from collections.abc import Callable
from contextlib import AbstractContextManager
from datetime import date, datetime

from momentum.stride.domain import rules
from momentum.stride.domain.enums import EventType, MilestoneStatus, TrackingMethod
from momentum.stride.domain.errors import (
    InvalidDuration,
    InvalidProgressValue,
    JourneyArchived,
)
from momentum.stride.domain.models import Journey, ProgressEvent
from momentum.stride.repositories.journey_repository import JourneyRepository
from momentum.stride.repositories.milestone_repository import MilestoneRepository
from momentum.stride.repositories.progress_repository import ProgressRepository


class ProgressService:
    """Application-level operations for progress tracking.

    The service layer owns transaction boundaries and keeps milestone state
    and milestone completion events synchronized.

    The service does not own or expose the database connection. Repositories
    retain the connection they were created with, while the injected
    transaction manager controls atomicity.
    """

    def __init__(
        self,
        journey_repo: JourneyRepository,
        milestone_repo: MilestoneRepository,
        progress_repo: ProgressRepository,
        transaction_manager: Callable[[], AbstractContextManager[None]],
    ) -> None:
        self._journeys = journey_repo
        self._milestones = milestone_repo
        self._events = progress_repo
        self._transaction_manager = transaction_manager

    # ------------------------------------------------------------------
    # Log progress
    # ------------------------------------------------------------------

    def log_progress(
        self,
        journey_name_or_id: str | int,
        *,
        value: float | None = None,
        duration_seconds: int | None = None,
        occurred_at: datetime | None = None,
        note: str | None = None,
    ) -> ProgressEvent:
        """Record one normal progress event."""
        journey = self._get_journey(journey_name_or_id)

        rules.validate_journey_accepts_progress(journey)

        occurred_at = occurred_at if occurred_at is not None else datetime.now()

        resolved_value: float | None = None
        resolved_duration: int | None = None

        if journey.tracking_method == TrackingMethod.COUNT:
            if value is not None and value != 1:
                raise InvalidProgressValue(
                    "Count journeys accept exactly 1 per event.",
                )

            resolved_value = 1.0

        elif journey.tracking_method == TrackingMethod.QUANTITY:
            if value is None:
                raise InvalidProgressValue(
                    "Quantity journeys require a progress value.",
                )

            rules.validate_progress_value(
                value,
                TrackingMethod.QUANTITY,
            )

            resolved_value = value

        elif journey.tracking_method == TrackingMethod.DURATION:
            if duration_seconds is None:
                raise InvalidDuration(
                    "Duration journeys require duration_seconds.",
                )

            rules.validate_duration_seconds(
                duration_seconds,
            )

            resolved_duration = duration_seconds

        else:
            raise InvalidProgressValue(
                "Milestone journeys use milestone completion operations to record progress.",
            )

        with self._transaction_manager():
            return self._events.create(
                journey_id=journey.id,
                event_type=EventType.PROGRESS,
                value=resolved_value,
                duration_seconds=resolved_duration,
                occurred_at=occurred_at,
                note=note,
            )

    # ------------------------------------------------------------------
    # Milestone completion
    # ------------------------------------------------------------------

    def complete_milestone(
        self,
        journey_name_or_id: str | int,
        milestone_id: int,
        *,
        occurred_at: datetime | None = None,
        note: str | None = None,
    ) -> ProgressEvent:
        """Complete a milestone and create its completion event atomically.

        If the completed milestone is the final outstanding milestone,
        the journey is also marked completed.
        """
        journey = self._get_journey(journey_name_or_id)

        rules.validate_journey_accepts_progress(journey)

        milestone = self._milestones.get_by_id(milestone_id)

        rules.validate_milestone_belongs_to_journey(
            milestone,
            journey,
        )

        rules.validate_milestone_can_complete(milestone)

        occurred_at = occurred_at if occurred_at is not None else datetime.now()

        with self._transaction_manager():
            self._milestones.update(
                milestone_id,
                status=MilestoneStatus.COMPLETED,
                completed_at=occurred_at,
            )

            event = self._events.create(
                journey_id=journey.id,
                milestone_id=milestone_id,
                event_type=EventType.MILESTONE_COMPLETED,
                value=1.0,
                duration_seconds=None,
                occurred_at=occurred_at,
                note=note,
            )

            self._complete_journey_if_all_milestones_done(
                journey_id=journey.id,
            )

        return event

    def reopen_milestone(
        self,
        journey_name_or_id: str | int,
        milestone_id: int,
    ) -> None:
        """Reopen a milestone and remove its completion event atomically."""
        journey = self._get_journey(journey_name_or_id)

        if journey.is_archived:
            raise JourneyArchived(journey.name)

        milestone = self._milestones.get_by_id(milestone_id)

        rules.validate_milestone_belongs_to_journey(
            milestone,
            journey,
        )

        rules.validate_milestone_can_reopen(milestone)

        completion_event = self._events.find_milestone_completion_event(
            milestone_id,
        )

        with self._transaction_manager():
            if completion_event is not None:
                self._events.delete(completion_event.id)

            self._milestones.update(
                milestone_id,
                status=MilestoneStatus.PENDING,
                clear_completed_at=True,
            )

            self._reopen_journey_if_milestone_progress_was_reverted(
                journey_id=journey.id,
            )

    # ------------------------------------------------------------------
    # History
    # ------------------------------------------------------------------

    def get_history(
        self,
        journey_name_or_id: str | int,
        *,
        limit: int | None = None,
        start_date: date | None = None,
        end_date: date | None = None,
    ) -> list[ProgressEvent]:
        """Return progress history for a journey."""
        journey = self._get_journey(journey_name_or_id)

        if start_date is not None and end_date is not None and end_date < start_date:
            raise InvalidProgressValue(
                "History end date cannot be before start date.",
            )

        return self._events.list_for_journey(
            journey.id,
            limit=limit,
            start_date=start_date,
            end_date=end_date,
        )

    # ------------------------------------------------------------------
    # Edit event
    # ------------------------------------------------------------------

    def edit_event(
        self,
        event_id: int,
        *,
        value: float | None = None,
        clear_value: bool = False,
        duration_seconds: int | None = None,
        clear_duration: bool = False,
        occurred_at: datetime | None = None,
        note: str | None = None,
        clear_note: bool = False,
    ) -> ProgressEvent:
        """Edit a normal progress event.

        Milestone completion events are intentionally immutable through this
        method because their state is coupled to milestone state.
        """
        event = self._events.get_by_id(event_id)

        if event.event_type != EventType.PROGRESS:
            raise InvalidProgressValue(
                "Milestone completion events cannot be edited as normal progress events.",
            )

        journey = self._journeys.get_by_id(event.journey_id)

        if journey.is_archived:
            raise JourneyArchived(journey.name)

        updated_value = event.value
        updated_duration = event.duration_seconds

        if clear_value:
            updated_value = None
        elif value is not None:
            updated_value = value

        if clear_duration:
            updated_duration = None
        elif duration_seconds is not None:
            updated_duration = duration_seconds

        self._validate_event_payload(
            journey.tracking_method,
            value=updated_value,
            duration_seconds=updated_duration,
        )

        with self._transaction_manager():
            return self._events.update(
                event_id,
                value=value,
                clear_value=clear_value,
                duration_seconds=duration_seconds,
                clear_duration=clear_duration,
                occurred_at=occurred_at,
                note=note,
                clear_note=clear_note,
            )

    # ------------------------------------------------------------------
    # Delete event
    # ------------------------------------------------------------------

    def delete_event(
        self,
        event_id: int,
    ) -> None:
        """Delete an event atomically.

        Deleting a milestone completion also reopens that milestone.
        """
        event = self._events.get_by_id(event_id)
        journey = self._journeys.get_by_id(event.journey_id)

        if journey.is_archived:
            raise JourneyArchived(journey.name)

        with self._transaction_manager():
            if event.event_type == EventType.MILESTONE_COMPLETED:
                if event.milestone_id is None:
                    raise InvalidProgressValue(
                        "Milestone completion event has no milestone ID.",
                    )

                milestone = self._milestones.get_by_id(
                    event.milestone_id,
                )

                rules.validate_milestone_belongs_to_journey(
                    milestone,
                    journey,
                )

                if milestone.is_completed:
                    self._milestones.update(
                        milestone.id,
                        status=MilestoneStatus.PENDING,
                        clear_completed_at=True,
                    )

            self._events.delete(event_id)

            if event.event_type == EventType.MILESTONE_COMPLETED:
                self._reopen_journey_if_milestone_progress_was_reverted(
                    journey_id=journey.id,
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

        if normalized.isdigit():
            return self._journeys.get_by_id(int(normalized))

        return self._journeys.get_by_name(normalized)

    def _complete_journey_if_all_milestones_done(
        self,
        *,
        journey_id: int,
    ) -> None:
        """Complete a milestone journey when every milestone is complete."""
        journey = self._journeys.get_by_id(journey_id)

        if not journey.is_milestone_based:
            return

        total = self._milestones.count_for_journey(journey_id)

        if total == 0:
            return

        completed = self._milestones.count_completed_for_journey(
            journey_id,
        )

        if completed == total and journey.is_active:
            self._journeys.update(
                journey_id,
                status=journey.status.COMPLETED,
            )

    def _reopen_journey_if_milestone_progress_was_reverted(
        self,
        *,
        journey_id: int,
    ) -> None:
        """Reopen an automatically completed milestone journey if necessary."""
        journey = self._journeys.get_by_id(journey_id)

        if not journey.is_milestone_based:
            return

        if not journey.is_completed:
            return

        completed = self._milestones.count_completed_for_journey(
            journey_id,
        )

        total = self._milestones.count_for_journey(
            journey_id,
        )

        if total > 0 and completed < total:
            self._journeys.update(
                journey_id,
                status=journey.status.ACTIVE,
            )

    @staticmethod
    def _validate_event_payload(
        tracking_method: TrackingMethod,
        *,
        value: float | None,
        duration_seconds: int | None,
    ) -> None:
        """Validate an edited event against its journey tracking method."""
        if tracking_method == TrackingMethod.COUNT:
            if value != 1.0 or duration_seconds is not None:
                raise InvalidProgressValue(
                    "Count progress events must have value=1 and no duration.",
                )
            return

        if tracking_method == TrackingMethod.QUANTITY:
            if value is None:
                raise InvalidProgressValue(
                    "Quantity progress events require a value.",
                )

            rules.validate_progress_value(
                value,
                TrackingMethod.QUANTITY,
            )

            if duration_seconds is not None:
                raise InvalidProgressValue(
                    "Quantity progress events cannot contain duration.",
                )

            return

        if tracking_method == TrackingMethod.DURATION:
            if duration_seconds is None:
                raise InvalidProgressValue(
                    "Duration progress events require duration_seconds.",
                )

            rules.validate_duration_seconds(
                duration_seconds,
            )

            if value is not None:
                raise InvalidProgressValue(
                    "Duration progress events must not contain value.",
                )

            return

        raise InvalidProgressValue(
            "Milestone journeys do not use normal progress events.",
        )

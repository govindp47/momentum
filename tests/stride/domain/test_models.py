"""Tests for Stride domain enums and models."""

from __future__ import annotations

from datetime import date, datetime

import pytest

from momentum.stride.domain.enums import (
    EventType,
    JourneyStatus,
    MilestoneStatus,
    TrackingMethod,
)
from momentum.stride.domain.models import (
    Journey,
    Milestone,
    ProgressEvent,
)

CREATED_AT = datetime(2026, 1, 1, 10, 0, 0)
UPDATED_AT = datetime(2026, 1, 2, 10, 0, 0)


def make_journey(**overrides: object) -> Journey:
    """Build a valid Journey with overridable fields."""
    values: dict[str, object] = {
        "id": 1,
        "name": "Test Journey",
        "description": "",
        "tracking_method": TrackingMethod.COUNT,
        "target_value": 100.0,
        "unit": "days",
        "status": JourneyStatus.ACTIVE,
        "start_date": date(2026, 1, 1),
        "target_date": None,
        "created_at": CREATED_AT,
        "updated_at": UPDATED_AT,
    }
    values.update(overrides)
    return Journey(**values)  # type: ignore[arg-type]


def make_milestone(**overrides: object) -> Milestone:
    """Build a valid Milestone with overridable fields."""
    values: dict[str, object] = {
        "id": 1,
        "journey_id": 1,
        "name": "Milestone 1",
        "description": "",
        "position": 0,
        "target_value": None,
        "unit": None,
        "status": MilestoneStatus.PENDING,
        "created_at": CREATED_AT,
        "completed_at": None,
    }
    values.update(overrides)
    return Milestone(**values)  # type: ignore[arg-type]


def make_progress_event(**overrides: object) -> ProgressEvent:
    """Build a valid ProgressEvent with overridable fields."""
    values: dict[str, object] = {
        "id": 1,
        "journey_id": 1,
        "milestone_id": None,
        "event_type": EventType.PROGRESS,
        "value": 1.0,
        "duration_seconds": None,
        "occurred_at": datetime(2026, 1, 3, 10, 0, 0),
        "note": None,
        "created_at": CREATED_AT,
    }
    values.update(overrides)
    return ProgressEvent(**values)  # type: ignore[arg-type]


class TestJourneyProperties:
    """Tests for Journey derived properties."""

    @pytest.mark.parametrize(
        ("status", "expected"),
        [
            (JourneyStatus.ACTIVE, True),
            (JourneyStatus.PAUSED, False),
            (JourneyStatus.COMPLETED, False),
            (JourneyStatus.ARCHIVED, False),
        ],
    )
    def test_is_active(
        self,
        status: JourneyStatus,
        expected: bool,
    ) -> None:
        journey = make_journey(status=status)
        assert journey.is_active is expected

    @pytest.mark.parametrize(
        ("status", "expected"),
        [
            (JourneyStatus.ACTIVE, False),
            (JourneyStatus.PAUSED, True),
            (JourneyStatus.COMPLETED, False),
            (JourneyStatus.ARCHIVED, False),
        ],
    )
    def test_is_paused(
        self,
        status: JourneyStatus,
        expected: bool,
    ) -> None:
        journey = make_journey(status=status)
        assert journey.is_paused is expected

    @pytest.mark.parametrize(
        ("status", "expected"),
        [
            (JourneyStatus.ACTIVE, False),
            (JourneyStatus.PAUSED, False),
            (JourneyStatus.COMPLETED, True),
            (JourneyStatus.ARCHIVED, False),
        ],
    )
    def test_is_completed(
        self,
        status: JourneyStatus,
        expected: bool,
    ) -> None:
        journey = make_journey(status=status)
        assert journey.is_completed is expected

    @pytest.mark.parametrize(
        ("status", "expected"),
        [
            (JourneyStatus.ACTIVE, False),
            (JourneyStatus.PAUSED, False),
            (JourneyStatus.COMPLETED, False),
            (JourneyStatus.ARCHIVED, True),
        ],
    )
    def test_is_archived(
        self,
        status: JourneyStatus,
        expected: bool,
    ) -> None:
        journey = make_journey(status=status)
        assert journey.is_archived is expected

    @pytest.mark.parametrize(
        ("method", "property_name"),
        [
            (TrackingMethod.MILESTONE, "is_milestone_based"),
            (TrackingMethod.COUNT, "is_count_based"),
            (TrackingMethod.QUANTITY, "is_quantity_based"),
            (TrackingMethod.DURATION, "is_duration_based"),
        ],
    )
    def test_tracking_method_properties(
        self,
        method: TrackingMethod,
        property_name: str,
    ) -> None:
        journey = make_journey(tracking_method=method)

        assert getattr(journey, property_name) is True

    @pytest.mark.parametrize(
        "method",
        [
            TrackingMethod.MILESTONE,
            TrackingMethod.COUNT,
            TrackingMethod.QUANTITY,
            TrackingMethod.DURATION,
        ],
    )
    def test_only_matching_tracking_method_property_is_true(
        self,
        method: TrackingMethod,
    ) -> None:
        journey = make_journey(tracking_method=method)

        properties = {
            TrackingMethod.MILESTONE: journey.is_milestone_based,
            TrackingMethod.COUNT: journey.is_count_based,
            TrackingMethod.QUANTITY: journey.is_quantity_based,
            TrackingMethod.DURATION: journey.is_duration_based,
        }

        assert properties[method] is True
        assert sum(properties.values()) == 1


class TestJourneyAcceptsProgress:
    """Tests for progress acceptance rules exposed by Journey."""

    @pytest.mark.parametrize(
        "status",
        [JourneyStatus.ACTIVE],
    )
    def test_active_journey_accepts_progress(
        self,
        status: JourneyStatus,
    ) -> None:
        journey = make_journey(status=status)

        assert journey.accepts_progress is True

    @pytest.mark.parametrize(
        "status",
        [
            JourneyStatus.PAUSED,
            JourneyStatus.COMPLETED,
            JourneyStatus.ARCHIVED,
        ],
    )
    def test_non_active_journey_rejects_progress(
        self,
        status: JourneyStatus,
    ) -> None:
        journey = make_journey(status=status)

        assert journey.accepts_progress is False


class TestMilestoneProperties:
    """Tests for Milestone derived properties."""

    @pytest.mark.parametrize(
        ("status", "expected"),
        [
            (MilestoneStatus.PENDING, False),
            (MilestoneStatus.COMPLETED, True),
        ],
    )
    def test_is_completed(
        self,
        status: MilestoneStatus,
        expected: bool,
    ) -> None:
        milestone = make_milestone(status=status)

        assert milestone.is_completed is expected


class TestProgressEventModel:
    """Tests for ProgressEvent representation."""

    def test_count_event(self) -> None:
        event = make_progress_event(
            value=1.0,
            duration_seconds=None,
        )

        assert event.event_type == EventType.PROGRESS
        assert event.value == 1.0
        assert event.duration_seconds is None

    def test_duration_event(self) -> None:
        event = make_progress_event(
            value=None,
            duration_seconds=3600,
        )

        assert event.event_type == EventType.PROGRESS
        assert event.value is None
        assert event.duration_seconds == 3600

    def test_milestone_completion_event(self) -> None:
        event = make_progress_event(
            milestone_id=7,
            event_type=EventType.MILESTONE_COMPLETED,
            value=1.0,
            duration_seconds=None,
        )

        assert event.event_type == EventType.MILESTONE_COMPLETED
        assert event.milestone_id == 7
        assert event.value == 1.0
        assert event.duration_seconds is None


class TestTrackingMethodEnum:
    """Tests for TrackingMethod."""

    @pytest.mark.parametrize(
        "value",
        [
            "milestone",
            "count",
            "quantity",
            "duration",
        ],
    )
    def test_valid_values(self, value: str) -> None:
        method = TrackingMethod(value)

        assert method.value == value

    def test_invalid_value_raises(self) -> None:
        with pytest.raises(ValueError):
            TrackingMethod("invalid")


class TestJourneyStatusEnum:
    """Tests for JourneyStatus."""

    @pytest.mark.parametrize(
        "value",
        [
            "active",
            "paused",
            "completed",
            "archived",
        ],
    )
    def test_valid_values(self, value: str) -> None:
        status = JourneyStatus(value)

        assert status.value == value


class TestMilestoneStatusEnum:
    """Tests for MilestoneStatus."""

    @pytest.mark.parametrize(
        "value",
        ["pending", "completed"],
    )
    def test_valid_values(self, value: str) -> None:
        status = MilestoneStatus(value)

        assert status.value == value


class TestEventTypeEnum:
    """Tests for EventType."""

    @pytest.mark.parametrize(
        "value",
        ["progress", "milestone_completed"],
    )
    def test_valid_values(self, value: str) -> None:
        event_type = EventType(value)

        assert event_type.value == value

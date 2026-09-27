"""Tests for Stride domain business rules."""

from __future__ import annotations

from datetime import date, datetime

import pytest

from momentum.stride.domain import rules
from momentum.stride.domain.enums import (
    JourneyStatus,
    MilestoneStatus,
    TrackingMethod,
)
from momentum.stride.domain.errors import (
    InvalidDuration,
    InvalidLifecycleTransition,
    InvalidMilestoneState,
    InvalidProgressValue,
    InvalidTarget,
    JourneyArchived,
    JourneyCompleted,
    JourneyPaused,
    MilestoneNotBelongingToJourney,
    ValidationError,
)
from momentum.stride.domain.models import Journey, Milestone

CREATED_AT = datetime(2026, 1, 1, 10, 0, 0)


def make_journey(**overrides: object) -> Journey:
    values: dict[str, object] = {
        "id": 1,
        "name": "Test Journey",
        "description": "",
        "tracking_method": TrackingMethod.QUANTITY,
        "target_value": 100.0,
        "unit": "km",
        "status": JourneyStatus.ACTIVE,
        "start_date": date(2026, 1, 1),
        "target_date": None,
        "created_at": CREATED_AT,
        "updated_at": CREATED_AT,
    }
    values.update(overrides)
    return Journey(**values)  # type: ignore[arg-type]


def make_milestone(**overrides: object) -> Milestone:
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


class TestJourneyNameValidation:
    def test_empty_name_raises(self) -> None:
        with pytest.raises(ValidationError):
            rules.validate_journey_name("")

    def test_whitespace_name_raises(self) -> None:
        with pytest.raises(ValidationError):
            rules.validate_journey_name("   ")

    def test_too_long_name_raises(self) -> None:
        with pytest.raises(ValidationError):
            rules.validate_journey_name("x" * 201)

    def test_valid_name(self) -> None:
        rules.validate_journey_name("Run 1000 km")

    def test_boundary_length_is_valid(self) -> None:
        rules.validate_journey_name("x" * 200)


class TestTargetValidation:
    @pytest.mark.parametrize(
        "method",
        [
            TrackingMethod.COUNT,
            TrackingMethod.QUANTITY,
            TrackingMethod.DURATION,
            TrackingMethod.MILESTONE,
        ],
    )
    def test_zero_target_raises(
        self,
        method: TrackingMethod,
    ) -> None:
        with pytest.raises(InvalidTarget):
            rules.validate_target_value(0, method)

    def test_negative_target_raises(self) -> None:
        with pytest.raises(InvalidTarget):
            rules.validate_target_value(
                -5,
                TrackingMethod.QUANTITY,
            )

    def test_milestone_fraction_raises(self) -> None:
        with pytest.raises(InvalidTarget):
            rules.validate_target_value(
                5.5,
                TrackingMethod.MILESTONE,
            )

    def test_milestone_integer_float_is_valid(self) -> None:
        rules.validate_target_value(
            6.0,
            TrackingMethod.MILESTONE,
        )

    def test_positive_quantity_is_valid(self) -> None:
        rules.validate_target_value(
            100.5,
            TrackingMethod.QUANTITY,
        )


class TestUnitValidation:
    def test_none_unit_is_valid_for_milestone(self) -> None:
        assert rules.validate_unit(None, TrackingMethod.MILESTONE) is None

    def test_none_unit_is_valid_for_count(self) -> None:
        assert rules.validate_unit(None, TrackingMethod.COUNT) is None

    def test_none_unit_is_invalid_for_quantity(self) -> None:
        with pytest.raises(ValidationError):
            rules.validate_unit(None, TrackingMethod.QUANTITY)

    def test_none_unit_is_invalid_for_duration(self) -> None:
        with pytest.raises(ValidationError):
            rules.validate_unit(None, TrackingMethod.DURATION)

    def test_empty_unit_is_invalid(self) -> None:
        with pytest.raises(ValidationError):
            rules.validate_unit("", TrackingMethod.QUANTITY)

    def test_whitespace_unit_is_rejected(self) -> None:
        with pytest.raises(ValidationError):
            rules.validate_unit("   ", TrackingMethod.QUANTITY)

    @pytest.mark.parametrize("unit", ["km", "hours", "pages", "sessions"])
    def test_valid_unit_for_quantity(self, unit: str) -> None:
        assert rules.validate_unit(unit, TrackingMethod.QUANTITY) == unit

    @pytest.mark.parametrize("unit", ["seconds", "minutes", "hours"])
    def test_valid_unit_for_duration(self, unit: str) -> None:
        assert rules.validate_unit(unit, TrackingMethod.DURATION) == unit


class TestProgressValueValidation:
    def test_count_must_be_one(self) -> None:
        with pytest.raises(InvalidProgressValue):
            rules.validate_progress_value(
                2.0,
                TrackingMethod.COUNT,
            )

    def test_count_one_is_valid(self) -> None:
        rules.validate_progress_value(
            1.0,
            TrackingMethod.COUNT,
        )

    def test_count_fraction_is_invalid(self) -> None:
        with pytest.raises(InvalidProgressValue):
            rules.validate_progress_value(
                0.5,
                TrackingMethod.COUNT,
            )

    def test_quantity_zero_raises(self) -> None:
        with pytest.raises(InvalidProgressValue):
            rules.validate_progress_value(
                0,
                TrackingMethod.QUANTITY,
            )

    def test_quantity_negative_raises(self) -> None:
        with pytest.raises(InvalidProgressValue):
            rules.validate_progress_value(
                -1,
                TrackingMethod.QUANTITY,
            )

    def test_quantity_positive_is_valid(self) -> None:
        rules.validate_progress_value(
            7.4,
            TrackingMethod.QUANTITY,
        )


class TestDurationValidation:
    def test_zero_raises(self) -> None:
        with pytest.raises(InvalidDuration):
            rules.validate_duration_seconds(0)

    def test_negative_raises(self) -> None:
        with pytest.raises(InvalidDuration):
            rules.validate_duration_seconds(-60)

    def test_over_24_hours_raises(self) -> None:
        with pytest.raises(InvalidDuration):
            rules.validate_duration_seconds(25 * 3600)

    def test_exactly_24_hours_is_valid(self) -> None:
        rules.validate_duration_seconds(24 * 3600)

    def test_valid_duration(self) -> None:
        rules.validate_duration_seconds(3600)


class TestLifecycleTransitions:
    @pytest.mark.parametrize(
        ("current", "target"),
        [
            (JourneyStatus.ACTIVE, JourneyStatus.PAUSED),
            (JourneyStatus.ACTIVE, JourneyStatus.COMPLETED),
            (JourneyStatus.ACTIVE, JourneyStatus.ARCHIVED),
            (JourneyStatus.PAUSED, JourneyStatus.ACTIVE),
            (JourneyStatus.PAUSED, JourneyStatus.ARCHIVED),
            (JourneyStatus.COMPLETED, JourneyStatus.ACTIVE),
            (JourneyStatus.COMPLETED, JourneyStatus.ARCHIVED),
        ],
    )
    def test_valid_transition(
        self,
        current: JourneyStatus,
        target: JourneyStatus,
    ) -> None:
        rules.validate_lifecycle_transition(
            current,
            target,
        )

    @pytest.mark.parametrize(
        ("current", "target"),
        [
            (JourneyStatus.PAUSED, JourneyStatus.COMPLETED),
            (JourneyStatus.COMPLETED, JourneyStatus.PAUSED),
            (JourneyStatus.ARCHIVED, JourneyStatus.ACTIVE),
            (JourneyStatus.ARCHIVED, JourneyStatus.PAUSED),
            (JourneyStatus.ARCHIVED, JourneyStatus.COMPLETED),
        ],
    )
    def test_invalid_transition(
        self,
        current: JourneyStatus,
        target: JourneyStatus,
    ) -> None:
        with pytest.raises(InvalidLifecycleTransition):
            rules.validate_lifecycle_transition(
                current,
                target,
            )


class TestJourneyAcceptsProgress:
    def test_active_is_allowed(self) -> None:
        journey = make_journey(
            status=JourneyStatus.ACTIVE,
        )

        rules.validate_journey_accepts_progress(journey)

    def test_paused_raises(self) -> None:
        journey = make_journey(
            status=JourneyStatus.PAUSED,
        )

        with pytest.raises(JourneyPaused):
            rules.validate_journey_accepts_progress(journey)

    def test_completed_raises(self) -> None:
        journey = make_journey(
            status=JourneyStatus.COMPLETED,
        )

        with pytest.raises(JourneyCompleted):
            rules.validate_journey_accepts_progress(journey)

    def test_archived_raises(self) -> None:
        journey = make_journey(
            status=JourneyStatus.ARCHIVED,
        )

        with pytest.raises(JourneyArchived):
            rules.validate_journey_accepts_progress(journey)


class TestMilestoneBelonging:
    def test_wrong_journey_raises(self) -> None:
        journey = make_journey(id=1)
        milestone = make_milestone(journey_id=2)

        with pytest.raises(MilestoneNotBelongingToJourney):
            rules.validate_milestone_belongs_to_journey(
                milestone,
                journey,
            )

    def test_correct_journey_is_valid(self) -> None:
        journey = make_journey(id=1)
        milestone = make_milestone(journey_id=1)

        rules.validate_milestone_belongs_to_journey(
            milestone,
            journey,
        )


class TestMilestoneState:
    def test_pending_can_complete(self) -> None:
        milestone = make_milestone(
            status=MilestoneStatus.PENDING,
        )

        rules.validate_milestone_can_complete(milestone)

    def test_completed_cannot_complete_again(self) -> None:
        milestone = make_milestone(
            status=MilestoneStatus.COMPLETED,
        )

        with pytest.raises(InvalidMilestoneState):
            rules.validate_milestone_can_complete(milestone)

    def test_completed_can_reopen(self) -> None:
        milestone = make_milestone(
            status=MilestoneStatus.COMPLETED,
        )

        rules.validate_milestone_can_reopen(milestone)

    def test_pending_cannot_reopen(self) -> None:
        milestone = make_milestone(
            status=MilestoneStatus.PENDING,
        )

        with pytest.raises(InvalidMilestoneState):
            rules.validate_milestone_can_reopen(milestone)


class TestJourneyDateValidation:
    def test_target_before_start_raises(self) -> None:
        with pytest.raises(ValidationError):
            rules.validate_journey_dates(
                date(2026, 6, 1),
                date(2026, 5, 1),
            )

    def test_target_same_as_start_raises(self) -> None:
        with pytest.raises(ValidationError):
            rules.validate_journey_dates(
                date(2026, 6, 1),
                date(2026, 6, 1),
            )

    def test_target_after_start_is_valid(self) -> None:
        rules.validate_journey_dates(
            date(2026, 1, 1),
            date(2026, 12, 31),
        )

    def test_no_target_date_is_valid(self) -> None:
        rules.validate_journey_dates(
            date(2026, 1, 1),
            None,
        )


class TestProgressCalculations:
    @pytest.mark.parametrize(
        ("current", "target", "expected"),
        [
            (0, 100, 0.0),
            (25, 100, 25.0),
            (50, 100, 50.0),
            (100, 100, 100.0),
            (150, 100, 100.0),
        ],
    )
    def test_calculate_percentage(
        self,
        current: float,
        target: float,
        expected: float,
    ) -> None:
        assert (
            rules.calculate_percentage(
                current,
                target,
            )
            == expected
        )

    @pytest.mark.parametrize(
        ("current", "target", "expected"),
        [
            (0, 100, 100),
            (40, 100, 60),
            (100, 100, 0),
            (150, 100, 0),
        ],
    )
    def test_calculate_remaining(
        self,
        current: float,
        target: float,
        expected: float,
    ) -> None:
        assert (
            rules.calculate_remaining(
                current,
                target,
            )
            == expected
        )

    def test_target_reached(self) -> None:
        assert rules.is_target_reached(100, 100)
        assert rules.is_target_reached(101, 100)

    def test_target_not_reached(self) -> None:
        assert not rules.is_target_reached(99, 100)

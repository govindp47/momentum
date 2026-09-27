"""Pure Stride domain rules and calculations.

This module contains business rules that do not require repositories,
frameworks, or application services.
"""

from __future__ import annotations

from datetime import date

from momentum.stride.domain.enums import JourneyStatus, MilestoneStatus, TrackingMethod
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

# ── Lifecycle transitions ─────────────────────────────────────────────────────


_ALLOWED_TRANSITIONS: dict[JourneyStatus, frozenset[JourneyStatus]] = {
    JourneyStatus.ACTIVE: frozenset(
        {
            JourneyStatus.PAUSED,
            JourneyStatus.COMPLETED,
            JourneyStatus.ARCHIVED,
        }
    ),
    JourneyStatus.PAUSED: frozenset(
        {
            JourneyStatus.ACTIVE,
            JourneyStatus.ARCHIVED,
        }
    ),
    JourneyStatus.COMPLETED: frozenset(
        {
            JourneyStatus.ACTIVE,
            JourneyStatus.ARCHIVED,
        }
    ),
    JourneyStatus.ARCHIVED: frozenset(),
}


def validate_lifecycle_transition(
    current: JourneyStatus,
    requested: JourneyStatus,
) -> None:
    """Raise if the requested lifecycle transition is not allowed."""
    if requested not in _ALLOWED_TRANSITIONS[current]:
        raise InvalidLifecycleTransition(
            current=current.value,
            requested=requested.value,
        )


# ── Journey validation ────────────────────────────────────────────────────────


def validate_journey_name(name: str) -> str:
    """Validate and normalize a journey name.

    Returns the normalized name so callers can persist the exact
    validated representation.
    """
    normalized = name.strip()

    if not normalized:
        raise ValidationError(
            "name",
            "Journey name must not be empty.",
        )

    if len(normalized) > 200:
        raise ValidationError(
            "name",
            "Journey name must be 200 characters or fewer.",
        )

    return normalized


def validate_milestone_name(name: str) -> str:
    """Validate and normalize a milestone name."""
    normalized = name.strip()

    if not normalized:
        raise InvalidMilestoneState("Milestone name cannot be empty.")

    if len(normalized) > 200:
        raise InvalidMilestoneState("Milestone name cannot exceed 200 characters.")

    return normalized


def validate_target_value(
    value: float,
    method: TrackingMethod,
) -> None:
    """Validate a journey target value.

    For milestone journeys the eventual target is derived from the
    number of milestones. A supplied target, if used during creation,
    must therefore represent a whole number.
    """
    if value <= 0:
        raise InvalidTarget(f"Target value must be greater than zero; got {value}.")

    if method == TrackingMethod.MILESTONE and value != int(value):
        raise InvalidTarget("Milestone journey target must be a whole number.")


def validate_journey_dates(
    start_date: date,
    target_date: date | None,
) -> None:
    """Validate journey date configuration."""
    if target_date is None:
        return

    if target_date <= start_date:
        raise ValidationError(
            "target_date",
            "Target date must be after the start date.",
        )


def validate_unit(
    unit: str | None,
    method: TrackingMethod,
) -> str | None:
    """Validate and normalize a journey unit.

    Quantity and duration journeys require a unit.
    Count and milestone journeys may omit one.
    """
    normalized = unit.strip() if unit is not None else None

    if method in (TrackingMethod.QUANTITY, TrackingMethod.DURATION) and not normalized:
        raise ValidationError(
            "unit",
            f"{method.value.capitalize()} journeys must specify a unit.",
        )

    return normalized or None


# ── Progress validation ──────────────────────────────────────────────────────


def validate_progress_value(
    value: float,
    method: TrackingMethod,
) -> None:
    """Validate a primary numeric progress value.

    COUNT journeys always contribute exactly one unit per event.
    QUANTITY journeys accept any positive value.
    DURATION journeys use ``duration_seconds`` instead and therefore
    do not use this value for their primary progress contribution.
    """
    if method == TrackingMethod.COUNT:
        if value != 1.0:
            raise InvalidProgressValue(
                "Count journeys accept exactly 1 per event (each completion counts once)."
            )
        return

    if method == TrackingMethod.QUANTITY:
        if value <= 0:
            raise InvalidProgressValue(f"Quantity value must be greater than zero; got {value}.")
        return

    if method == TrackingMethod.DURATION:
        raise InvalidProgressValue("Duration journeys use duration_seconds instead of value.")

    if method == TrackingMethod.MILESTONE:
        raise InvalidProgressValue(
            "Milestone journeys record progress through milestone completion operations."
        )


def validate_duration_seconds(seconds: int) -> None:
    """Validate a duration progress value.

    Duration is normalized to seconds throughout the domain.
    """
    if seconds <= 0:
        raise InvalidDuration(f"Duration must be a positive number of seconds; got {seconds}.")

    max_single_session = 24 * 60 * 60

    if seconds > max_single_session:
        raise InvalidDuration(
            f"Duration {seconds}s exceeds the single-session limit "
            "of 24 hours. Log it as multiple sessions if needed."
        )


# ── Journey progress guards ───────────────────────────────────────────────────


def validate_journey_accepts_progress(journey: Journey) -> None:
    """Raise if a journey cannot accept a new progress event."""
    if journey.status == JourneyStatus.ARCHIVED:
        raise JourneyArchived(journey.name)

    if journey.status == JourneyStatus.COMPLETED:
        raise JourneyCompleted(journey.name)

    if journey.status == JourneyStatus.PAUSED:
        raise JourneyPaused(journey.name)

    if journey.status != JourneyStatus.ACTIVE:
        raise InvalidLifecycleTransition(
            current=journey.status.value,
            requested=JourneyStatus.ACTIVE.value,
        )


# ── Milestone validation ──────────────────────────────────────────────────────


def validate_milestone_belongs_to_journey(
    milestone: Milestone,
    journey: Journey,
) -> None:
    """Raise if the milestone does not belong to the journey."""
    if milestone.journey_id != journey.id:
        raise MilestoneNotBelongingToJourney(
            milestone_id=milestone.id,
            journey_name=journey.name,
        )


def validate_milestone_can_complete(
    milestone: Milestone,
) -> None:
    """Raise if the milestone cannot be completed."""
    if milestone.status == MilestoneStatus.COMPLETED:
        raise InvalidMilestoneState(
            f"Milestone {milestone.name!r} is already completed. "
            "Use 'stride milestone reopen' to reopen it."
        )


def validate_milestone_can_reopen(
    milestone: Milestone,
) -> None:
    """Raise if the milestone cannot be reopened."""
    if milestone.status == MilestoneStatus.PENDING:
        raise InvalidMilestoneState(
            f"Milestone {milestone.name!r} is not completed; cannot reopen."
        )


# ── Generic progress calculations ─────────────────────────────────────────────


def is_target_reached(
    current_value: float,
    target_value: float,
) -> bool:
    """Return True when current progress has reached or exceeded the target."""
    return current_value >= target_value


def calculate_percentage(
    current_value: float,
    target_value: float,
) -> float:
    """Calculate completion percentage, capped at 100%.

    A journey may temporarily exceed its target due to an oversized
    progress event, but displayed completion should never exceed 100%.
    """
    if target_value <= 0:
        return 0.0

    percentage = (current_value / target_value) * 100.0
    return min(max(percentage, 0.0), 100.0)


def calculate_remaining(
    current_value: float,
    target_value: float,
) -> float:
    """Calculate remaining progress, never returning a negative value."""
    return max(target_value - current_value, 0.0)

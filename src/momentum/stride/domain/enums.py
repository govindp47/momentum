"""Stride Domain Enums."""

from enum import StrEnum


class TrackingMethod(StrEnum):
    """How a journey tracks progress."""

    MILESTONE = "milestone"
    COUNT = "count"
    QUANTITY = "quantity"
    DURATION = "duration"


class JourneyStatus(StrEnum):
    """Lifecycle state of a journey."""

    ACTIVE = "active"
    PAUSED = "paused"
    COMPLETED = "completed"
    ARCHIVED = "archived"


class MilestoneStatus(StrEnum):
    """Completion state of a milestone."""

    PENDING = "pending"
    COMPLETED = "completed"


class EventType(StrEnum):
    """Classification of a progress event."""

    PROGRESS = "progress"
    MILESTONE_COMPLETED = "milestone_completed"

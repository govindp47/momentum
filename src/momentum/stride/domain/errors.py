"""Domain-level exception hierarchy for Stride."""


class StrideError(Exception):
    """Base class for all Stride application errors."""


# ── Journey errors ────────────────────────────────────────────────────────────


class JourneyNotFound(StrideError):
    """Raised when a journey cannot be located by id or name."""

    def __init__(self, identifier: str | int) -> None:
        super().__init__(f"Journey not found: {identifier!r}")
        self.identifier = identifier


class DuplicateJourneyName(StrideError):
    """Raised when creating a journey with a name that already exists."""

    def __init__(self, name: str) -> None:
        super().__init__(f"A journey named {name!r} already exists.")
        self.name = name


class JourneyArchived(StrideError):
    """Raised when attempting to modify an archived journey."""

    def __init__(self, name: str) -> None:
        super().__init__(f"Journey {name!r} is archived and cannot be modified.")
        self.name = name


class JourneyPaused(StrideError):
    """Raised when attempting to log progress on a paused journey."""

    def __init__(self, name: str) -> None:
        super().__init__(f"Journey {name!r} is paused. Resume it before logging new progress.")
        self.name = name


class JourneyCompleted(StrideError):
    """Raised when attempting to log progress on a completed journey."""

    def __init__(self, name: str) -> None:
        super().__init__(
            f"Journey {name!r} is already completed. Reopen it before logging new progress."
        )
        self.name = name


class InvalidLifecycleTransition(StrideError):
    """Raised when a requested lifecycle transition is not allowed."""

    def __init__(self, current: str, requested: str) -> None:
        super().__init__(f"Cannot transition from {current!r} to {requested!r}.")
        self.current = current
        self.requested = requested


# ── Milestone errors ──────────────────────────────────────────────────────────


class MilestoneNotFound(StrideError):
    """Raised when a milestone cannot be located."""

    def __init__(self, identifier: str | int) -> None:
        super().__init__(f"Milestone not found: {identifier!r}")
        self.identifier = identifier


class MilestoneNotBelongingToJourney(StrideError):
    """Raised when a milestone does not belong to the given journey."""

    def __init__(self, milestone_id: int, journey_name: str) -> None:
        super().__init__(f"Milestone {milestone_id} does not belong to journey {journey_name!r}.")
        self.milestone_id = milestone_id
        self.journey_name = journey_name


class InvalidMilestoneState(StrideError):
    """Raised when a milestone operation conflicts with its current state."""

    def __init__(self, message: str) -> None:
        super().__init__(message)


# ── Tracking / validation errors ──────────────────────────────────────────────


class InvalidTrackingMethod(StrideError):
    """Raised when an unsupported tracking method is requested."""

    def __init__(self, method: str) -> None:
        super().__init__(
            f"Unknown tracking method {method!r}. "
            "Valid methods: milestone, count, quantity, duration."
        )
        self.method = method


class InvalidTarget(StrideError):
    """Raised when a journey target value is invalid."""

    def __init__(self, message: str) -> None:
        super().__init__(message)


class InvalidProgressValue(StrideError):
    """Raised when a progress value is invalid for a journey."""

    def __init__(self, message: str) -> None:
        super().__init__(message)


class InvalidDuration(StrideError):
    """Raised when a duration value is invalid."""

    def __init__(self, message: str) -> None:
        super().__init__(message)


# ── Progress event errors ─────────────────────────────────────────────────────


class ProgressEventNotFound(StrideError):
    """Raised when a progress event cannot be located."""

    def __init__(self, event_id: int) -> None:
        super().__init__(f"Progress event {event_id} not found.")
        self.event_id = event_id


# ── Validation errors ─────────────────────────────────────────────────────────


class ValidationError(StrideError):
    """Raised when input data fails validation."""

    def __init__(self, field: str, message: str) -> None:
        super().__init__(f"{field}: {message}")
        self.field = field
        self.message = message

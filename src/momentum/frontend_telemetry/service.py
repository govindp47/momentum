"""Service layer for frontend telemetry.

Thin orchestration between the router and repository.
"""

from __future__ import annotations

from momentum.frontend_telemetry.repository import FrontendTelemetryRepository
from momentum.frontend_telemetry.schemas import (
    FrontendErrorEventRequest,
    FrontendErrorEventResponse,
)


class FrontendTelemetryService:
    """Application service for frontend error telemetry."""

    def __init__(self, repository: FrontendTelemetryRepository) -> None:
        self._repository = repository

    def record_event(
        self,
        event: FrontendErrorEventRequest,
    ) -> FrontendErrorEventResponse:
        """Persist a frontend error event and return the stored record."""
        return self._repository.insert(event)

    def list_events(
        self,
        *,
        limit: int = 100,
        source: str | None = None,
        level: str | None = None,
        fingerprint: str | None = None,
        since: str | None = None,
    ) -> list[FrontendErrorEventResponse]:
        """Return stored events matching the given filters."""
        return self._repository.list_events(
            limit=limit,
            source=source,
            level=level,
            fingerprint=fingerprint,
            since=since,
        )

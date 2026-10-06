"""Application service for backend telemetry inspection."""

from __future__ import annotations

from momentum.observability.models import StoredBackendLogEvent
from momentum.observability.repository import BackendTelemetryRepository


class BackendTelemetryService:
    """Expose read use cases for persisted backend telemetry."""

    def __init__(self, repository: BackendTelemetryRepository) -> None:
        self._repository = repository

    def list_events(
        self,
        *,
        limit: int = 100,
        level: str | None = None,
        fingerprint: str | None = None,
        request_id: str | None = None,
        since: str | None = None,
    ) -> list[StoredBackendLogEvent]:
        """Return stored backend events matching the requested filters."""
        return self._repository.list_events(
            limit=limit,
            level=level,
            fingerprint=fingerprint,
            request_id=request_id,
            since=since,
        )

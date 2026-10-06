"""HTTP API for inspecting persisted backend telemetry."""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, Query

from momentum.api.dependencies import get_backend_telemetry_service
from momentum.observability.schemas import (
    BackendLogEventResponse,
    backend_log_event_response,
)
from momentum.observability.service import BackendTelemetryService

router = APIRouter(
    prefix="/backend-logs",
    tags=["Backend Telemetry"],
)


@router.get(
    "",
    response_model=list[BackendLogEventResponse],
    summary="List backend log events",
    description="Return persisted backend warnings and errors for developer investigation.",
)
def list_events(
    limit: int = Query(
        default=100,
        ge=1,
        le=1_000,
        description="Maximum number of events to return.",
    ),
    level: Literal["WARNING", "ERROR", "CRITICAL"] | None = Query(
        default=None,
        description="Filter by persisted logging level.",
    ),
    fingerprint: str | None = Query(
        default=None,
        max_length=64,
        description="Filter by issue fingerprint.",
    ),
    request_id: str | None = Query(
        default=None,
        max_length=128,
        description="Filter by request correlation identifier.",
    ),
    since: str | None = Query(
        default=None,
        max_length=64,
        description="Return events with timestamp greater than or equal to this value.",
    ),
    service: BackendTelemetryService = Depends(get_backend_telemetry_service),
) -> list[BackendLogEventResponse]:
    """Return stored backend events newest first."""
    events = service.list_events(
        limit=limit,
        level=level,
        fingerprint=fingerprint,
        request_id=request_id,
        since=since,
    )
    return [backend_log_event_response(event) for event in events]

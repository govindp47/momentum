"""HTTP API router for frontend telemetry.

Endpoints:
  POST /api/v1/frontend-errors   — ingest a frontend error event
  GET  /api/v1/frontend-errors   — list stored events (developer inspection)
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, Query, Response, status

from momentum.api.dependencies import (
    get_current_session,
    get_frontend_telemetry_service,
    require_developer_mode,
)
from momentum.frontend_telemetry.schemas import (
    FrontendErrorEventRequest,
    FrontendErrorEventResponse,
)
from momentum.frontend_telemetry.service import FrontendTelemetryService

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/frontend-errors",
    tags=["Frontend Telemetry"],
)


@router.post(
    "",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Ingest a frontend error event",
    description=(
        "Persists a frontend error event for developer investigation. "
        "Always returns 204 — the frontend does not need to wait for a response body."
    ),
    dependencies=[Depends(get_current_session)],
)
def ingest_event(
    event: FrontendErrorEventRequest,
    service: FrontendTelemetryService = Depends(get_frontend_telemetry_service),
) -> Response:
    """Persist the event. Return 204 regardless of outcome to keep telemetry best-effort."""
    try:
        service.record_event(event)
    except Exception:
        # Log but do not surface telemetry storage failures to the frontend.
        # A failure here must never disrupt normal application behavior.
        logger.exception("Failed to store frontend telemetry event")

    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "",
    response_model=list[FrontendErrorEventResponse],
    summary="List frontend error events",
    description="Return stored frontend error events for developer inspection.",
    dependencies=[Depends(require_developer_mode)],
)
def list_events(
    limit: int = Query(
        default=100, ge=1, le=1000, description="Maximum number of events to return."
    ),
    source: str | None = Query(
        default=None,
        description="Filter by source (react|window|promise|api|application).",
    ),
    level: str | None = Query(default=None, description="Filter by level (error|warning)."),
    fingerprint: str | None = Query(
        default=None, description="Filter by fingerprint (group related events)."
    ),
    since: str | None = Query(
        default=None,
        description="Return events with timestamp >= this ISO-8601 value.",
    ),
    service: FrontendTelemetryService = Depends(get_frontend_telemetry_service),
) -> list[FrontendErrorEventResponse]:
    """Return stored events for developer inspection."""
    return service.list_events(
        limit=limit,
        source=source,
        level=level,
        fingerprint=fingerprint,
        since=since,
    )

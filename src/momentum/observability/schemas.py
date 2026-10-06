"""HTTP response schemas for backend telemetry inspection."""

from __future__ import annotations

from pydantic import BaseModel

from momentum.observability.models import StoredBackendLogEvent


class BackendLogEventResponse(BaseModel):
    """A stored backend warning or error returned for investigation."""

    db_id: int
    timestamp: str
    level: str
    logger_name: str
    source: str
    fingerprint: str
    request_id: str | None
    method: str | None
    path: str | None
    route: str | None
    status_code: int | None
    operation: str | None
    component: str | None
    module: str
    function: str
    exception_type: str | None
    message: str
    traceback: str | None
    application_version: str
    environment: str
    process_id: int
    thread_id: int
    python_version: str
    metadata: dict[str, object] | None
    created_at: str


def backend_log_event_response(event: StoredBackendLogEvent) -> BackendLogEventResponse:
    """Serialize a stored backend event at the HTTP boundary."""
    return BackendLogEventResponse(
        db_id=event.db_id,
        timestamp=event.timestamp,
        level=event.level,
        logger_name=event.logger_name,
        source=event.source,
        fingerprint=event.fingerprint,
        request_id=event.request_id,
        method=event.method,
        path=event.path,
        route=event.route,
        status_code=event.status_code,
        operation=event.operation,
        component=event.component,
        module=event.module,
        function=event.function,
        exception_type=event.exception_type,
        message=event.message,
        traceback=event.traceback,
        application_version=event.application_version,
        environment=event.environment,
        process_id=event.process_id,
        thread_id=event.thread_id,
        python_version=event.python_version,
        metadata=event.metadata,
        created_at=event.created_at,
    )

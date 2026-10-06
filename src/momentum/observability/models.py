"""Typed values persisted for backend warning and error telemetry."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class BackendLogEvent:
    """One normalized backend warning, error, or critical event."""

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
    metadata_json: str | None
    created_at: str


@dataclass(frozen=True, slots=True)
class StoredBackendLogEvent:
    """One backend telemetry event read from persistent storage."""

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

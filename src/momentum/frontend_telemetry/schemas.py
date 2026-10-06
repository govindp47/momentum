"""Pydantic schemas for the frontend telemetry API.

These schemas define the HTTP contract for:
  POST /api/v1/frontend-errors  — ingest a telemetry event
  GET  /api/v1/frontend-errors  — list stored events (developer inspection)
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class RuntimeContextSchema(BaseModel):
    """Runtime context captured at the time of the error."""

    app_version: str
    user_agent: str
    viewport_width: int
    viewport_height: int
    online_status: bool


class FrontendErrorEventRequest(BaseModel):
    """Incoming telemetry event from the frontend."""

    # Identity
    id: str = Field(..., description="Client-generated UUID for this occurrence.")
    timestamp: str = Field(..., description="UTC ISO-8601 timestamp.")
    fingerprint: str = Field(..., description="Stable deterministic fingerprint.")

    # Classification
    level: str = Field(..., description="'error' or 'warning'.")
    source: str = Field(..., description="Origin: react|window|promise|api|application.")
    error_name: str | None = None
    message: str = Field(..., max_length=2000)

    # Location
    route: str | None = None
    url: str | None = None
    component: str | None = None
    operation: str | None = None

    # Error details
    stack: str | None = None
    component_stack: str | None = None
    cause: str | None = None

    # Global error location
    filename: str | None = None
    error_lineno: int | None = None
    error_colno: int | None = None

    # API context
    http_method: str | None = None
    endpoint: str | None = None
    status_code: int | None = None

    # Runtime
    runtime: RuntimeContextSchema

    # Metadata
    metadata: dict[str, Any] | None = None


class FrontendErrorEventResponse(BaseModel):
    """Stored telemetry event returned from GET /api/v1/frontend-errors."""

    # Storage identity
    db_id: int
    created_at: str

    # All event fields (mirrors the request, from database)
    id: str
    timestamp: str
    fingerprint: str
    level: str
    source: str
    error_name: str | None = None
    message: str
    route: str | None = None
    url: str | None = None
    component: str | None = None
    operation: str | None = None
    stack: str | None = None
    component_stack: str | None = None
    cause: str | None = None
    filename: str | None = None
    error_lineno: int | None = None
    error_colno: int | None = None
    http_method: str | None = None
    endpoint: str | None = None
    status_code: int | None = None
    app_version: str
    user_agent: str
    viewport_width: int
    viewport_height: int
    online_status: bool
    metadata: dict[str, Any] | None = None

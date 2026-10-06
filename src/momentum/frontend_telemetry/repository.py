"""Repository layer for frontend telemetry events.

All SQL for the frontend_error_events table lives here.
"""

from __future__ import annotations

import json
import sqlite3
from datetime import UTC, datetime
from typing import Any

from momentum.frontend_telemetry.schemas import (
    FrontendErrorEventRequest,
    FrontendErrorEventResponse,
)

# Maximum number of events to retain.  When this limit is exceeded, the oldest
# events are deleted so the table never grows unbounded.
MAX_RETAINED_EVENTS = 1_000


class FrontendTelemetryRepository:
    """Persistence operations for frontend error events."""

    def __init__(self, connection: sqlite3.Connection) -> None:
        self._connection = connection

    # ------------------------------------------------------------------
    # Write
    # ------------------------------------------------------------------

    def insert(self, event: FrontendErrorEventRequest) -> FrontendErrorEventResponse:
        """Persist a frontend telemetry event and enforce the retention limit."""
        now = _utc_now()
        metadata_json = json.dumps(event.metadata) if event.metadata is not None else None

        cursor = self._connection.execute(
            """
            INSERT INTO frontend_error_events (
                event_id,
                timestamp,
                fingerprint,
                level,
                source,
                error_name,
                message,
                route,
                url,
                component,
                operation,
                stack,
                component_stack,
                cause,
                filename,
                error_lineno,
                error_colno,
                http_method,
                endpoint,
                status_code,
                app_version,
                user_agent,
                viewport_width,
                viewport_height,
                online_status,
                metadata_json,
                created_at
            )
            VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?, ?
            )
            """,
            (
                event.id,
                event.timestamp,
                event.fingerprint,
                event.level,
                event.source,
                event.error_name,
                event.message,
                event.route,
                event.url,
                event.component,
                event.operation,
                event.stack,
                event.component_stack,
                event.cause,
                event.filename,
                event.error_lineno,
                event.error_colno,
                event.http_method,
                event.endpoint,
                event.status_code,
                event.runtime.app_version,
                event.runtime.user_agent,
                event.runtime.viewport_width,
                event.runtime.viewport_height,
                1 if event.runtime.online_status else 0,
                metadata_json,
                _serialize_datetime(now),
            ),
        )

        db_id = cursor.lastrowid
        if db_id is None:
            raise RuntimeError("Failed to obtain inserted event DB id.")

        # Enforce retention: delete oldest events beyond the limit.
        self._enforce_retention()

        return self._get_by_db_id(db_id)

    # ------------------------------------------------------------------
    # Read
    # ------------------------------------------------------------------

    def list_events(
        self,
        *,
        limit: int = 100,
        source: str | None = None,
        level: str | None = None,
        fingerprint: str | None = None,
        since: str | None = None,
    ) -> list[FrontendErrorEventResponse]:
        """Return events matching the given filters, newest first."""
        conditions: list[str] = []
        params: list[Any] = []

        if source:
            conditions.append("source = ?")
            params.append(source)
        if level:
            conditions.append("level = ?")
            params.append(level)
        if fingerprint:
            conditions.append("fingerprint = ?")
            params.append(fingerprint)
        if since:
            conditions.append("timestamp >= ?")
            params.append(since)

        where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        params.append(min(limit, 1000))  # hard cap

        rows = self._connection.execute(
            f"""
            SELECT
                id,
                event_id,
                timestamp,
                fingerprint,
                level,
                source,
                error_name,
                message,
                route,
                url,
                component,
                operation,
                stack,
                component_stack,
                cause,
                filename,
                error_lineno,
                error_colno,
                http_method,
                endpoint,
                status_code,
                app_version,
                user_agent,
                viewport_width,
                viewport_height,
                online_status,
                metadata_json,
                created_at
            FROM frontend_error_events
            {where}
            ORDER BY id DESC
            LIMIT ?
            """,
            params,
        ).fetchall()

        return [_response_from_row(row) for row in rows]

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _get_by_db_id(self, db_id: int) -> FrontendErrorEventResponse:
        row = self._connection.execute(
            """
            SELECT
                id,
                event_id,
                timestamp,
                fingerprint,
                level,
                source,
                error_name,
                message,
                route,
                url,
                component,
                operation,
                stack,
                component_stack,
                cause,
                filename,
                error_lineno,
                error_colno,
                http_method,
                endpoint,
                status_code,
                app_version,
                user_agent,
                viewport_width,
                viewport_height,
                online_status,
                metadata_json,
                created_at
            FROM frontend_error_events
            WHERE id = ?
            """,
            (db_id,),
        ).fetchone()

        if row is None:
            raise RuntimeError(f"Inserted telemetry event {db_id} could not be retrieved.")

        return _response_from_row(row)

    def _enforce_retention(self) -> None:
        """Delete the oldest events when total count exceeds MAX_RETAINED_EVENTS."""
        self._connection.execute(
            """
            DELETE FROM frontend_error_events
            WHERE id NOT IN (
                SELECT id
                FROM frontend_error_events
                ORDER BY id DESC
                LIMIT ?
            )
            """,
            (MAX_RETAINED_EVENTS,),
        )


# ---------------------------------------------------------------------------
# Row → response helpers
# ---------------------------------------------------------------------------


def _response_from_row(row: sqlite3.Row) -> FrontendErrorEventResponse:
    metadata: dict[str, Any] | None = None
    raw_metadata = row["metadata_json"]
    if raw_metadata:
        try:
            metadata = json.loads(raw_metadata)
        except (json.JSONDecodeError, TypeError):
            metadata = None

    return FrontendErrorEventResponse(
        db_id=int(row["id"]),
        created_at=str(row["created_at"]),
        id=str(row["event_id"]),
        timestamp=str(row["timestamp"]),
        fingerprint=str(row["fingerprint"]),
        level=str(row["level"]),
        source=str(row["source"]),
        error_name=row["error_name"],
        message=str(row["message"]),
        route=row["route"],
        url=row["url"],
        component=row["component"],
        operation=row["operation"],
        stack=row["stack"],
        component_stack=row["component_stack"],
        cause=row["cause"],
        filename=row["filename"],
        error_lineno=row["error_lineno"],
        error_colno=row["error_colno"],
        http_method=row["http_method"],
        endpoint=row["endpoint"],
        status_code=row["status_code"],
        app_version=str(row["app_version"]),
        user_agent=str(row["user_agent"]),
        viewport_width=int(row["viewport_width"]),
        viewport_height=int(row["viewport_height"]),
        online_status=bool(row["online_status"]),
        metadata=metadata,
    )


def _utc_now() -> datetime:
    return datetime.now(UTC)


def _serialize_datetime(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%dT%H:%M:%S.%f+00:00")

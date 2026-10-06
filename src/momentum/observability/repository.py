"""SQLite persistence for backend developer telemetry."""

from __future__ import annotations

import json
import sqlite3
from typing import cast

from momentum.observability.models import BackendLogEvent, StoredBackendLogEvent

MAX_RETAINED_EVENTS = 2_000


class BackendTelemetryRepository:
    """Persist and retrieve normalized backend log events."""

    def __init__(self, connection: sqlite3.Connection) -> None:
        self._connection = connection

    def insert(self, event: BackendLogEvent) -> None:
        """Persist one event and delete events older than the retention cap."""
        self._connection.execute(
            """
            INSERT INTO backend_log_events (
                timestamp,
                level,
                logger_name,
                source,
                fingerprint,
                request_id,
                method,
                path,
                route,
                status_code,
                operation,
                component,
                module,
                function,
                exception_type,
                message,
                traceback,
                application_version,
                environment,
                process_id,
                thread_id,
                python_version,
                metadata_json,
                created_at
            )
            VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
            )
            """,
            (
                event.timestamp,
                event.level,
                event.logger_name,
                event.source,
                event.fingerprint,
                event.request_id,
                event.method,
                event.path,
                event.route,
                event.status_code,
                event.operation,
                event.component,
                event.module,
                event.function,
                event.exception_type,
                event.message,
                event.traceback,
                event.application_version,
                event.environment,
                event.process_id,
                event.thread_id,
                event.python_version,
                event.metadata_json,
                event.created_at,
            ),
        )
        self._enforce_retention()

    def list_events(
        self,
        *,
        limit: int = 100,
        level: str | None = None,
        fingerprint: str | None = None,
        request_id: str | None = None,
        since: str | None = None,
    ) -> list[StoredBackendLogEvent]:
        """Return matching backend events newest first."""
        conditions: list[str] = []
        parameters: list[object] = []

        if level is not None:
            conditions.append("level = ?")
            parameters.append(level)
        if fingerprint is not None:
            conditions.append("fingerprint = ?")
            parameters.append(fingerprint)
        if request_id is not None:
            conditions.append("request_id = ?")
            parameters.append(request_id)
        if since is not None:
            conditions.append("timestamp >= ?")
            parameters.append(since)

        where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        parameters.append(min(limit, 1_000))

        rows = self._connection.execute(
            f"""
            SELECT
                id,
                timestamp,
                level,
                logger_name,
                source,
                fingerprint,
                request_id,
                method,
                path,
                route,
                status_code,
                operation,
                component,
                module,
                function,
                exception_type,
                message,
                traceback,
                application_version,
                environment,
                process_id,
                thread_id,
                python_version,
                metadata_json,
                created_at
            FROM backend_log_events
            {where_clause}
            ORDER BY id DESC
            LIMIT ?
            """,
            parameters,
        ).fetchall()

        return [_stored_event_from_row(row) for row in rows]

    def _enforce_retention(self) -> None:
        self._connection.execute(
            """
            DELETE FROM backend_log_events
            WHERE id IN (
                SELECT id
                FROM backend_log_events
                ORDER BY id DESC
                LIMIT -1 OFFSET ?
            )
            """,
            (MAX_RETAINED_EVENTS,),
        )


def _stored_event_from_row(row: sqlite3.Row) -> StoredBackendLogEvent:
    return StoredBackendLogEvent(
        db_id=int(row["id"]),
        timestamp=str(row["timestamp"]),
        level=str(row["level"]),
        logger_name=str(row["logger_name"]),
        source=str(row["source"]),
        fingerprint=str(row["fingerprint"]),
        request_id=row["request_id"],
        method=row["method"],
        path=row["path"],
        route=row["route"],
        status_code=row["status_code"],
        operation=row["operation"],
        component=row["component"],
        module=str(row["module"]),
        function=str(row["function"]),
        exception_type=row["exception_type"],
        message=str(row["message"]),
        traceback=row["traceback"],
        application_version=str(row["application_version"]),
        environment=str(row["environment"]),
        process_id=int(row["process_id"]),
        thread_id=int(row["thread_id"]),
        python_version=str(row["python_version"]),
        metadata=_deserialize_metadata(row["metadata_json"]),
        created_at=str(row["created_at"]),
    )


def _deserialize_metadata(raw_metadata: object) -> dict[str, object] | None:
    if not isinstance(raw_metadata, str) or not raw_metadata:
        return None

    try:
        decoded = cast(object, json.loads(raw_metadata))
    except json.JSONDecodeError:
        return None

    if not isinstance(decoded, dict):
        return None

    mapping = cast(dict[object, object], decoded)
    return {str(key): value for key, value in mapping.items()}

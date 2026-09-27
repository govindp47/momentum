"""Progress event repository — persistence operations for progress_events."""

from __future__ import annotations

import sqlite3
from datetime import date, datetime

from momentum.stride.domain.enums import EventType
from momentum.stride.domain.errors import ProgressEventNotFound
from momentum.stride.domain.models import DailyActivity, ProgressEvent


def _row_to_event(row: sqlite3.Row) -> ProgressEvent:
    """Convert a database row into a domain ProgressEvent."""
    return ProgressEvent(
        id=row["id"],
        journey_id=row["journey_id"],
        milestone_id=row["milestone_id"],
        event_type=EventType(row["event_type"]),
        value=(float(row["value"]) if row["value"] is not None else None),
        duration_seconds=(
            int(row["duration_seconds"]) if row["duration_seconds"] is not None else None
        ),
        occurred_at=datetime.fromisoformat(row["occurred_at"]),
        note=row["note"],
        created_at=datetime.fromisoformat(row["created_at"]),
    )


class ProgressRepository:
    """Data access for the progress_events table.

    Repositories never commit transactions. The service layer owns
    transaction boundaries.
    """

    def __init__(self, conn: sqlite3.Connection) -> None:
        self._conn = conn

    def create(
        self,
        *,
        journey_id: int,
        event_type: EventType,
        value: float | None,
        occurred_at: datetime,
        milestone_id: int | None = None,
        duration_seconds: int | None = None,
        note: str | None = None,
    ) -> ProgressEvent:
        """Persist a progress event."""
        now = datetime.now().isoformat(timespec="seconds")

        cursor = self._conn.execute(
            """
            INSERT INTO progress_events (
                journey_id,
                milestone_id,
                event_type,
                value,
                duration_seconds,
                occurred_at,
                note,
                created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                journey_id,
                milestone_id,
                event_type.value,
                value,
                duration_seconds,
                occurred_at.isoformat(timespec="seconds"),
                note,
                now,
            ),
        )

        event_id = cursor.lastrowid
        if event_id is None:
            raise RuntimeError("Failed to obtain ID for newly created progress event.")

        return self.get_by_id(event_id)

    def get_by_id(self, event_id: int) -> ProgressEvent:
        """Return a progress event by ID."""
        row = self._conn.execute(
            """
            SELECT *
            FROM progress_events
            WHERE id = ?
            """,
            (event_id,),
        ).fetchone()

        if row is None:
            raise ProgressEventNotFound(event_id)

        return _row_to_event(row)

    def list_for_journey(
        self,
        journey_id: int,
        *,
        start_date: date | None = None,
        end_date: date | None = None,
        event_type: EventType | None = None,
        limit: int | None = None,
    ) -> list[ProgressEvent]:
        """Return events for a journey with optional filters."""
        conditions = ["journey_id = ?"]
        params: list[object] = [journey_id]

        if start_date is not None:
            conditions.append("date(occurred_at) >= ?")
            params.append(start_date.isoformat())

        if end_date is not None:
            conditions.append("date(occurred_at) <= ?")
            params.append(end_date.isoformat())

        if event_type is not None:
            conditions.append("event_type = ?")
            params.append(event_type.value)

        sql = f"""
            SELECT *
            FROM progress_events
            WHERE {" AND ".join(conditions)}
            ORDER BY occurred_at DESC, id DESC
        """

        if limit is not None:
            if limit <= 0:
                raise ValueError("limit must be greater than zero.")

            sql += " LIMIT ?"
            params.append(limit)

        rows = self._conn.execute(sql, params).fetchall()

        return [_row_to_event(row) for row in rows]

    def list_for_milestone(
        self,
        milestone_id: int,
    ) -> list[ProgressEvent]:
        """Return all events associated with a milestone."""
        rows = self._conn.execute(
            """
            SELECT *
            FROM progress_events
            WHERE milestone_id = ?
            ORDER BY occurred_at ASC, id ASC
            """,
            (milestone_id,),
        ).fetchall()

        return [_row_to_event(row) for row in rows]

    def find_milestone_completion_event(
        self,
        milestone_id: int,
    ) -> ProgressEvent | None:
        """Return the milestone completion event, if present."""
        row = self._conn.execute(
            """
            SELECT *
            FROM progress_events
            WHERE milestone_id = ?
              AND event_type = ?
            ORDER BY id DESC
            LIMIT 1
            """,
            (
                milestone_id,
                EventType.MILESTONE_COMPLETED.value,
            ),
        ).fetchone()

        return _row_to_event(row) if row is not None else None

    def sum_value_for_journey(
        self,
        journey_id: int,
        *,
        start_date: date | None = None,
        end_date: date | None = None,
    ) -> float:
        """Return the sum of numeric progress values."""
        conditions = [
            "journey_id = ?",
            "event_type = ?",
        ]
        params: list[object] = [
            journey_id,
            EventType.PROGRESS.value,
        ]

        self._append_date_filters(
            conditions,
            params,
            start_date,
            end_date,
        )

        row = self._conn.execute(
            f"""
            SELECT COALESCE(SUM(value), 0)
            FROM progress_events
            WHERE {" AND ".join(conditions)}
            """,
            params,
        ).fetchone()

        return float(row[0])

    def sum_duration_for_journey(
        self,
        journey_id: int,
        *,
        start_date: date | None = None,
        end_date: date | None = None,
    ) -> int:
        """Return total duration in seconds."""
        conditions = [
            "journey_id = ?",
            "event_type = ?",
        ]
        params: list[object] = [
            journey_id,
            EventType.PROGRESS.value,
        ]

        self._append_date_filters(
            conditions,
            params,
            start_date,
            end_date,
        )

        row = self._conn.execute(
            f"""
            SELECT COALESCE(SUM(duration_seconds), 0)
            FROM progress_events
            WHERE {" AND ".join(conditions)}
            """,
            params,
        ).fetchone()

        return int(row[0])

    def daily_totals_for_journey(
        self,
        journey_id: int,
        *,
        start_date: date | None = None,
        end_date: date | None = None,
    ) -> list[DailyActivity]:
        """Return aggregated progress for each active calendar day."""
        conditions = [
            "journey_id = ?",
            "event_type = ?",
        ]
        params: list[object] = [
            journey_id,
            EventType.PROGRESS.value,
        ]

        self._append_date_filters(
            conditions,
            params,
            start_date,
            end_date,
        )

        rows = self._conn.execute(
            f"""
            SELECT
                date(occurred_at) AS day,
                event_type,
                COALESCE(SUM(value), 0) AS total_value,
                COALESCE(SUM(duration_seconds), 0)
                    AS total_duration_seconds,
                COUNT(*) AS event_count
            FROM progress_events
            WHERE {" AND ".join(conditions)}
            GROUP BY day
            ORDER BY day ASC
            """,
            params,
        ).fetchall()

        return [
            DailyActivity(
                date=date.fromisoformat(row["day"]),
                total_value=float(row["total_value"]),
                total_duration_seconds=int(row["total_duration_seconds"]),
                event_count=int(row["event_count"]),
                event_type=EventType(row["event_type"]),
            )
            for row in rows
        ]

    def daily_activity_for_journey(
        self,
        journey_id: int,
        *,
        start_date: date | None = None,
        end_date: date | None = None,
    ) -> list[DailyActivity]:
        """Return daily activity grouped by calendar day and event type."""
        conditions = ["journey_id = ?"]
        params: list[object] = [journey_id]

        self._append_date_filters(
            conditions,
            params,
            start_date,
            end_date,
        )

        rows = self._conn.execute(
            f"""
            SELECT
                date(occurred_at) AS day,
                event_type,
                COALESCE(SUM(value), 0) AS total_value,
                COALESCE(SUM(duration_seconds), 0)
                    AS total_duration_seconds,
                COUNT(*) AS event_count
            FROM progress_events
            WHERE {" AND ".join(conditions)}
            GROUP BY day, event_type
            ORDER BY day ASC, event_type ASC
            """,
            params,
        ).fetchall()

        return [
            DailyActivity(
                date=date.fromisoformat(row["day"]),
                total_value=float(row["total_value"]),
                total_duration_seconds=int(row["total_duration_seconds"]),
                event_count=int(row["event_count"]),
                event_type=EventType(row["event_type"]),
            )
            for row in rows
        ]

    def active_days_count(
        self,
        journey_id: int,
        *,
        start_date: date | None = None,
        end_date: date | None = None,
    ) -> int:
        """Return the number of calendar days with progress."""
        conditions = [
            "journey_id = ?",
            "event_type = ?",
        ]
        params: list[object] = [
            journey_id,
            EventType.PROGRESS.value,
        ]

        self._append_date_filters(
            conditions,
            params,
            start_date,
            end_date,
        )

        row = self._conn.execute(
            f"""
            SELECT COUNT(DISTINCT date(occurred_at))
            FROM progress_events
            WHERE {" AND ".join(conditions)}
            """,
            params,
        ).fetchone()

        return int(row[0])

    def event_count_for_journey(self, journey_id: int) -> int:
        """Return the number of normal progress events."""
        row = self._conn.execute(
            """
            SELECT COUNT(*)
            FROM progress_events
            WHERE journey_id = ?
              AND event_type = ?
            """,
            (
                journey_id,
                EventType.PROGRESS.value,
            ),
        ).fetchone()

        return int(row[0])

    def total_event_count(self) -> int:
        """Return the total number of normal progress events."""
        row = self._conn.execute(
            """
            SELECT COUNT(*)
            FROM progress_events
            WHERE event_type = ?
            """,
            (EventType.PROGRESS.value,),
        ).fetchone()

        return int(row[0])

    def update(
        self,
        event_id: int,
        *,
        value: float | None = None,
        clear_value: bool = False,
        duration_seconds: int | None = None,
        clear_duration: bool = False,
        occurred_at: datetime | None = None,
        note: str | None = None,
        clear_note: bool = False,
    ) -> ProgressEvent:
        """Update a progress event.

        Validation of whether a particular event type may contain a value
        or duration belongs to the service/domain layer.
        """
        current = self.get_by_id(event_id)

        if clear_value:
            updated_value = None
        elif value is not None:
            updated_value = value
        else:
            updated_value = current.value

        if clear_duration:
            updated_duration = None
        elif duration_seconds is not None:
            updated_duration = duration_seconds
        else:
            updated_duration = current.duration_seconds

        if clear_note:
            updated_note = None
        elif note is not None:
            updated_note = note
        else:
            updated_note = current.note

        updated_occurred_at = occurred_at if occurred_at is not None else current.occurred_at

        self._conn.execute(
            """
            UPDATE progress_events
            SET
                value = ?,
                duration_seconds = ?,
                occurred_at = ?,
                note = ?
            WHERE id = ?
            """,
            (
                updated_value,
                updated_duration,
                updated_occurred_at.isoformat(timespec="seconds"),
                updated_note,
                event_id,
            ),
        )

        return self.get_by_id(event_id)

    def delete(self, event_id: int) -> None:
        """Delete a progress event."""
        self.get_by_id(event_id)

        self._conn.execute(
            """
            DELETE FROM progress_events
            WHERE id = ?
            """,
            (event_id,),
        )

    @staticmethod
    def _append_date_filters(
        conditions: list[str],
        params: list[object],
        start_date: date | None,
        end_date: date | None,
    ) -> None:
        """Append optional calendar-date filters to a SQL query."""
        if start_date is not None:
            conditions.append("date(occurred_at) >= ?")
            params.append(start_date.isoformat())

        if end_date is not None:
            conditions.append("date(occurred_at) <= ?")
            params.append(end_date.isoformat())

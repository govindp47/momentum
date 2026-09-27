"""Journey repository — persistence operations for the journeys table."""

from __future__ import annotations

import sqlite3
from datetime import date, datetime

from momentum.stride.domain.enums import JourneyStatus, TrackingMethod
from momentum.stride.domain.errors import JourneyNotFound
from momentum.stride.domain.models import Journey


def _row_to_journey(row: sqlite3.Row) -> Journey:
    """Convert a database row into a domain Journey."""
    return Journey(
        id=row["id"],
        name=row["name"],
        description=row["description"],
        tracking_method=TrackingMethod(row["tracking_method"]),
        target_value=float(row["target_value"]),
        unit=row["unit"],
        status=JourneyStatus(row["status"]),
        start_date=date.fromisoformat(row["start_date"]),
        target_date=(
            date.fromisoformat(row["target_date"]) if row["target_date"] is not None else None
        ),
        created_at=datetime.fromisoformat(row["created_at"]),
        updated_at=datetime.fromisoformat(row["updated_at"]),
    )


class JourneyRepository:
    """Data access for the journeys table.

    Repositories do not commit transactions. Transaction ownership belongs
    to the application/service layer.
    """

    def __init__(self, conn: sqlite3.Connection) -> None:
        self._conn = conn

    def create(
        self,
        *,
        name: str,
        description: str,
        tracking_method: TrackingMethod,
        target_value: float,
        unit: str | None,
        start_date: date,
        target_date: date | None = None,
    ) -> Journey:
        """Persist a new journey."""
        now = datetime.now().isoformat(timespec="seconds")

        cursor = self._conn.execute(
            """
            INSERT INTO journeys (
                name,
                description,
                tracking_method,
                target_value,
                unit,
                start_date,
                target_date,
                created_at,
                updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                name,
                description,
                tracking_method.value,
                target_value,
                unit,
                start_date.isoformat(),
                target_date.isoformat() if target_date else None,
                now,
                now,
            ),
        )

        journey_id = cursor.lastrowid
        if journey_id is None:
            raise RuntimeError("Failed to obtain ID for newly created journey.")

        return self.get_by_id(journey_id)

    def get_by_id(self, journey_id: int) -> Journey:
        """Return a journey by ID or raise JourneyNotFound."""
        row = self._conn.execute(
            """
            SELECT *
            FROM journeys
            WHERE id = ?
            """,
            (journey_id,),
        ).fetchone()

        if row is None:
            raise JourneyNotFound(journey_id)

        return _row_to_journey(row)

    def get_by_name(self, name: str) -> Journey:
        """Return a journey by exact name or raise JourneyNotFound."""
        journey = self.find_by_name(name)

        if journey is None:
            raise JourneyNotFound(name)

        return journey

    def find_by_name(self, name: str) -> Journey | None:
        """Return a journey by exact name, or None if it does not exist."""
        row = self._conn.execute(
            """
            SELECT *
            FROM journeys
            WHERE name = ?
            """,
            (name,),
        ).fetchone()

        return _row_to_journey(row) if row is not None else None

    def list_all(self) -> list[Journey]:
        """Return all journeys ordered by creation time."""
        rows = self._conn.execute(
            """
            SELECT *
            FROM journeys
            ORDER BY created_at, id
            """
        ).fetchall()

        return [_row_to_journey(row) for row in rows]

    def list_active(self) -> list[Journey]:
        """Return all active journeys."""
        return self.list_by_status(JourneyStatus.ACTIVE)

    def list_by_status(self, status: JourneyStatus) -> list[Journey]:
        """Return all journeys having the given lifecycle status."""
        rows = self._conn.execute(
            """
            SELECT *
            FROM journeys
            WHERE status = ?
            ORDER BY created_at, id
            """,
            (status.value,),
        ).fetchall()

        return [_row_to_journey(row) for row in rows]

    def update(
        self,
        journey_id: int,
        *,
        name: str | None = None,
        description: str | None = None,
        target_value: float | None = None,
        unit: str | None = None,
        clear_unit: bool = False,
        target_date: date | None = None,
        clear_target_date: bool = False,
        status: JourneyStatus | None = None,
    ) -> Journey:
        """Update supplied journey fields.

        Business validation is intentionally handled by the service layer.
        This method only persists the requested changes.
        """
        current = self.get_by_id(journey_id)

        updated_name = name if name is not None else current.name
        updated_description = description if description is not None else current.description
        updated_target_value = target_value if target_value is not None else current.target_value

        if clear_unit:
            updated_unit = None
        elif unit is not None:
            updated_unit = unit
        else:
            updated_unit = current.unit

        if clear_target_date:
            updated_target_date = None
        elif target_date is not None:
            updated_target_date = target_date
        else:
            updated_target_date = current.target_date

        updated_status = status if status is not None else current.status

        now = datetime.now().isoformat(timespec="seconds")

        self._conn.execute(
            """
            UPDATE journeys
            SET
                name = ?,
                description = ?,
                target_value = ?,
                unit = ?,
                target_date = ?,
                status = ?,
                updated_at = ?
            WHERE id = ?
            """,
            (
                updated_name,
                updated_description,
                updated_target_value,
                updated_unit,
                (updated_target_date.isoformat() if updated_target_date is not None else None),
                updated_status.value,
                now,
                journey_id,
            ),
        )

        return self.get_by_id(journey_id)

    def delete(self, journey_id: int) -> None:
        """Delete a journey.

        Referential cleanup is delegated to the database foreign-key
        configuration.
        """
        self.get_by_id(journey_id)

        self._conn.execute(
            """
            DELETE FROM journeys
            WHERE id = ?
            """,
            (journey_id,),
        )

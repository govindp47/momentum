"""Milestone repository — persistence operations for milestones."""

from __future__ import annotations

import sqlite3
from datetime import datetime

from momentum.stride.domain.enums import MilestoneStatus
from momentum.stride.domain.errors import MilestoneNotFound
from momentum.stride.domain.models import Milestone


def _row_to_milestone(row: sqlite3.Row) -> Milestone:
    """Convert a database row into a domain Milestone."""
    return Milestone(
        id=row["id"],
        journey_id=row["journey_id"],
        name=row["name"],
        description=row["description"],
        position=int(row["position"]),
        target_value=(float(row["target_value"]) if row["target_value"] is not None else None),
        unit=row["unit"],
        status=MilestoneStatus(row["status"]),
        created_at=datetime.fromisoformat(row["created_at"]),
        completed_at=(
            datetime.fromisoformat(row["completed_at"]) if row["completed_at"] is not None else None
        ),
    )


class MilestoneRepository:
    """Data access for the milestones table.

    Repositories do not commit transactions.
    """

    def __init__(self, conn: sqlite3.Connection) -> None:
        self._conn = conn

    def create(
        self,
        *,
        journey_id: int,
        name: str,
        description: str = "",
        position: int | None = None,
        target_value: float | None = None,
        unit: str | None = None,
    ) -> Milestone:
        """Persist a new milestone."""
        if position is None:
            row = self._conn.execute(
                """
                SELECT COALESCE(MAX(position), -1) + 1
                FROM milestones
                WHERE journey_id = ?
                """,
                (journey_id,),
            ).fetchone()

            position = int(row[0])

        now = datetime.now().isoformat(timespec="seconds")

        cursor = self._conn.execute(
            """
            INSERT INTO milestones (
                journey_id,
                name,
                description,
                position,
                target_value,
                unit,
                created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                journey_id,
                name,
                description,
                position,
                target_value,
                unit,
                now,
            ),
        )

        milestone_id = cursor.lastrowid
        if milestone_id is None:
            raise RuntimeError("Failed to obtain ID for newly created milestone.")

        return self.get_by_id(milestone_id)

    def get_by_id(self, milestone_id: int) -> Milestone:
        """Return a milestone by ID."""
        row = self._conn.execute(
            """
            SELECT *
            FROM milestones
            WHERE id = ?
            """,
            (milestone_id,),
        ).fetchone()

        if row is None:
            raise MilestoneNotFound(milestone_id)

        return _row_to_milestone(row)

    def list_for_journey(self, journey_id: int) -> list[Milestone]:
        """Return milestones in their configured order."""
        rows = self._conn.execute(
            """
            SELECT *
            FROM milestones
            WHERE journey_id = ?
            ORDER BY position ASC, id ASC
            """,
            (journey_id,),
        ).fetchall()

        return [_row_to_milestone(row) for row in rows]

    def update(
        self,
        milestone_id: int,
        *,
        name: str | None = None,
        description: str | None = None,
        target_value: float | None = None,
        clear_target_value: bool = False,
        unit: str | None = None,
        clear_unit: bool = False,
        position: int | None = None,
        status: MilestoneStatus | None = None,
        completed_at: datetime | None = None,
        clear_completed_at: bool = False,
    ) -> Milestone:
        """Update supplied milestone fields."""
        current = self.get_by_id(milestone_id)

        if clear_target_value:
            updated_target_value = None
        elif target_value is not None:
            updated_target_value = target_value
        else:
            updated_target_value = current.target_value

        if clear_unit:
            updated_unit = None
        elif unit is not None:
            updated_unit = unit
        else:
            updated_unit = current.unit

        if clear_completed_at:
            updated_completed_at = None
        elif completed_at is not None:
            updated_completed_at = completed_at
        else:
            updated_completed_at = current.completed_at

        self._conn.execute(
            """
            UPDATE milestones
            SET
                name = ?,
                description = ?,
                position = ?,
                target_value = ?,
                unit = ?,
                status = ?,
                completed_at = ?
            WHERE id = ?
            """,
            (
                name if name is not None else current.name,
                (description if description is not None else current.description),
                position if position is not None else current.position,
                updated_target_value,
                updated_unit,
                status.value if status is not None else current.status.value,
                (updated_completed_at.isoformat() if updated_completed_at is not None else None),
                milestone_id,
            ),
        )

        return self.get_by_id(milestone_id)

    def reorder(
        self,
        journey_id: int,
        ordered_ids: list[int],
    ) -> None:
        """Persist milestone ordering for a journey.

        The service layer must validate that ordered_ids contains exactly
        every milestone belonging to the journey.
        """
        if not ordered_ids:
            return

        # Two-phase update prevents a UNIQUE(position) constraint, if later
        # introduced, from causing transient conflicts.
        offset = len(ordered_ids)

        for position, milestone_id in enumerate(ordered_ids):
            self._conn.execute(
                """
                UPDATE milestones
                SET position = ?
                WHERE id = ?
                  AND journey_id = ?
                """,
                (
                    position + offset,
                    milestone_id,
                    journey_id,
                ),
            )

        for position, milestone_id in enumerate(ordered_ids):
            self._conn.execute(
                """
                UPDATE milestones
                SET position = ?
                WHERE id = ?
                  AND journey_id = ?
                """,
                (
                    position,
                    milestone_id,
                    journey_id,
                ),
            )

    def count_for_journey(self, journey_id: int) -> int:
        """Return the number of milestones in a journey."""
        row = self._conn.execute(
            """
            SELECT COUNT(*)
            FROM milestones
            WHERE journey_id = ?
            """,
            (journey_id,),
        ).fetchone()

        return int(row[0])

    def count_completed_for_journey(self, journey_id: int) -> int:
        """Return the number of completed milestones."""
        row = self._conn.execute(
            """
            SELECT COUNT(*)
            FROM milestones
            WHERE journey_id = ?
              AND status = ?
            """,
            (
                journey_id,
                MilestoneStatus.COMPLETED.value,
            ),
        ).fetchone()

        return int(row[0])

    def delete(self, milestone_id: int) -> None:
        """Delete a milestone."""
        self.get_by_id(milestone_id)

        self._conn.execute(
            """
            DELETE FROM milestones
            WHERE id = ?
            """,
            (milestone_id,),
        )

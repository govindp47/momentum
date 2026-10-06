"""SQLite schema migrations for Momentum.

Migrations are versioned and applied in ascending order. Each migration is
executed atomically and recorded in ``schema_migrations`` only after the
migration succeeds.

New migrations must be appended to ``MIGRATIONS`` and must never modify an
already-applied migration.
"""

from __future__ import annotations

import logging
import sqlite3
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass(frozen=True, slots=True)
class Migration:
    """A single versioned database migration."""

    version: int
    description: str
    statements: tuple[str, ...]


# ── Migration definitions ─────────────────────────────────────────────────────
#
# IMPORTANT:
# - Never modify an existing migration after it has been released/applied.
# - Add new migrations at the end.
# - Each migration must be deterministic and safe to run exactly once.
#
# Momentum combines the schemas previously owned by LifeLedger and Stride.
# The combined database has one migration history and one schema_migrations
# table. Therefore the two former v1 migrations become one initial migration.
#

MIGRATIONS: tuple[Migration, ...] = (
    Migration(
        version=1,
        description="Initial Momentum schema",
        statements=(
            # -----------------------------------------------------------------
            # LifeLedger schema
            # -----------------------------------------------------------------
            """
            CREATE TABLE tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL COLLATE NOCASE,
                cutoff_message TEXT NOT NULL,
                created_at TEXT NOT NULL,
                archived_at TEXT
            )
            """,
            """
            CREATE UNIQUE INDEX idx_tasks_active_name
            ON tasks(name COLLATE NOCASE)
            WHERE archived_at IS NULL
            """,
            """
            CREATE TABLE daily_entries (
                task_id INTEGER NOT NULL
                    REFERENCES tasks(id),
                date TEXT NOT NULL,
                completed INTEGER NOT NULL
                    CHECK (completed IN (0, 1)),
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                PRIMARY KEY (task_id, date)
            )
            """,
            """
            CREATE INDEX idx_daily_entries_date
            ON daily_entries(date)
            """,
            # -----------------------------------------------------------------
            # Stride schema
            # -----------------------------------------------------------------
            """
            CREATE TABLE journeys (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                name            TEXT NOT NULL COLLATE NOCASE UNIQUE,
                description     TEXT NOT NULL DEFAULT '',
                tracking_method TEXT NOT NULL CHECK (
                    tracking_method IN (
                        'milestone',
                        'count',
                        'quantity',
                        'duration'
                    )
                ),
                target_value    REAL NOT NULL CHECK (target_value > 0),
                unit            TEXT,
                status          TEXT NOT NULL DEFAULT 'active'
                                    CHECK (
                                        status IN (
                                            'active',
                                            'paused',
                                            'completed',
                                            'archived'
                                        )
                                    ),
                start_date      TEXT NOT NULL,
                target_date     TEXT,
                created_at      TEXT NOT NULL,
                updated_at      TEXT NOT NULL
            )
            """,
            """
            CREATE INDEX idx_journeys_status
                ON journeys(status);
            """,
            """
            CREATE INDEX idx_journeys_target_date
                ON journeys(target_date);
            """,
            """
            CREATE TABLE milestones (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                journey_id    INTEGER NOT NULL,
                name          TEXT NOT NULL,
                description   TEXT NOT NULL DEFAULT '',
                position      INTEGER NOT NULL CHECK (position >= 0),
                target_value  REAL,
                unit          TEXT,
                status        TEXT NOT NULL DEFAULT 'pending'
                                  CHECK (
                                      status IN (
                                          'pending',
                                          'completed'
                                      )
                                  ),
                created_at    TEXT NOT NULL,
                completed_at  TEXT,

                FOREIGN KEY (journey_id)
                    REFERENCES journeys(id)
                    ON DELETE CASCADE,

                UNIQUE (journey_id, id),

                UNIQUE (journey_id, position)
            )
            """,
            """
            CREATE INDEX idx_milestones_journey
                ON milestones(journey_id, position);
            """,
            """
            CREATE INDEX idx_milestones_status
                ON milestones(journey_id, status);
            """,
            """
            CREATE TABLE progress_events (
                id               INTEGER PRIMARY KEY AUTOINCREMENT,
                journey_id       INTEGER NOT NULL,
                milestone_id     INTEGER,
                event_type       TEXT NOT NULL CHECK (
                    event_type IN (
                        'progress',
                        'milestone_completed'
                    )
                ),
                value            REAL,
                duration_seconds INTEGER,
                occurred_at      TEXT NOT NULL,
                note             TEXT,
                created_at       TEXT NOT NULL,

                FOREIGN KEY (journey_id)
                    REFERENCES journeys(id)
                    ON DELETE CASCADE,

                FOREIGN KEY (milestone_id, journey_id)
                    REFERENCES milestones(id, journey_id)
                    ON DELETE SET NULL,

                CHECK (
                    value IS NOT NULL
                    OR duration_seconds IS NOT NULL
                ),

                CHECK (
                    value IS NULL
                    OR value > 0
                ),

                CHECK (
                    duration_seconds IS NULL
                    OR duration_seconds > 0
                ),

                CHECK (
                    event_type != 'milestone_completed'
                    OR milestone_id IS NOT NULL
                )
            )
            """,
            """
            CREATE INDEX idx_progress_events_journey
                ON progress_events(journey_id, occurred_at);
            """,
            """
            CREATE INDEX idx_progress_events_milestone
                ON progress_events(milestone_id);
            """,
            """
            CREATE INDEX idx_progress_events_occurred_at
                ON progress_events(occurred_at);
            """,
        ),
    ),
    Migration(
        version=2,
        description="Frontend error telemetry table",
        statements=(
            """
            CREATE TABLE frontend_error_events (
                id               INTEGER PRIMARY KEY AUTOINCREMENT,
                event_id         TEXT NOT NULL,
                timestamp        TEXT NOT NULL,
                fingerprint      TEXT NOT NULL,
                level            TEXT NOT NULL CHECK (level IN ('error', 'warning')),
                source           TEXT NOT NULL,
                error_name       TEXT,
                message          TEXT NOT NULL,
                route            TEXT,
                url              TEXT,
                component        TEXT,
                operation        TEXT,
                stack            TEXT,
                component_stack  TEXT,
                cause            TEXT,
                filename         TEXT,
                error_lineno     INTEGER,
                error_colno      INTEGER,
                http_method      TEXT,
                endpoint         TEXT,
                status_code      INTEGER,
                app_version      TEXT NOT NULL,
                user_agent       TEXT NOT NULL,
                viewport_width   INTEGER NOT NULL,
                viewport_height  INTEGER NOT NULL,
                online_status    INTEGER NOT NULL CHECK (online_status IN (0, 1)),
                metadata_json    TEXT,
                created_at       TEXT NOT NULL
            )
            """,
            """
            CREATE INDEX idx_frontend_errors_timestamp
                ON frontend_error_events(timestamp)
            """,
            """
            CREATE INDEX idx_frontend_errors_fingerprint
                ON frontend_error_events(fingerprint)
            """,
            """
            CREATE INDEX idx_frontend_errors_source
                ON frontend_error_events(source)
            """,
        ),
    ),
    Migration(
        version=3,
        description="Backend warning and error telemetry table",
        statements=(
            """
            CREATE TABLE backend_log_events (
                id                  INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp           TEXT NOT NULL,
                level               TEXT NOT NULL CHECK (
                    level IN ('WARNING', 'ERROR', 'CRITICAL')
                ),
                logger_name         TEXT NOT NULL,
                source              TEXT NOT NULL,
                fingerprint         TEXT NOT NULL,
                request_id          TEXT,
                method              TEXT,
                path                TEXT,
                route               TEXT,
                status_code         INTEGER,
                operation           TEXT,
                component           TEXT,
                module              TEXT NOT NULL,
                function            TEXT NOT NULL,
                exception_type      TEXT,
                message             TEXT NOT NULL,
                traceback           TEXT,
                application_version TEXT NOT NULL,
                environment         TEXT NOT NULL,
                process_id          INTEGER NOT NULL,
                thread_id           INTEGER NOT NULL,
                python_version      TEXT NOT NULL,
                metadata_json       TEXT,
                created_at          TEXT NOT NULL
            )
            """,
            """
            CREATE INDEX idx_backend_log_events_timestamp
                ON backend_log_events(timestamp)
            """,
            """
            CREATE INDEX idx_backend_log_events_fingerprint
                ON backend_log_events(fingerprint)
            """,
            """
            CREATE INDEX idx_backend_log_events_request_id
                ON backend_log_events(request_id)
            """,
            """
            CREATE INDEX idx_backend_log_events_level
                ON backend_log_events(level)
            """,
        ),
    ),
)


def _validate_migrations() -> None:
    """Validate the migration definitions before applying them."""
    versions = [migration.version for migration in MIGRATIONS]

    if any(version <= 0 for version in versions):
        raise RuntimeError("Migration versions must be positive integers.")

    if len(versions) != len(set(versions)):
        raise RuntimeError("Duplicate migration version detected.")

    if versions != sorted(versions):
        raise RuntimeError("Migrations must be declared in ascending version order.")


def _ensure_migration_table(conn: sqlite3.Connection) -> None:
    """Create the migration metadata table if it does not exist."""
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version     INTEGER PRIMARY KEY,
            description TEXT NOT NULL,
            applied_at  TEXT NOT NULL
        )
        """
    )


def _applied_versions(conn: sqlite3.Connection) -> set[int]:
    """Return all migration versions already applied."""
    rows = conn.execute("SELECT version FROM schema_migrations").fetchall()

    return {int(row[0]) for row in rows}


def _validate_applied_versions(
    applied: set[int],
) -> None:
    """Reject migration versions unknown to the application."""
    supported = {migration.version for migration in MIGRATIONS}

    unsupported = applied - supported

    if unsupported:
        versions = ", ".join(str(version) for version in sorted(unsupported))

        raise RuntimeError(
            f"unsupported schema version: {versions}",
        )


def run_migrations(conn: sqlite3.Connection) -> None:
    """Apply all pending migrations in version order.

    Each migration is executed inside its own transaction. A migration is
    recorded in ``schema_migrations`` only after its SQL has completed
    successfully.

    Raises:
        RuntimeError: If the migration definitions are invalid, an unsupported
            schema version is detected, or a migration fails.
    """
    _validate_migrations()
    _ensure_migration_table(conn)

    applied = _applied_versions(conn)

    _validate_applied_versions(applied)

    for migration in MIGRATIONS:
        if migration.version in applied:
            continue

        logger.info(
            "Applying migration v%d: %s",
            migration.version,
            migration.description,
        )

        try:
            with conn:
                for statement in migration.statements:
                    conn.execute(statement)

                conn.execute(
                    """
                    INSERT INTO schema_migrations (
                        version,
                        description,
                        applied_at
                    )
                    VALUES (?, ?, datetime('now'))
                    """,
                    (
                        migration.version,
                        migration.description,
                    ),
                )

        except sqlite3.Error as exc:
            raise RuntimeError(f"Migration v{migration.version} failed: {exc}") from exc

        logger.info(
            "Migration v%d applied successfully.",
            migration.version,
        )

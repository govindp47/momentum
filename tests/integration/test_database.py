"""Integration tests for the Momentum database lifecycle."""

from __future__ import annotations

import sqlite3
from pathlib import Path

import pytest

from momentum.app.context import AppContext
from momentum.config import AppConfig
from momentum.storage.database import Database
from momentum.storage.migrations import MIGRATIONS, Migration, run_migrations


class TestDatabase:
    def test_failed_migration_rolls_back_schema_and_version(
        self,
        tmp_path: Path,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        connection = sqlite3.connect(tmp_path / "failed-migration.db", isolation_level=None)
        migration = Migration(
            version=1,
            description="Deliberately failing migration",
            statements=(
                "CREATE TABLE should_be_rolled_back (id INTEGER PRIMARY KEY)",
                "CREATE TABLE invalid SQL",
            ),
        )
        monkeypatch.setattr("momentum.storage.migrations.MIGRATIONS", (migration,))

        try:
            with pytest.raises(RuntimeError, match="Migration v1 failed"):
                run_migrations(connection)
            table = connection.execute(
                "SELECT name FROM sqlite_master WHERE name = 'should_be_rolled_back'"
            ).fetchone()
            version = connection.execute(
                "SELECT version FROM schema_migrations WHERE version = 1"
            ).fetchone()
        finally:
            connection.close()

        assert table is None
        assert version is None

    def test_connect_creates_database_and_applies_migrations(
        self,
        tmp_path: Path,
    ) -> None:
        db_path = tmp_path / "nested" / "momentum.db"
        database = Database(db_path)

        assert not db_path.exists()

        database.connect()

        try:
            assert db_path.exists()
            assert database.in_transaction is False

            tables = {
                row[0]
                for row in database.conn.execute(
                    """
                    SELECT name
                    FROM sqlite_master
                    WHERE type = 'table'
                    """
                )
            }

            assert "schema_migrations" in tables
            assert "tasks" in tables
            assert "daily_entries" in tables
            assert "journeys" in tables
            assert "milestones" in tables
            assert "progress_events" in tables
            assert "frontend_error_events" in tables
            assert "backend_log_events" in tables
            assert "auth_users" in tables
            assert "auth_sessions" in tables

            migration_count = database.conn.execute(
                "SELECT COUNT(*) FROM schema_migrations"
            ).fetchone()[0]

            assert migration_count == len(MIGRATIONS)
        finally:
            database.close()

    def test_connect_upgrades_v1_database_to_current_schema(self, tmp_path: Path) -> None:
        """Connecting to a v1 database should apply the telemetry migration."""
        db_path = tmp_path / "momentum.db"
        connection = sqlite3.connect(db_path)

        try:
            connection.execute(
                """
                CREATE TABLE schema_migrations (
                    version     INTEGER PRIMARY KEY,
                    description TEXT NOT NULL,
                    applied_at  TEXT NOT NULL
                )
                """
            )
            for statement in MIGRATIONS[0].statements:
                connection.execute(statement)
            connection.execute(
                """
                INSERT INTO schema_migrations (version, description, applied_at)
                VALUES (?, ?, ?)
                """,
                (
                    MIGRATIONS[0].version,
                    MIGRATIONS[0].description,
                    "2026-10-01T00:00:00+00:00",
                ),
            )
            connection.commit()
        finally:
            connection.close()

        database = Database(db_path)
        database.connect()

        try:
            applied_versions = [
                row[0]
                for row in database.conn.execute(
                    "SELECT version FROM schema_migrations ORDER BY version"
                )
            ]
            table = database.conn.execute(
                """
                SELECT name
                FROM sqlite_master
                WHERE type = 'table' AND name = 'frontend_error_events'
                """
            ).fetchone()

            assert applied_versions == [migration.version for migration in MIGRATIONS]
            assert table is not None
        finally:
            database.close()

    def test_connect_upgrades_previous_schema_with_category_backfill(
        self,
        tmp_path: Path,
    ) -> None:
        """The category migration preserves tasks and entries and uses the legacy fallback."""
        db_path = tmp_path / "momentum-v6.db"
        connection = sqlite3.connect(db_path)

        try:
            connection.execute(
                """
                CREATE TABLE schema_migrations (
                    version     INTEGER PRIMARY KEY,
                    description TEXT NOT NULL,
                    applied_at  TEXT NOT NULL
                )
                """
            )
            for migration in MIGRATIONS[:-1]:
                for statement in migration.statements:
                    connection.execute(statement)
                connection.execute(
                    """
                    INSERT INTO schema_migrations (version, description, applied_at)
                    VALUES (?, ?, ?)
                    """,
                    (migration.version, migration.description, "2026-10-01T00:00:00+00:00"),
                )

            cursor = connection.execute(
                """
                INSERT INTO tasks (name, cutoff_message, created_at)
                VALUES (?, ?, ?)
                """,
                ("Preserved task", "Keep me", "2026-10-01T00:00:00+00:00"),
            )
            task_id = cursor.lastrowid
            assert task_id is not None
            connection.execute(
                """
                INSERT INTO daily_entries (task_id, date, completed, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    task_id,
                    "2026-10-01",
                    1,
                    "2026-10-01T00:00:00+00:00",
                    "2026-10-01T00:00:00+00:00",
                ),
            )
            connection.commit()
        finally:
            connection.close()

        database = Database(db_path)
        database.connect()

        try:
            task = database.conn.execute(
                "SELECT name, cutoff_message, category FROM tasks WHERE id = ?",
                (task_id,),
            ).fetchone()
            entry = database.conn.execute(
                "SELECT completed FROM daily_entries WHERE task_id = ? AND date = ?",
                (task_id, "2026-10-01"),
            ).fetchone()
            versions = [
                row[0]
                for row in database.conn.execute(
                    "SELECT version FROM schema_migrations ORDER BY version"
                )
            ]

            assert tuple(task) == ("Preserved task", "Keep me", "habits_discipline")
            assert entry["completed"] == 1
            assert versions == [migration.version for migration in MIGRATIONS]
        finally:
            database.close()

    def test_connect_is_idempotent(self, tmp_path: Path) -> None:
        database = Database(tmp_path / "momentum.db")

        database.connect()

        first_connection = database.conn

        database.connect()

        try:
            assert database.conn is first_connection
            assert database.in_transaction is False
        finally:
            database.close()

    def test_connect_upgrades_previous_schema_to_auth_without_losing_data(
        self, tmp_path: Path
    ) -> None:
        """Connecting at v3 should append auth tables and preserve application data."""
        db_path = tmp_path / "momentum-v3.db"
        connection = sqlite3.connect(db_path)

        try:
            connection.execute(
                """
                CREATE TABLE schema_migrations (
                    version     INTEGER PRIMARY KEY,
                    description TEXT NOT NULL,
                    applied_at  TEXT NOT NULL
                )
                """
            )
            for migration in MIGRATIONS[:3]:
                for statement in migration.statements:
                    connection.execute(statement)
                connection.execute(
                    """
                    INSERT INTO schema_migrations (version, description, applied_at)
                    VALUES (?, ?, ?)
                    """,
                    (migration.version, migration.description, "2026-10-01T00:00:00+00:00"),
                )
            connection.execute(
                """
                INSERT INTO tasks (name, cutoff_message, created_at)
                VALUES (?, ?, ?)
                """,
                ("Preserved task", "Keep me", "2026-10-01T00:00:00+00:00"),
            )
            connection.commit()
        finally:
            connection.close()

        database = Database(db_path)
        database.connect()

        try:
            user_table = database.conn.execute(
                """
                SELECT name
                FROM sqlite_master WHERE type = 'table' AND name = 'auth_users'
                """
            ).fetchone()
            session_table = database.conn.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'auth_sessions'"
            ).fetchone()
            preserved_task = database.conn.execute(
                "SELECT name FROM tasks WHERE name = ?", ("Preserved task",)
            ).fetchone()
            owner_count = database.conn.execute("SELECT COUNT(*) FROM auth_users").fetchone()[0]
            versions = [
                row[0]
                for row in database.conn.execute(
                    "SELECT version FROM schema_migrations ORDER BY version"
                )
            ]
            assert user_table is not None
            assert session_table is not None
            assert preserved_task[0] == "Preserved task"
            assert owner_count == 0
            assert versions == [migration.version for migration in MIGRATIONS]
        finally:
            database.close()

    def test_connect_repairs_missing_auth_owner_timestamps(self, tmp_path: Path) -> None:
        """Upgrade malformed pre-v5 owner records without breaking authentication reads."""
        db_path = tmp_path / "momentum-v4-missing-owner-timestamps.db"
        connection = sqlite3.connect(db_path)

        try:
            connection.execute(
                """
                CREATE TABLE schema_migrations (
                    version     INTEGER PRIMARY KEY,
                    description TEXT NOT NULL,
                    applied_at  TEXT NOT NULL
                )
                """
            )
            connection.execute(
                """
                CREATE TABLE tasks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL COLLATE NOCASE,
                    cutoff_message TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    archived_at TEXT
                )
                """
            )
            connection.execute(
                """
                CREATE TABLE auth_users (
                    id            INTEGER PRIMARY KEY CHECK (id = 1),
                    name          TEXT NOT NULL,
                    username      TEXT NOT NULL COLLATE NOCASE UNIQUE,
                    password_hash TEXT NOT NULL,
                    created_at    TEXT,
                    updated_at    TEXT
                )
                """
            )
            connection.execute(
                """
                INSERT INTO auth_users (id, name, username, password_hash, created_at, updated_at)
                VALUES (1, 'Owner', 'owner', 'not-used', NULL, NULL)
                """
            )
            for migration in MIGRATIONS[:4]:
                connection.execute(
                    """
                    INSERT INTO schema_migrations (version, description, applied_at)
                    VALUES (?, ?, ?)
                    """,
                    (migration.version, migration.description, "2026-10-01T00:00:00+00:00"),
                )
            connection.commit()
        finally:
            connection.close()

        database = Database(db_path)
        database.connect()

        try:
            row = database.conn.execute(
                "SELECT created_at, updated_at FROM auth_users WHERE id = 1"
            ).fetchone()
            versions = [
                row[0]
                for row in database.conn.execute(
                    "SELECT version FROM schema_migrations ORDER BY version"
                )
            ]

            assert row is not None
            assert row["created_at"] == row["updated_at"] == "1970-01-01T00:00:00+00:00"
            assert versions == [migration.version for migration in MIGRATIONS]
            with pytest.raises(
                sqlite3.IntegrityError, match="auth_users timestamps cannot be null"
            ):
                database.conn.execute("UPDATE auth_users SET created_at = NULL WHERE id = 1")
        finally:
            database.close()

    def test_close_disconnects_database(self, tmp_path: Path) -> None:
        database = Database(tmp_path / "momentum.db")

        database.connect()
        database.close()

        with pytest.raises(RuntimeError, match="Database is not connected"):
            _ = database.conn

    def test_close_is_idempotent(self, tmp_path: Path) -> None:
        database = Database(tmp_path / "momentum.db")

        database.connect()

        database.close()
        database.close()

        with pytest.raises(RuntimeError, match="Database is not connected"):
            _ = database.conn

    def test_context_manager_connects_and_closes_database(
        self,
        tmp_path: Path,
    ) -> None:
        db_path = tmp_path / "momentum.db"

        with Database(db_path) as database:
            assert database.conn is not None
            assert database.in_transaction is False

            tables = {
                row[0]
                for row in database.conn.execute(
                    """
                    SELECT name
                    FROM sqlite_master
                    WHERE type = 'table'
                    """
                )
            }

            assert "schema_migrations" in tables

        with pytest.raises(RuntimeError, match="Database is not connected"):
            _ = database.conn

    def test_context_close_failure_does_not_replace_primary_exception(
        self,
        tmp_path: Path,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        database = Database(tmp_path / "context-close-failure.db")
        database.connect()

        def fail_close() -> None:
            raise RuntimeError("secondary close failure")

        monkeypatch.setattr(database, "close", fail_close)

        try:
            with (
                pytest.raises(ValueError, match="primary context failure") as captured,
                database,
            ):
                raise ValueError("primary context failure")

            assert captured.value.__notes__ == [
                "Database context cleanup also failed with RuntimeError."
            ]
        finally:
            monkeypatch.undo()
            database.close()

    def test_app_context_close_failure_does_not_replace_primary_exception(
        self,
        tmp_path: Path,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        context = AppContext(AppConfig(data_dir=tmp_path, db_path=tmp_path / "context.db"))

        def fail_close() -> None:
            raise RuntimeError("secondary application context close failure")

        monkeypatch.setattr(context, "close", fail_close)

        try:
            with (
                pytest.raises(ValueError, match="primary context failure") as captured,
                context,
            ):
                raise ValueError("primary context failure")

            assert captured.value.__notes__ == [
                "Application context cleanup also failed with RuntimeError."
            ]
        finally:
            monkeypatch.undo()
            context.close()

    def test_conn_requires_connection(self, tmp_path: Path) -> None:
        database = Database(tmp_path / "momentum.db")

        with pytest.raises(RuntimeError, match="Database is not connected"):
            _ = database.conn

    def test_transaction_commits_on_success(self, tmp_path: Path) -> None:
        database = Database(tmp_path / "momentum.db")
        database.connect()

        try:
            with database.transaction():
                database.conn.execute(
                    """
                    INSERT INTO tasks (
                        name,
                        cutoff_message,
                        created_at
                    )
                    VALUES (?, ?, ?)
                    """,
                    (
                        "Exercise",
                        "Complete today's exercise.",
                        "2026-01-01T00:00:00+00:00",
                    ),
                )

            assert database.in_transaction is False

            row = database.conn.execute(
                """
                SELECT name, cutoff_message
                FROM tasks
                WHERE name = ?
                """,
                ("Exercise",),
            ).fetchone()

            assert row is not None
            assert row["name"] == "Exercise"
            assert row["cutoff_message"] == "Complete today's exercise."
        finally:
            database.close()

    def test_transaction_rolls_back_on_exception(
        self,
        tmp_path: Path,
    ) -> None:
        database = Database(tmp_path / "momentum.db")
        database.connect()

        try:
            with (
                pytest.raises(ValueError, match="force rollback"),
                database.transaction(),
            ):
                database.conn.execute(
                    """
                    INSERT INTO tasks (
                        name,
                        cutoff_message,
                        created_at
                    )
                    VALUES (?, ?, ?)
                    """,
                    (
                        "Exercise",
                        "Complete today's exercise.",
                        "2026-01-01T00:00:00+00:00",
                    ),
                )

                raise ValueError("force rollback")

            assert database.in_transaction is False

            count = database.conn.execute(
                "SELECT COUNT(*) FROM tasks WHERE name = ?",
                ("Exercise",),
            ).fetchone()[0]

            assert count == 0
        finally:
            database.close()

    def test_transaction_rolls_back_when_commit_fails(self, tmp_path: Path) -> None:
        database = Database(tmp_path / "commit-failure.db")
        database.connect()

        try:
            database.conn.execute("CREATE TABLE parents (id INTEGER PRIMARY KEY)")
            database.conn.execute(
                """
                CREATE TABLE children (
                    id INTEGER PRIMARY KEY,
                    parent_id INTEGER NOT NULL,
                    FOREIGN KEY (parent_id) REFERENCES parents(id)
                        DEFERRABLE INITIALLY DEFERRED
                )
                """
            )

            with (
                pytest.raises(sqlite3.IntegrityError, match="FOREIGN KEY constraint failed"),
                database.transaction(),
            ):
                database.conn.execute("INSERT INTO children (id, parent_id) VALUES (1, 999)")

            assert database.in_transaction is False
            count = database.conn.execute("SELECT COUNT(*) FROM children").fetchone()[0]
            assert count == 0
        finally:
            database.close()

    def test_rollback_failure_does_not_replace_primary_exception(
        self,
        tmp_path: Path,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        database = Database(tmp_path / "rollback-failure.db")
        database.connect()

        def fail_rollback() -> None:
            raise RuntimeError("secondary rollback failure")

        monkeypatch.setattr(database, "rollback", fail_rollback)

        try:
            with (
                pytest.raises(ValueError, match="primary operation failure") as captured,
                database.transaction(),
            ):
                raise ValueError("primary operation failure")

            assert captured.value.__notes__ == [
                "Transaction rollback also failed with RuntimeError."
            ]
        finally:
            monkeypatch.undo()
            database.rollback()
            database.close()

    def test_transaction_rejects_nested_transaction(
        self,
        tmp_path: Path,
    ) -> None:
        database = Database(tmp_path / "momentum.db")
        database.connect()

        try:
            with database.transaction():
                assert database.in_transaction

                with (
                    pytest.raises(
                        RuntimeError,
                        match="Cannot start a transaction while another transaction is active",
                    ),
                    database.transaction(),
                ):
                    pass

                # The failed nested transaction must not implicitly end the
                # outer transaction.
                assert database.in_transaction
        finally:
            database.close()

    def test_begin_starts_transaction(self, tmp_path: Path) -> None:
        database = Database(tmp_path / "momentum.db")
        database.connect()

        try:
            assert not database.in_transaction

            database.begin()

            assert database.in_transaction

            database.rollback()

            assert not database.in_transaction
        finally:
            database.close()

    def test_begin_rejects_active_transaction(self, tmp_path: Path) -> None:
        database = Database(tmp_path / "momentum.db")
        database.connect()

        try:
            database.begin()

            with pytest.raises(
                RuntimeError,
                match="Cannot start a transaction while another transaction is active",
            ):
                database.begin()

            assert database.in_transaction is True

            database.rollback()
        finally:
            database.close()

    def test_commit_persists_active_transaction(self, tmp_path: Path) -> None:
        database = Database(tmp_path / "momentum.db")
        database.connect()

        try:
            database.begin()

            database.conn.execute(
                """
                INSERT INTO tasks (
                    name,
                    cutoff_message,
                    created_at
                )
                VALUES (?, ?, ?)
                """,
                (
                    "Reading",
                    "Read before the cutoff.",
                    "2026-01-01T00:00:00+00:00",
                ),
            )

            assert database.in_transaction

            database.commit()

            assert not database.in_transaction

            count = database.conn.execute(
                "SELECT COUNT(*) FROM tasks WHERE name = ?",
                ("Reading",),
            ).fetchone()[0]

            assert count == 1
        finally:
            database.close()

    def test_rollback_discards_active_transaction(
        self,
        tmp_path: Path,
    ) -> None:
        database = Database(tmp_path / "momentum.db")
        database.connect()

        try:
            database.begin()

            database.conn.execute(
                """
                INSERT INTO tasks (
                    name,
                    cutoff_message,
                    created_at
                )
                VALUES (?, ?, ?)
                """,
                (
                    "Reading",
                    "Read before the cutoff.",
                    "2026-01-01T00:00:00+00:00",
                ),
            )

            assert database.in_transaction

            database.rollback()

            assert not database.in_transaction

            count = database.conn.execute(
                "SELECT COUNT(*) FROM tasks WHERE name = ?",
                ("Reading",),
            ).fetchone()[0]

            assert count == 0
        finally:
            database.close()

    def test_transaction_rolls_back_sqlite_integrity_error(
        self,
        tmp_path: Path,
    ) -> None:
        database = Database(tmp_path / "momentum.db")
        database.connect()

        try:
            with pytest.raises(sqlite3.IntegrityError), database.transaction():
                database.conn.execute(
                    """
                        INSERT INTO tasks (
                            name,
                            cutoff_message,
                            created_at
                        )
                        VALUES (?, ?, ?)
                        """,
                    (
                        "Exercise",
                        "Complete today's exercise.",
                        "2026-01-01T00:00:00+00:00",
                    ),
                )

                database.conn.execute(
                    """
                        INSERT INTO daily_entries (
                            task_id,
                            date,
                            completed,
                            created_at,
                            updated_at
                        )
                        VALUES (?, ?, ?, ?, ?)
                        """,
                    (
                        999999,
                        "2026-01-01",
                        1,
                        "2026-01-01T00:00:00+00:00",
                        "2026-01-01T00:00:00+00:00",
                    ),
                )

            assert database.in_transaction is False

            task_count = database.conn.execute(
                "SELECT COUNT(*) FROM tasks WHERE name = ?",
                ("Exercise",),
            ).fetchone()[0]

            assert task_count == 0
        finally:
            database.close()

    def test_foreign_keys_are_enabled(self, tmp_path: Path) -> None:
        database = Database(tmp_path / "momentum.db")
        database.connect()

        try:
            foreign_keys = database.conn.execute("PRAGMA foreign_keys").fetchone()[0]

            assert foreign_keys == 1
        finally:
            database.close()

    def test_row_factory_returns_sqlite_rows(self, tmp_path: Path) -> None:
        database = Database(tmp_path / "momentum.db")
        database.connect()

        try:
            row = database.conn.execute("SELECT 1 AS value").fetchone()

            assert isinstance(row, sqlite3.Row)
            assert row["value"] == 1
        finally:
            database.close()

    def test_database_reopens_existing_database(
        self,
        tmp_path: Path,
    ) -> None:
        db_path = tmp_path / "momentum.db"

        first_database = Database(db_path)
        first_database.connect()

        try:
            with first_database.transaction():
                first_database.conn.execute(
                    """
                    INSERT INTO tasks (
                        name,
                        cutoff_message,
                        created_at
                    )
                    VALUES (?, ?, ?)
                    """,
                    (
                        "Learning",
                        "Complete today's learning.",
                        "2026-01-01T00:00:00+00:00",
                    ),
                )
        finally:
            first_database.close()

        second_database = Database(db_path)
        second_database.connect()

        try:
            count = second_database.conn.execute(
                "SELECT COUNT(*) FROM tasks WHERE name = ?",
                ("Learning",),
            ).fetchone()[0]

            assert count == 1

            migration_count = second_database.conn.execute(
                "SELECT COUNT(*) FROM schema_migrations"
            ).fetchone()[0]

            assert migration_count == len(MIGRATIONS)
        finally:
            second_database.close()

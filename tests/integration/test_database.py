"""Integration tests for the Momentum database lifecycle."""

from __future__ import annotations

import sqlite3
from pathlib import Path

import pytest

from momentum.storage.database import Database
from momentum.storage.migrations import MIGRATIONS


class TestDatabase:
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

            migration_count = database.conn.execute(
                "SELECT COUNT(*) FROM schema_migrations"
            ).fetchone()[0]

            assert migration_count == len(MIGRATIONS)
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

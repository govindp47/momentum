"""SQLite database connection and transaction management for Momentum."""

from __future__ import annotations

import sqlite3
from collections.abc import Generator
from contextlib import contextmanager
from pathlib import Path

from momentum.storage.migrations import run_migrations


def _configure_connection(conn: sqlite3.Connection) -> None:
    """Apply Momentum's standard SQLite connection configuration."""
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA synchronous = NORMAL")
    conn.execute("PRAGMA busy_timeout = 5000")

    conn.row_factory = sqlite3.Row


class Database:
    """Own and manage the application's SQLite connection.

    A Database instance represents one application-level connection and
    provides connection and transaction lifecycle management.

    SQLite is configured in autocommit mode so that application services
    explicitly control transaction boundaries through ``transaction()``.
    """

    def __init__(self, db_path: Path) -> None:
        self._db_path = db_path
        self._conn: sqlite3.Connection | None = None

    def connect(self) -> None:
        """Open and configure the database connection.

        The parent directory is created automatically if necessary.
        Database migrations are applied after the connection is configured.

        SQLite runs in autocommit mode. Application-level transactions
        must therefore be explicitly started through ``transaction()``.
        """
        if self._conn is not None:
            return

        self._db_path.parent.mkdir(
            parents=True,
            exist_ok=True,
        )

        conn = sqlite3.connect(
            self._db_path,
            timeout=5.0,
            isolation_level=None,
            check_same_thread=False,
        )

        try:
            _configure_connection(conn)
            run_migrations(conn)

        except Exception:
            conn.close()
            raise

        self._conn = conn

    def close(self) -> None:
        """Close the database connection if it is open."""
        if self._conn is not None:
            self._conn.close()
            self._conn = None

    @property
    def db_path(self) -> Path:
        """Return the database path."""
        return self._db_path

    @property
    def conn(self) -> sqlite3.Connection:
        """Return the active SQLite connection."""
        if self._conn is None:
            raise RuntimeError(
                "Database is not connected. Call connect() first.",
            )

        return self._conn

    @property
    def in_transaction(self) -> bool:
        """Return whether the database currently has an active transaction."""
        return self.conn.in_transaction

    def begin(self) -> None:
        """Begin a new database transaction."""
        if self.conn.in_transaction:
            raise RuntimeError(
                "Cannot start a transaction while another transaction is active.",
            )

        self.conn.execute("BEGIN")

    def commit(self) -> None:
        """Commit the active database transaction."""
        if not self.conn.in_transaction:
            return

        self.conn.commit()

    def rollback(self) -> None:
        """Roll back the active database transaction."""
        if not self.conn.in_transaction:
            return

        self.conn.rollback()

    @contextmanager
    def transaction(self) -> Generator[None, None, None]:
        """Execute a block of database operations atomically.

        The transaction is committed when the block completes successfully.
        If any exception is raised, all changes made inside the block are
        rolled back and the exception is propagated.

        Repositories must not commit transactions themselves. Application
        services should use this helper for mutations that must be atomic.
        """
        if self.conn.in_transaction:
            raise RuntimeError(
                "Cannot start a transaction while another transaction is active.",
            )

        self.conn.execute("BEGIN")

        try:
            yield
        except Exception:
            self.conn.rollback()
            raise
        else:
            self.conn.commit()

    def __enter__(self) -> Database:
        """Open the database for a context-managed lifetime."""
        self.connect()
        return self

    def __exit__(
        self,
        exc_type: object,
        exc_value: object,
        traceback: object,
    ) -> None:
        """Close the database when leaving the context."""
        self.close()

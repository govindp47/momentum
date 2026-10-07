"""SQLite database connection and transaction management for Momentum."""

from __future__ import annotations

import sqlite3
from collections.abc import Buffer, Generator, Iterable, Iterator, Mapping, Sequence
from contextlib import contextmanager
from pathlib import Path
from threading import RLock
from typing import cast

from momentum.storage.migrations import run_migrations

type _SQLiteValue = str | Buffer | int | float | None
type _SQLiteParameters = Sequence[_SQLiteValue] | Mapping[str, _SQLiteValue]


class _LockedCursor:
    """Release a connection operation lock after consuming a query result."""

    def __init__(self, cursor: sqlite3.Cursor, operation_lock: RLock) -> None:
        self._cursor = cursor
        self._operation_lock = operation_lock
        self._released = False

    def fetchone(self) -> sqlite3.Row | tuple[object, ...] | None:
        try:
            return cast(sqlite3.Row | tuple[object, ...] | None, self._cursor.fetchone())
        finally:
            self._release()

    def fetchall(self) -> list[sqlite3.Row] | list[tuple[object, ...]]:
        try:
            return cast(
                list[sqlite3.Row] | list[tuple[object, ...]],
                self._cursor.fetchall(),
            )
        finally:
            self._release()

    def __iter__(self) -> Iterator[sqlite3.Row | tuple[object, ...]]:
        try:
            for row in self._cursor:
                yield cast(sqlite3.Row | tuple[object, ...], row)
        finally:
            self._release()

    @property
    def lastrowid(self) -> int | None:
        try:
            return self._cursor.lastrowid
        finally:
            self._release()

    @property
    def rowcount(self) -> int:
        try:
            return self._cursor.rowcount
        finally:
            self._release()

    def close(self) -> None:
        try:
            self._cursor.close()
        finally:
            self._release()

    def __del__(self) -> None:
        self._release()

    def _release(self) -> None:
        if not self._released:
            self._released = True
            self._operation_lock.release()


class _LockedConnection(sqlite3.Connection):
    """Serialize access to a connection shared by FastAPI worker threads."""

    @property
    def operation_lock(self) -> RLock:
        """Return the lock that guards all operations on this connection."""
        lock = getattr(self, "_operation_lock", None)
        if lock is None:
            lock = RLock()
            self._operation_lock = lock
        return lock

    def execute(self, sql: str, parameters: object = (), /) -> sqlite3.Cursor:
        operation_lock = self.operation_lock
        operation_lock.acquire()
        try:
            cursor = super().execute(sql, cast(_SQLiteParameters, parameters))
        except Exception:
            operation_lock.release()
            raise
        return cast(sqlite3.Cursor, _LockedCursor(cursor, operation_lock))

    def executemany(
        self,
        sql: str,
        parameters: object,
        /,
    ) -> sqlite3.Cursor:
        with self.operation_lock:
            return super().executemany(sql, cast(Iterable[_SQLiteParameters], parameters))

    def executescript(self, sql_script: str, /) -> sqlite3.Cursor:
        with self.operation_lock:
            return super().executescript(sql_script)

    def commit(self) -> None:
        with self.operation_lock:
            super().commit()

    def rollback(self) -> None:
        with self.operation_lock:
            super().rollback()

    def close(self) -> None:
        with self.operation_lock:
            super().close()


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
            factory=_LockedConnection,
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

    @property
    def _locked_connection(self) -> _LockedConnection:
        connection = self.conn
        if not isinstance(connection, _LockedConnection):
            raise RuntimeError("Database connection does not support synchronized access.")
        return connection

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
        with self._locked_connection.operation_lock:
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

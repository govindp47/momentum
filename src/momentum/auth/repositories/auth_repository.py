"""SQLite persistence for the single owner and authentication sessions."""

from __future__ import annotations

import sqlite3
from datetime import datetime

from momentum.auth.domain.errors import OwnerAlreadyExists
from momentum.auth.domain.models import Session, User, UserCredential


class AuthRepository:
    """Persist the singleton owner and server-side sessions."""

    def __init__(self, connection: sqlite3.Connection) -> None:
        self._connection = connection

    def owner_exists(self) -> bool:
        row = self._connection.execute("SELECT 1 FROM auth_users LIMIT 1").fetchone()
        return bool(row is not None)

    def create_owner(
        self,
        *,
        name: str,
        username: str,
        password_hash: str,
        now: datetime,
    ) -> User:
        timestamp = now.isoformat()
        try:
            cursor = self._connection.execute(
                """
                INSERT INTO auth_users (id, name, username, password_hash, created_at, updated_at)
                VALUES (1, ?, ?, ?, ?, ?)
                """,
                (name, username, password_hash, timestamp, timestamp),
            )
        except sqlite3.IntegrityError as exc:
            raise OwnerAlreadyExists("This Momentum database already has an owner.") from exc
        row = self._connection.execute(
            "SELECT id, name, username, created_at, updated_at FROM auth_users WHERE id = ?",
            (cursor.lastrowid,),
        ).fetchone()
        if row is None:
            raise RuntimeError("Created owner could not be loaded.")
        return _user_from_row(row)

    def get_owner_by_username(self, username: str) -> UserCredential | None:
        row = self._connection.execute(
            """
            SELECT id, name, username, password_hash, created_at, updated_at
            FROM auth_users
            WHERE username = ? COLLATE NOCASE
            """,
            (username,),
        ).fetchone()
        if row is None:
            return None
        return UserCredential(user=_user_from_row(row), password_hash=str(row["password_hash"]))

    def get_user(self, user_id: int) -> User | None:
        row = self._connection.execute(
            "SELECT id, name, username, created_at, updated_at FROM auth_users WHERE id = ?",
            (user_id,),
        ).fetchone()
        return _user_from_row(row) if row is not None else None

    def create_session(
        self,
        *,
        user_id: int,
        token_hash: str,
        now: datetime,
        expires_at: datetime,
    ) -> Session:
        cursor = self._connection.execute(
            """
            INSERT INTO auth_sessions (
                user_id, session_token_hash, created_at, last_seen_at, expires_at
            )
            VALUES (?, ?, ?, ?, ?)
            """,
            (user_id, token_hash, now.isoformat(), now.isoformat(), expires_at.isoformat()),
        )
        row = self._connection.execute(
            "SELECT * FROM auth_sessions WHERE id = ?",
            (cursor.lastrowid,),
        ).fetchone()
        if row is None:
            raise RuntimeError("Created session could not be loaded.")
        return _session_from_row(row)

    def find_active_session(self, token_hash: str, now: datetime) -> Session | None:
        row = self._connection.execute(
            """
            SELECT * FROM auth_sessions
            WHERE session_token_hash = ? AND revoked_at IS NULL AND expires_at > ?
            """,
            (token_hash, now.isoformat()),
        ).fetchone()
        return _session_from_row(row) if row is not None else None

    def get_active_session_by_id(self, session_id: int) -> Session | None:
        row = self._connection.execute(
            "SELECT * FROM auth_sessions WHERE id = ? AND revoked_at IS NULL",
            (session_id,),
        ).fetchone()
        return _session_from_row(row) if row is not None else None

    def touch_session(self, session_id: int, now: datetime) -> None:
        self._connection.execute(
            "UPDATE auth_sessions SET last_seen_at = ? WHERE id = ?",
            (now.isoformat(), session_id),
        )

    def revoke_session(self, token_hash: str, now: datetime) -> None:
        self._connection.execute(
            """
            UPDATE auth_sessions SET revoked_at = ?, developer_mode = 0
            WHERE session_token_hash = ? AND revoked_at IS NULL
            """,
            (now.isoformat(), token_hash),
        )

    def set_developer_mode(self, session_id: int, enabled: bool) -> None:
        self._connection.execute(
            "UPDATE auth_sessions SET developer_mode = ? WHERE id = ? AND revoked_at IS NULL",
            (int(enabled), session_id),
        )

    def delete_inactive_sessions(self, now: datetime) -> None:
        self._connection.execute(
            "DELETE FROM auth_sessions WHERE expires_at <= ? OR revoked_at IS NOT NULL",
            (now.isoformat(),),
        )


def _user_from_row(row: sqlite3.Row) -> User:
    return User(
        id=int(row["id"]),
        name=str(row["name"]),
        username=str(row["username"]),
        created_at=datetime.fromisoformat(str(row["created_at"])),
        updated_at=datetime.fromisoformat(str(row["updated_at"])),
    )


def _session_from_row(row: sqlite3.Row) -> Session:
    revoked_at = row["revoked_at"]
    return Session(
        id=int(row["id"]),
        user_id=int(row["user_id"]),
        created_at=datetime.fromisoformat(str(row["created_at"])),
        last_seen_at=datetime.fromisoformat(str(row["last_seen_at"])),
        expires_at=datetime.fromisoformat(str(row["expires_at"])),
        revoked_at=datetime.fromisoformat(str(revoked_at)) if revoked_at is not None else None,
        developer_mode=bool(row["developer_mode"]),
    )

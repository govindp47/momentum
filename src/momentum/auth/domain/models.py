"""Authentication domain values."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True, slots=True)
class User:
    """The database's single owner, excluding credential material."""

    id: int
    name: str
    username: str
    created_at: datetime
    updated_at: datetime


@dataclass(frozen=True, slots=True)
class UserCredential:
    """The owner plus the password hash needed only for verification."""

    user: User
    password_hash: str


@dataclass(frozen=True, slots=True)
class Session:
    """A persisted server-side authentication session."""

    id: int
    user_id: int
    created_at: datetime
    last_seen_at: datetime
    expires_at: datetime
    revoked_at: datetime | None
    developer_mode: bool


@dataclass(frozen=True, slots=True)
class CurrentSession:
    """A valid session paired with its owner."""

    user: User
    session: Session


@dataclass(frozen=True, slots=True)
class LoginResult:
    """A newly created session and its one-time raw browser token."""

    current_session: CurrentSession
    raw_token: str

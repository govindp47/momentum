"""Single-owner authentication workflows."""

from __future__ import annotations

import hashlib
import secrets
from collections.abc import Callable
from contextlib import AbstractContextManager
from datetime import UTC, datetime, timedelta

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError
from argon2.low_level import Type

from momentum.auth.domain.errors import (
    DeveloperAuthorizationRequired,
    InvalidCredentials,
    OwnerAlreadyExists,
)
from momentum.auth.domain.models import CurrentSession, LoginResult, User
from momentum.auth.domain.rules import (
    MAX_PASSWORD_LENGTH,
    MAX_USERNAME_LENGTH,
    normalize_username,
    validate_name,
    validate_password,
    validate_username,
)
from momentum.auth.repositories.auth_repository import AuthRepository

TransactionFactory = Callable[[], AbstractContextManager[None]]
Clock = Callable[[], datetime]
TokenFactory = Callable[[], str]

SESSION_TOUCH_INTERVAL = timedelta(hours=1)


def _utc_now() -> datetime:
    return datetime.now(UTC)


def _new_token() -> str:
    return secrets.token_urlsafe(32)


class AuthenticationService:
    """Orchestrate owner registration, sessions, and developer-mode state."""

    def __init__(
        self,
        repository: AuthRepository,
        transaction: TransactionFactory,
        *,
        developer_usernames: tuple[str, ...] = (),
        session_lifetime: timedelta = timedelta(days=30),
        clock: Clock = _utc_now,
        token_factory: TokenFactory = _new_token,
        cookie_secure: bool = False,
    ) -> None:
        self._repository = repository
        self._transaction = transaction
        self._developer_usernames = frozenset(
            normalize_username(username) for username in developer_usernames
        )
        self._session_lifetime = session_lifetime
        self._clock = clock
        self._token_factory = token_factory
        self._cookie_secure = cookie_secure
        self._password_hasher = PasswordHasher(type=Type.ID)
        self._dummy_password_hash = self._password_hasher.hash(_new_token())

    @property
    def session_lifetime(self) -> timedelta:
        return self._session_lifetime

    @property
    def cookie_secure(self) -> bool:
        return self._cookie_secure

    def is_initialized(self) -> bool:
        return self._repository.owner_exists()

    def signup(self, *, name: str, username: str, password: str) -> User:
        normalized_name = validate_name(name)
        normalized_username = validate_username(username)
        validate_password(password)
        password_hash = self._password_hasher.hash(password)
        now = self._clock()
        with self._transaction():
            if self._repository.owner_exists():
                raise OwnerAlreadyExists("This Momentum database already has an owner.")
            return self._repository.create_owner(
                name=normalized_name,
                username=normalized_username,
                password_hash=password_hash,
                now=now,
            )

    def login(self, *, username: str, password: str) -> LoginResult:
        normalized_username = normalize_username(username)
        credential = (
            self._repository.get_owner_by_username(normalized_username)
            if len(normalized_username) <= MAX_USERNAME_LENGTH
            else None
        )
        password_hash = (
            credential.password_hash if credential is not None else self._dummy_password_hash
        )
        password_valid = len(password) <= MAX_PASSWORD_LENGTH and self._password_matches(
            password_hash, password
        )
        if credential is None or not password_valid:
            raise InvalidCredentials("Invalid username or password.")

        now = self._clock()
        raw_token = self._token_factory()
        with self._transaction():
            self._repository.delete_inactive_sessions(now)
            session = self._repository.create_session(
                user_id=credential.user.id,
                token_hash=_hash_token(raw_token),
                now=now,
                expires_at=now + self._session_lifetime,
            )
        return LoginResult(
            current_session=CurrentSession(user=credential.user, session=session),
            raw_token=raw_token,
        )

    def authenticate(self, raw_token: str | None) -> CurrentSession | None:
        if not raw_token:
            return None
        now = self._clock()
        session = self._repository.find_active_session(_hash_token(raw_token), now)
        if session is None:
            return None
        user = self._repository.get_user(session.user_id)
        if user is None:
            raise RuntimeError("Authentication session references a missing owner.")
        if now - session.last_seen_at >= SESSION_TOUCH_INTERVAL:
            with self._transaction():
                self._repository.touch_session(session.id, now)
        return CurrentSession(user=user, session=session)

    def logout(self, raw_token: str | None) -> None:
        if not raw_token:
            return
        with self._transaction():
            self._repository.revoke_session(_hash_token(raw_token), self._clock())

    def is_developer_authorized(self, user: User) -> bool:
        return normalize_username(user.username) in self._developer_usernames

    def developer_mode_active(self, current: CurrentSession) -> bool:
        return current.session.developer_mode and self.is_developer_authorized(current.user)

    def set_developer_mode(self, current: CurrentSession, *, enabled: bool) -> CurrentSession:
        if enabled and not self.is_developer_authorized(current.user):
            raise DeveloperAuthorizationRequired("Developer authorization is required.")
        with self._transaction():
            self._repository.set_developer_mode(current.session.id, enabled)
        session = self._repository.get_active_session_by_id(current.session.id)
        if session is None:
            raise RuntimeError("Authenticated session disappeared.")
        return CurrentSession(user=current.user, session=session)

    def _password_matches(self, password_hash: str, password: str) -> bool:
        try:
            return self._password_hasher.verify(password_hash, password)
        except (VerifyMismatchError, VerificationError, InvalidHashError):
            return False


def _hash_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()

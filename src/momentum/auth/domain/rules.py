"""Validation and normalization rules for authentication."""

from __future__ import annotations

import re

from momentum.auth.domain.errors import InvalidAuthenticationInput

MIN_PASSWORD_LENGTH = 12
MAX_PASSWORD_LENGTH = 128
MIN_USERNAME_LENGTH = 3
MAX_USERNAME_LENGTH = 64
MAX_NAME_LENGTH = 100

_USERNAME_PATTERN = re.compile(r"[a-z0-9][a-z0-9._-]*")


def normalize_username(username: str) -> str:
    """Return the canonical case-insensitive username representation."""
    return username.strip().casefold()


def validate_username(username: str) -> str:
    """Normalize and validate a username."""
    normalized = normalize_username(username)
    if not MIN_USERNAME_LENGTH <= len(normalized) <= MAX_USERNAME_LENGTH:
        raise InvalidAuthenticationInput(
            f"Username must be between {MIN_USERNAME_LENGTH} and {MAX_USERNAME_LENGTH} characters."
        )
    if _USERNAME_PATTERN.fullmatch(normalized) is None:
        raise InvalidAuthenticationInput(
            "Username may contain lowercase letters, numbers, dots, underscores, and hyphens."
        )
    return normalized


def validate_name(name: str) -> str:
    """Trim and validate the owner's display name."""
    normalized = name.strip()
    if not normalized or len(normalized) > MAX_NAME_LENGTH:
        raise InvalidAuthenticationInput(
            f"Name must be between 1 and {MAX_NAME_LENGTH} characters."
        )
    return normalized


def validate_password(password: str) -> None:
    """Enforce a bounded, length-based password policy."""
    if not MIN_PASSWORD_LENGTH <= len(password) <= MAX_PASSWORD_LENGTH:
        raise InvalidAuthenticationInput(
            f"Password must be between {MIN_PASSWORD_LENGTH} and {MAX_PASSWORD_LENGTH} characters."
        )

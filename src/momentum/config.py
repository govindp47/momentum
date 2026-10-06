"""Momentum application configuration."""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parents[2]

ENV_FILE = PROJECT_ROOT / ".env"

load_dotenv(ENV_FILE)

_ENV_DB_DIR = "MOMENTUM_DATA_DIR"
_DATA_DIR_NAME = ".momentum"
_DB_NAME = "tracker.db"
_ENV_LOG_LEVEL = "MOMENTUM_LOG_LEVEL"
_ENV_PERSISTENT_LOG_LEVEL = "MOMENTUM_PERSISTENT_LOG_LEVEL"
_ENVIRONMENT = "MOMENTUM_ENVIRONMENT"
_ENV_DEVELOPER_USERNAMES = "MOMENTUM_DEVELOPER_USERNAMES"
_ENV_AUTH_COOKIE_SECURE = "MOMENTUM_AUTH_COOKIE_SECURE"
_ENV_AUTH_SESSION_DAYS = "MOMENTUM_AUTH_SESSION_DAYS"

_LOG_LEVELS = {
    "DEBUG": logging.DEBUG,
    "INFO": logging.INFO,
    "WARNING": logging.WARNING,
    "ERROR": logging.ERROR,
    "CRITICAL": logging.CRITICAL,
}


@dataclass(frozen=True)
class AppConfig:
    """Runtime configuration for Momentum."""

    data_dir: Path
    db_path: Path
    log_level: int = logging.INFO
    persistent_log_level: int = logging.WARNING
    environment: str = "development"
    developer_usernames: tuple[str, ...] = ()
    auth_cookie_secure: bool = False
    auth_session_days: int = 30


def _read_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    normalized = value.strip().casefold()
    if normalized in {"1", "true", "yes", "on"}:
        return True
    if normalized in {"0", "false", "no", "off"}:
        return False
    raise ValueError(f"{name} must be a boolean value.")


def _read_session_days() -> int:
    raw_value = os.getenv(_ENV_AUTH_SESSION_DAYS, "30").strip()
    try:
        value = int(raw_value)
    except ValueError as exc:
        raise ValueError(f"{_ENV_AUTH_SESSION_DAYS} must be an integer.") from exc
    if not 1 <= value <= 365:
        raise ValueError(f"{_ENV_AUTH_SESSION_DAYS} must be between 1 and 365.")
    return value


def _read_log_level(name: str, default: str, *, minimum: int = logging.DEBUG) -> int:
    """Read and validate one standard Python logging level."""
    value = os.getenv(name, default).strip().upper()
    level = _LOG_LEVELS.get(value)

    if level is None or level < minimum:
        allowed = ", ".join(
            level_name for level_name, number in _LOG_LEVELS.items() if number >= minimum
        )
        raise ValueError(f"{name} must be one of: {allowed}.")

    return level


def get_config() -> AppConfig:
    """Return the active application configuration.

    The data directory can be overridden with the ``MOMENTUM_DATA_DIR``
    environment variable, which is useful for testing and custom setups.
    """
    override = os.getenv(_ENV_DB_DIR)

    data_dir = Path(override).expanduser() if override else Path.home()
    data_dir = data_dir / _DATA_DIR_NAME
    data_dir.mkdir(parents=True, exist_ok=True)
    environment = os.getenv(_ENVIRONMENT, "development").strip() or "development"

    return AppConfig(
        data_dir=data_dir,
        db_path=data_dir / _DB_NAME,
        log_level=_read_log_level(_ENV_LOG_LEVEL, "INFO"),
        persistent_log_level=_read_log_level(
            _ENV_PERSISTENT_LOG_LEVEL,
            "WARNING",
            minimum=logging.WARNING,
        ),
        environment=environment,
        developer_usernames=tuple(
            username.strip()
            for username in os.getenv(_ENV_DEVELOPER_USERNAMES, "").split(",")
            if username.strip()
        ),
        auth_cookie_secure=_read_bool(
            _ENV_AUTH_COOKIE_SECURE,
            environment.casefold() == "production",
        ),
        auth_session_days=_read_session_days(),
    )

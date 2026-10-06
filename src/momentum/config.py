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

    return AppConfig(
        data_dir=data_dir,
        db_path=data_dir / _DB_NAME,
        log_level=_read_log_level(_ENV_LOG_LEVEL, "INFO"),
        persistent_log_level=_read_log_level(
            _ENV_PERSISTENT_LOG_LEVEL,
            "WARNING",
            minimum=logging.WARNING,
        ),
        environment=os.getenv(_ENVIRONMENT, "development").strip() or "development",
    )

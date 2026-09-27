"""Momentum application configuration."""

from __future__ import annotations

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


@dataclass(frozen=True)
class AppConfig:
    """All runtime-configurable paths for Momentum."""

    data_dir: Path
    db_path: Path


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
    )

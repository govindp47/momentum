"""Tests for the application health and readiness endpoints."""

from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

from momentum.api.app import create_app
from momentum.config import AppConfig


def _app(tmp_path: Path):  # type: ignore[no-untyped-def]
    return create_app(
        config_factory=lambda: AppConfig(data_dir=tmp_path, db_path=tmp_path / "health.db")
    )


def test_health(tmp_path: Path) -> None:
    """Test the application health endpoint."""
    app = _app(tmp_path)

    with TestClient(app) as client:
        response = client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_readiness(tmp_path: Path) -> None:
    """Test the application readiness endpoint."""
    app = _app(tmp_path)

    with TestClient(app) as client:
        response = client.get("/api/v1/ready")

    assert response.status_code == 200
    assert response.json() == {"status": "ready"}

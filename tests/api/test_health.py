"""Tests for the application health and readiness endpoints."""

from __future__ import annotations

from fastapi.testclient import TestClient

from momentum.api.app import create_app


def test_health() -> None:
    """Test the application health endpoint."""
    app = create_app()

    with TestClient(app) as client:
        response = client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_readiness() -> None:
    """Test the application readiness endpoint."""
    app = create_app()

    with TestClient(app) as client:
        response = client.get("/api/v1/ready")

    assert response.status_code == 200
    assert response.json() == {"status": "ready"}

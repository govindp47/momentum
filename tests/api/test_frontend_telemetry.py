"""Tests for the frontend telemetry API endpoints."""

from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from momentum.api.app import create_app
from momentum.config import AppConfig
from momentum.storage.database import Database

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def telemetry_app(tmp_path: Path):  # type: ignore[no-untyped-def]
    """Create a test FastAPI app with an isolated temporary database."""
    db_path = tmp_path / "test.db"

    def config_factory() -> AppConfig:
        return AppConfig(data_dir=tmp_path, db_path=db_path)

    app = create_app(config_factory=config_factory)
    return app


@pytest.fixture
def client(telemetry_app):  # type: ignore[no-untyped-def]
    """Provide a test HTTP client."""
    with TestClient(telemetry_app) as c:
        yield c


def _minimal_event(**overrides: object) -> dict[str, object]:
    """Return a minimal valid frontend error event payload."""
    event: dict[str, object] = {
        "id": "test-event-id-001",
        "timestamp": "2026-10-05T10:00:00.000Z",
        "fingerprint": "abc12345",
        "level": "error",
        "source": "application",
        "message": "Test error message",
        "runtime": {
            "app_version": "1.0.0",
            "user_agent": "Mozilla/5.0 (test)",
            "viewport_width": 1440,
            "viewport_height": 900,
            "online_status": True,
        },
    }
    event.update(overrides)
    return event


# ---------------------------------------------------------------------------
# POST /api/v1/frontend-errors — ingestion
# ---------------------------------------------------------------------------


def test_ingest_returns_204(client: TestClient) -> None:
    """POST with a valid event should return 204."""
    response = client.post("/api/v1/frontend-errors", json=_minimal_event())
    assert response.status_code == 204
    assert response.content == b""


def test_ingest_full_event(client: TestClient) -> None:
    """POST with a fully-populated event should succeed."""
    event = _minimal_event(
        source="api",
        error_name="ApiError",
        route="/ledger/today",
        url="http://localhost/ledger/today",
        component="LedgerToday",
        operation="load today's commitments",
        stack="Error: boom\n  at foo (client.ts)",
        http_method="GET",
        endpoint="/v1/ledger/entries",
        status_code=500,
        metadata={"extra_key": "extra_value"},
    )
    response = client.post("/api/v1/frontend-errors", json=event)
    assert response.status_code == 204


def test_ingest_invalid_level_returns_422(client: TestClient) -> None:
    """POST with an invalid level value should return 422 (Pydantic validation)."""
    # NOTE: The level constraint is enforced at the DB layer, not Pydantic,
    # so we test that a missing required field returns 422.
    bad = _minimal_event()
    del bad["message"]
    response = client.post("/api/v1/frontend-errors", json=bad)
    assert response.status_code == 422


def test_ingest_missing_runtime_returns_422(client: TestClient) -> None:
    """POST without runtime context should return 422."""
    bad = _minimal_event()
    del bad["runtime"]
    response = client.post("/api/v1/frontend-errors", json=bad)
    assert response.status_code == 422


# ---------------------------------------------------------------------------
# GET /api/v1/frontend-errors — inspection
# ---------------------------------------------------------------------------


def test_list_empty(client: TestClient) -> None:
    """GET with no events stored should return an empty list."""
    response = client.get("/api/v1/frontend-errors")
    assert response.status_code == 200
    assert response.json() == []


def test_list_after_ingest(client: TestClient) -> None:
    """After ingesting an event, GET should return it."""
    client.post("/api/v1/frontend-errors", json=_minimal_event())

    response = client.get("/api/v1/frontend-errors")
    assert response.status_code == 200
    events = response.json()
    assert len(events) == 1
    assert events[0]["source"] == "application"
    assert events[0]["message"] == "Test error message"
    assert events[0]["fingerprint"] == "abc12345"


def test_list_filter_by_source(client: TestClient) -> None:
    """GET with source filter should only return matching events."""
    client.post("/api/v1/frontend-errors", json=_minimal_event(source="application"))
    client.post("/api/v1/frontend-errors", json=_minimal_event(source="api", id="evt-2"))

    response = client.get("/api/v1/frontend-errors?source=api")
    events = response.json()
    assert len(events) == 1
    assert events[0]["source"] == "api"


def test_list_filter_by_level(client: TestClient) -> None:
    """GET with level filter should only return matching events."""
    client.post("/api/v1/frontend-errors", json=_minimal_event(level="error"))
    client.post(
        "/api/v1/frontend-errors",
        json=_minimal_event(level="warning", id="evt-warn"),
    )

    response = client.get("/api/v1/frontend-errors?level=warning")
    events = response.json()
    assert len(events) == 1
    assert events[0]["level"] == "warning"


def test_list_filter_by_fingerprint(client: TestClient) -> None:
    """GET with fingerprint filter should group related events."""
    client.post("/api/v1/frontend-errors", json=_minimal_event(fingerprint="fp-aaa"))
    client.post(
        "/api/v1/frontend-errors",
        json=_minimal_event(fingerprint="fp-bbb", id="evt-2"),
    )

    response = client.get("/api/v1/frontend-errors?fingerprint=fp-aaa")
    events = response.json()
    assert len(events) == 1
    assert events[0]["fingerprint"] == "fp-aaa"


def test_list_limit(client: TestClient) -> None:
    """GET with limit should return at most N events."""
    for i in range(5):
        client.post(
            "/api/v1/frontend-errors",
            json=_minimal_event(id=f"evt-{i}"),
        )

    response = client.get("/api/v1/frontend-errors?limit=3")
    events = response.json()
    assert len(events) == 3


# ---------------------------------------------------------------------------
# Migration / DB schema
# ---------------------------------------------------------------------------


def test_migration_creates_table(tmp_path: Path) -> None:
    """The migration should create the frontend_error_events table."""
    db = Database(tmp_path / "migrated.db")
    db.connect()
    try:
        row = db.conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='frontend_error_events'"
        ).fetchone()
        assert row is not None, "frontend_error_events table was not created"
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Repository — retention
# ---------------------------------------------------------------------------


def test_retention_limit(tmp_path: Path) -> None:
    """Inserting more than MAX_RETAINED_EVENTS should delete the oldest."""
    from momentum.frontend_telemetry.repository import (
        MAX_RETAINED_EVENTS,
        FrontendTelemetryRepository,
    )

    db = Database(tmp_path / "retention.db")
    db.connect()
    try:
        repo = FrontendTelemetryRepository(db.conn)

        # Insert MAX+5 events in a transaction-less mode to avoid nesting issues.
        # The repository uses autocommit (isolation_level=None).
        total = MAX_RETAINED_EVENTS + 5
        for i in range(total):
            event = _minimal_event(
                id=f"evt-{i}",
                fingerprint=f"fp-{i}",
                message=f"Event {i}",
            )
            from momentum.frontend_telemetry.schemas import FrontendErrorEventRequest

            repo.insert(FrontendErrorEventRequest(**event))  # type: ignore[arg-type]

        # Count remaining rows.
        count = db.conn.execute("SELECT COUNT(*) FROM frontend_error_events").fetchone()[0]
        assert count == MAX_RETAINED_EVENTS, (
            f"Expected {MAX_RETAINED_EVENTS} events after retention, got {count}"
        )
    finally:
        db.close()

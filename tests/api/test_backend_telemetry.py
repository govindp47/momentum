"""API boundary tests for backend exception telemetry and request IDs."""

from __future__ import annotations

import logging
import sqlite3
from pathlib import Path

import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from momentum import __version__
from momentum.api.app import create_app
from momentum.api.dependencies import get_current_session
from momentum.config import AppConfig


@pytest.fixture
def backend_telemetry_app(tmp_path: Path) -> tuple[FastAPI, Path]:
    db_path = tmp_path / "backend-telemetry.db"

    def config_factory() -> AppConfig:
        return AppConfig(
            data_dir=tmp_path,
            db_path=db_path,
            log_level=logging.CRITICAL,
            persistent_log_level=logging.WARNING,
            environment="test",
            developer_usernames=("test-owner",),
        )

    app = create_app(config_factory=config_factory)

    @app.get("/api/v1/test-unexpected", dependencies=[Depends(get_current_session)])
    def unexpected() -> None:
        try:
            raise ValueError("repository-shaped failure")
        except ValueError as exc:
            raise RuntimeError("service-shaped failure") from exc

    return app, db_path


def _rows(db_path: Path) -> list[sqlite3.Row]:
    connection = sqlite3.connect(db_path)
    connection.row_factory = sqlite3.Row
    try:
        return connection.execute("SELECT * FROM backend_log_events ORDER BY id").fetchall()
    finally:
        connection.close()


def _authenticate(client: TestClient) -> None:
    signup = client.post(
        "/api/v1/auth/signup",
        json={"name": "Test Owner", "username": "test-owner", "password": "correct horse battery"},
    )
    assert signup.status_code == 201
    login = client.post(
        "/api/v1/auth/login",
        json={"username": "test-owner", "password": "correct horse battery"},
    )
    assert login.status_code == 200
    developer_mode = client.post("/api/v1/auth/developer-mode", json={"enabled": True})
    assert developer_mode.status_code == 200


def test_unexpected_exception_is_persisted_and_returns_safe_500(
    backend_telemetry_app: tuple[FastAPI, Path],
) -> None:
    app, db_path = backend_telemetry_app

    with TestClient(app) as client:
        _authenticate(client)
        raw_session_token = client.cookies.get("momentum_session")
        assert raw_session_token is not None
        response = client.get(
            "/api/v1/test-unexpected",
            headers={
                "X-Request-ID": "frontend-request-123",
                "Authorization": "Bearer must-not-be-stored",
            },
        )
        rows = _rows(db_path)
        list_response = client.get(
            "/api/v1/backend-logs",
            params={"request_id": "frontend-request-123"},
        )

    assert response.status_code == 500
    assert response.json() == {"detail": "Internal Server Error"}
    assert "traceback" not in response.text.lower()
    assert response.headers["X-Request-ID"] == "frontend-request-123"
    assert len(rows) == 1

    event = rows[0]
    assert event["level"] == "ERROR"
    assert event["exception_type"] == "RuntimeError"
    assert event["message"] == "Unhandled exception during HTTP request"
    assert "ValueError: repository-shaped failure" in event["traceback"]
    assert "direct cause" in event["traceback"]
    assert "RuntimeError: service-shaped failure" in event["traceback"]
    assert event["request_id"] == "frontend-request-123"
    assert event["method"] == "GET"
    assert event["path"] == "/api/v1/test-unexpected"
    assert event["route"] == "/api/v1/test-unexpected"
    assert event["status_code"] == 500
    assert event["operation"] == "http_request"
    assert event["component"] == "api"
    assert event["logger_name"] == "momentum.observability.middleware"
    assert event["module"] == "middleware"
    assert event["function"] == "__call__"
    assert event["application_version"] == __version__
    assert event["environment"] == "test"
    assert event["fingerprint"]
    assert "must-not-be-stored" not in " ".join(str(value) for value in event)
    assert raw_session_token not in " ".join(str(value) for value in event)

    assert list_response.status_code == 200
    listed_events = list_response.json()
    assert len(listed_events) == 1
    assert listed_events[0]["db_id"] == event["id"]
    assert listed_events[0]["request_id"] == "frontend-request-123"
    assert listed_events[0]["traceback"] == event["traceback"]
    assert listed_events[0]["metadata"] is None


def test_invalid_incoming_request_id_is_replaced(
    backend_telemetry_app: tuple[FastAPI, Path],
) -> None:
    app, _ = backend_telemetry_app

    with TestClient(app) as client:
        response = client.get(
            "/api/v1/health",
            headers={"X-Request-ID": "x" * 500},
        )

    request_id = response.headers["X-Request-ID"]
    assert request_id != "x" * 500
    assert len(request_id) == 32


def test_expected_404_and_validation_errors_are_not_persisted(
    backend_telemetry_app: tuple[FastAPI, Path],
) -> None:
    app, db_path = backend_telemetry_app

    with TestClient(app) as client:
        _authenticate(client)
        missing_route = client.get("/api/v1/not-a-route")
        missing_domain_resource = client.get("/api/v1/stride/journeys/not-present")
        invalid_request = client.post("/api/v1/stride/journeys", json={})
        rows = _rows(db_path)

    assert missing_route.status_code == 404
    assert missing_domain_resource.status_code == 404
    assert invalid_request.status_code == 422
    assert rows == []


def test_backend_log_endpoint_filters_and_orders_events(
    backend_telemetry_app: tuple[FastAPI, Path],
) -> None:
    app, _ = backend_telemetry_app
    telemetry_logger = logging.getLogger("momentum.tests.backend_api")

    with TestClient(app) as client:
        _authenticate(client)
        telemetry_logger.warning(
            "First warning",
            extra={
                "request_id": "request-warning",
                "details": {"attempt": 1},
            },
        )
        telemetry_logger.error(
            "Second error",
            extra={"request_id": "request-error"},
        )

        all_events = client.get("/api/v1/backend-logs")
        warning_events = client.get("/api/v1/backend-logs?level=WARNING")
        request_events = client.get("/api/v1/backend-logs?request_id=request-error&limit=1")
        future_events = client.get("/api/v1/backend-logs?since=9999-01-01T00:00:00Z")
        invalid_level = client.get("/api/v1/backend-logs?level=INFO")

    assert all_events.status_code == 200
    assert [event["message"] for event in all_events.json()] == [
        "Second error",
        "First warning",
    ]
    assert [event["level"] for event in warning_events.json()] == ["WARNING"]
    assert [event["request_id"] for event in request_events.json()] == ["request-error"]
    assert warning_events.json()[0]["metadata"] == {"details": {"attempt": 1}}
    assert future_events.json() == []
    assert invalid_level.status_code == 422


def test_readiness_infrastructure_failure_is_persisted(
    backend_telemetry_app: tuple[FastAPI, Path],
) -> None:
    app, db_path = backend_telemetry_app
    denied_readiness_select = False

    def fail_readiness_select(
        action_code: int,
        first_argument: str | None,
        second_argument: str | None,
        database_name: str | None,
        trigger_name: str | None,
    ) -> int:
        del first_argument, second_argument, database_name, trigger_name
        nonlocal denied_readiness_select
        if action_code == sqlite3.SQLITE_SELECT and not denied_readiness_select:
            denied_readiness_select = True
            return sqlite3.SQLITE_DENY
        return sqlite3.SQLITE_OK

    with TestClient(app) as client:
        connection = app.state.context.connection
        connection.set_authorizer(fail_readiness_select)
        try:
            response = client.get(
                "/api/v1/ready",
                headers={"X-Request-ID": "readiness-request"},
            )
        finally:
            connection.set_authorizer(None)
        rows = _rows(db_path)

    assert response.status_code == 503
    assert response.json() == {"status": "not_ready"}
    assert len(rows) == 1
    event = rows[0]
    assert event["level"] == "ERROR"
    assert event["operation"] == "readiness_check"
    assert event["status_code"] == 503
    assert event["request_id"] == "readiness-request"
    assert event["exception_type"] == "sqlite3.DatabaseError"
    assert "not authorized" in event["traceback"]

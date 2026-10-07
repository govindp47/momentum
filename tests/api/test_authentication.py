"""End-to-end API tests for single-owner authentication and authorization."""

from __future__ import annotations

import hashlib
import sqlite3
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from momentum.api.app import create_app
from momentum.config import AppConfig

PASSWORD = "correct horse battery"


@pytest.fixture
def auth_app(tmp_path: Path) -> tuple[FastAPI, Path]:
    db_path = tmp_path / "auth.db"
    app = create_app(
        config_factory=lambda: AppConfig(
            data_dir=tmp_path,
            db_path=db_path,
            environment="test",
            developer_usernames=(" owner ",),
            auth_session_days=14,
        )
    )
    return app, db_path


def _signup(client: TestClient, *, username: str = "owner") -> None:
    response = client.post(
        "/api/v1/auth/signup",
        json={"name": "Momentum Owner", "username": username, "password": PASSWORD},
    )
    assert response.status_code == 201


def _login(client: TestClient, *, username: str = "owner", password: str = PASSWORD):  # type: ignore[no-untyped-def]
    return client.post(
        "/api/v1/auth/login",
        json={"username": username, "password": password},
    )


def test_fresh_database_status_and_data_routes_require_setup(
    auth_app: tuple[FastAPI, Path],
) -> None:
    app, db_path = auth_app
    with TestClient(app) as client:
        status_response = client.get("/api/v1/auth/status")
        ledger = client.get("/api/v1/ledger/tasks")
        stride = client.get("/api/v1/stride/journeys")
        dashboard = client.get("/api/v1/dashboard")
        ledger_write = client.post(
            "/api/v1/ledger/tasks", json={"name": "Task", "cutoff_message": "Do it"}
        )
        stride_write = client.post(
            "/api/v1/stride/journeys",
            json={"name": "Journey", "tracking_method": "count", "target_value": 10},
        )
        telemetry_write = client.post("/api/v1/frontend-errors", json={})
        health = client.get("/api/v1/health")
        readiness = client.get("/api/v1/ready")

    assert status_response.json() == {
        "initialized": False,
        "authenticated": False,
        "developer_authorized": False,
        "developer_mode": False,
    }
    assert ledger.status_code == stride.status_code == dashboard.status_code == 401
    assert (
        ledger_write.status_code == stride_write.status_code == telemetry_write.status_code == 401
    )
    assert ledger.json() == {"detail": "Setup required."}
    assert health.status_code == readiness.status_code == 200
    connection = sqlite3.connect(db_path)
    try:
        persisted_errors = connection.execute("SELECT COUNT(*) FROM backend_log_events").fetchone()[
            0
        ]
    finally:
        connection.close()
    assert persisted_errors == 0


def test_signup_normalizes_owner_and_stores_argon2_hash(
    auth_app: tuple[FastAPI, Path],
) -> None:
    app, db_path = auth_app
    with TestClient(app) as client:
        _signup(client, username="  OwNeR  ")
        second = client.post(
            "/api/v1/auth/signup",
            json={"name": "Other", "username": "other", "password": PASSWORD},
        )

    connection = sqlite3.connect(db_path)
    try:
        row = connection.execute("SELECT username, password_hash FROM auth_users").fetchone()
    finally:
        connection.close()

    assert row is not None
    assert row[0] == "owner"
    assert row[1].startswith("$argon2id$")
    assert PASSWORD not in row[1]
    assert second.status_code == 409


def test_signup_rejects_password_outside_bounded_policy(
    auth_app: tuple[FastAPI, Path],
) -> None:
    app, _ = auth_app
    with TestClient(app) as client:
        short = client.post(
            "/api/v1/auth/signup",
            json={"name": "Owner", "username": "owner", "password": "too short"},
        )
        long = client.post(
            "/api/v1/auth/signup",
            json={"name": "Owner", "username": "owner", "password": "x" * 129},
        )

    assert short.status_code == long.status_code == 422


def test_database_constraint_enforces_single_owner(auth_app: tuple[FastAPI, Path]) -> None:
    app, _ = auth_app
    with TestClient(app) as client:
        context = app.state.context

        def signup(username: str) -> str:
            try:
                context.authentication_service.signup(
                    name="Owner", username=username, password=PASSWORD
                )
            except Exception as exc:
                return type(exc).__name__
            return "created"

        with ThreadPoolExecutor(max_workers=2) as executor:
            results = list(executor.map(signup, ("owner", "other")))

        count = context.connection.execute("SELECT COUNT(*) FROM auth_users").fetchone()[0]

    assert sorted(results) == ["OwnerAlreadyExists", "created"]
    assert count == 1


def test_login_uses_generic_failure_and_opaque_httponly_cookie(
    auth_app: tuple[FastAPI, Path],
) -> None:
    app, db_path = auth_app
    with TestClient(app) as client:
        _signup(client)
        wrong_password = _login(client, password="totally wrong password")
        unknown_user = _login(client, username="unknown")
        login = _login(client, username=" OwNeR ")
        raw_token = client.cookies.get("momentum_session")

    assert wrong_password.status_code == unknown_user.status_code == 401
    assert (
        wrong_password.json() == unknown_user.json() == {"detail": "Invalid username or password."}
    )
    assert login.status_code == 200
    assert "momentum_session=" in login.headers["set-cookie"]
    assert "HttpOnly" in login.headers["set-cookie"]
    assert "SameSite=lax" in login.headers["set-cookie"]
    assert raw_token is not None
    assert raw_token not in login.text

    connection = sqlite3.connect(db_path)
    try:
        session_row = connection.execute(
            "SELECT session_token_hash, created_at, expires_at FROM auth_sessions"
        ).fetchone()
    finally:
        connection.close()
    stored_hash = session_row[0]
    assert stored_hash == hashlib.sha256(raw_token.encode()).hexdigest()
    assert stored_hash != raw_token
    assert datetime.fromisoformat(session_row[2]) - datetime.fromisoformat(
        session_row[1]
    ) == timedelta(days=14)


def test_concurrent_session_authentication_uses_the_shared_connection_safely(
    auth_app: tuple[FastAPI, Path],
) -> None:
    """Concurrent request workers can read sessions through one application connection."""
    app, _ = auth_app
    with TestClient(app) as client:
        _signup(client)
        assert _login(client).status_code == 200
        raw_token = client.cookies.get("momentum_session")
        assert raw_token is not None

        service = app.state.context.authentication_service

        def authenticate(_: int) -> bool:
            return service.authenticate(raw_token) is not None

        with ThreadPoolExecutor(max_workers=8) as executor:
            authenticated = list(executor.map(authenticate, range(200)))

    assert all(authenticated)


def test_authenticated_access_logout_and_revocation(auth_app: tuple[FastAPI, Path]) -> None:
    app, db_path = auth_app
    with TestClient(app) as client:
        _signup(client)
        assert _login(client).status_code == 200
        assert client.get("/api/v1/ledger/tasks").status_code == 200
        assert client.get("/api/v1/stride/journeys").status_code == 200
        assert client.get("/api/v1/dashboard").status_code == 200
        assert (
            client.post(
                "/api/v1/ledger/tasks",
                json={"name": "Exercise", "cutoff_message": "Exercise today"},
            ).status_code
            == 201
        )
        assert (
            client.post(
                "/api/v1/stride/journeys",
                json={
                    "name": "Read books",
                    "tracking_method": "count",
                    "target_value": 12,
                },
            ).status_code
            == 201
        )
        logout = client.post("/api/v1/auth/logout")
        denied = client.get("/api/v1/ledger/tasks")
        second_logout = client.post("/api/v1/auth/logout")

    assert logout.status_code == second_logout.status_code == 204
    assert denied.status_code == 401
    connection = sqlite3.connect(db_path)
    try:
        revoked_at = connection.execute("SELECT revoked_at FROM auth_sessions").fetchone()[0]
    finally:
        connection.close()
    assert revoked_at is not None


def test_expired_session_is_denied(auth_app: tuple[FastAPI, Path]) -> None:
    app, _ = auth_app
    with TestClient(app) as client:
        _signup(client)
        assert _login(client).status_code == 200
        app.state.context.connection.execute(
            "UPDATE auth_sessions SET expires_at = ?", ("2000-01-01T00:00:00+00:00",)
        )
        response = client.get("/api/v1/ledger/tasks")
    assert response.status_code == 401


def test_developer_mode_is_allowlisted_and_per_session(
    auth_app: tuple[FastAPI, Path], tmp_path: Path
) -> None:
    app, _ = auth_app
    with TestClient(app) as developer_client:
        _signup(developer_client)
        assert _login(developer_client).status_code == 200
        assert developer_client.get("/api/v1/backend-logs").status_code == 403
        enabled = developer_client.post("/api/v1/auth/developer-mode", json={"enabled": True})
        assert enabled.json() == {"developer_authorized": True, "developer_mode": True}
        assert developer_client.get("/api/v1/backend-logs").status_code == 200
        developer_token = developer_client.cookies.get("momentum_session")
        assert developer_token is not None

        assert _login(developer_client).status_code == 200
        assert developer_client.get("/api/v1/backend-logs").status_code == 403

        developer_client.cookies.clear()
        developer_client.cookies.set("momentum_session", developer_token)
        developer_client.post("/api/v1/auth/developer-mode", json={"enabled": False})
        assert developer_client.get("/api/v1/backend-logs").status_code == 403

    normal_db = tmp_path / "normal.db"
    normal_app = create_app(config_factory=lambda: AppConfig(data_dir=tmp_path, db_path=normal_db))
    with TestClient(normal_app) as normal_client:
        _signup(normal_client)
        assert _login(normal_client).status_code == 200
        denied = normal_client.post("/api/v1/auth/developer-mode", json={"enabled": True})
        assert denied.status_code == 403
        assert normal_client.get("/api/v1/frontend-errors").status_code == 403


def test_removing_owner_from_allowlist_disables_persisted_developer_mode(
    tmp_path: Path,
) -> None:
    db_path = tmp_path / "allowlist-change.db"
    allowlisted_app = create_app(
        config_factory=lambda: AppConfig(
            data_dir=tmp_path,
            db_path=db_path,
            developer_usernames=("owner",),
        )
    )
    with TestClient(allowlisted_app) as client:
        _signup(client)
        assert _login(client).status_code == 200
        assert client.post("/api/v1/auth/developer-mode", json={"enabled": True}).status_code == 200
        raw_token = client.cookies.get("momentum_session")
        assert raw_token is not None

    restarted_app = create_app(config_factory=lambda: AppConfig(data_dir=tmp_path, db_path=db_path))
    with TestClient(restarted_app) as client:
        client.cookies.set("momentum_session", raw_token)
        status_response = client.get("/api/v1/auth/status")
        telemetry = client.get("/api/v1/backend-logs")

    assert status_response.json() == {
        "initialized": True,
        "authenticated": True,
        "developer_authorized": False,
        "developer_mode": False,
    }
    assert telemetry.status_code == 403


def test_complete_authentication_smoke_flow(auth_app: tuple[FastAPI, Path]) -> None:
    app, _ = auth_app
    with TestClient(app) as client:
        assert client.get("/api/v1/auth/status").json()["initialized"] is False
        assert client.get("/api/v1/ledger/tasks").status_code == 401

        _signup(client)
        assert _login(client).status_code == 200
        assert client.get("/api/v1/ledger/tasks").status_code == 200
        assert client.get("/api/v1/stride/journeys").status_code == 200
        assert client.get("/api/v1/dashboard").status_code == 200

        assert client.get("/api/v1/backend-logs").status_code == 403
        assert client.post("/api/v1/auth/developer-mode", json={"enabled": True}).status_code == 200
        assert client.get("/api/v1/backend-logs").status_code == 200
        assert (
            client.post("/api/v1/auth/developer-mode", json={"enabled": False}).status_code == 200
        )
        assert client.get("/api/v1/backend-logs").status_code == 403

        assert client.post("/api/v1/auth/logout").status_code == 204
        assert client.get("/api/v1/ledger/tasks").status_code == 401

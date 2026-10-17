"""End-to-end API coverage for Ledger commitment categories."""

from __future__ import annotations

from datetime import date
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from momentum.api.app import create_app
from momentum.config import AppConfig

PASSWORD = "correct horse battery"


@pytest.fixture
def ledger_app(tmp_path: Path) -> FastAPI:
    return create_app(
        config_factory=lambda: AppConfig(
            data_dir=tmp_path,
            db_path=tmp_path / "ledger-categories.db",
            environment="test",
        )
    )


def _authenticate(client: TestClient) -> None:
    signup = client.post(
        "/api/v1/auth/signup",
        json={"name": "Momentum Owner", "username": "owner", "password": PASSWORD},
    )
    assert signup.status_code == 201
    login = client.post(
        "/api/v1/auth/login",
        json={"username": "owner", "password": PASSWORD},
    )
    assert login.status_code == 200


def test_category_flows_through_all_commitment_responses(ledger_app: FastAPI) -> None:
    today = date.today().isoformat()

    with TestClient(ledger_app) as client:
        _authenticate(client)

        created = client.post(
            "/api/v1/ledger/tasks",
            json={
                "name": "Morning walk",
                "cutoff_message": "Walk for twenty minutes",
                "category": "health_fitness",
            },
        )
        task_id = created.json()["id"]

        updated = client.patch(
            "/api/v1/ledger/tasks/Morning%20walk",
            json={"category": "mental_wellbeing"},
        )
        fetched = client.get("/api/v1/ledger/tasks/Morning%20walk")
        listed = client.get("/api/v1/ledger/tasks")
        day_entries = client.get(f"/api/v1/ledger/entries?date={today}")
        recorded = client.post(
            "/api/v1/ledger/entries",
            json={"task_id": task_id, "date": today, "completed": True},
        )
        history = client.get("/api/v1/ledger/history")
        stats = client.get(f"/api/v1/ledger/stats?days=1&reference_date={today}")
        task_stats = client.get(
            f"/api/v1/ledger/stats/tasks/Morning%20walk?days=1&reference_date={today}"
        )
        dashboard = client.get("/api/v1/dashboard?days=1")
        archived = client.post("/api/v1/ledger/tasks/Morning%20walk/archive", json={})
        listed_archived = client.get("/api/v1/ledger/tasks?include_archived=true")
        archived_history = client.get("/api/v1/ledger/history")
        restored = client.post(f"/api/v1/ledger/tasks/{task_id}/restore", json={})

    assert created.status_code == 201
    assert created.json()["category"] == "health_fitness"
    assert updated.status_code == 200
    assert updated.json()["category"] == "mental_wellbeing"
    assert fetched.json()["category"] == "mental_wellbeing"
    assert listed.json()[0]["category"] == "mental_wellbeing"
    assert day_entries.json()[0]["task"]["category"] == "mental_wellbeing"
    assert recorded.status_code == 200
    assert history.json()[0]["task"]["category"] == "mental_wellbeing"
    assert stats.json()["task_stats"][0]["task"]["category"] == "mental_wellbeing"
    assert task_stats.json()["task"]["category"] == "mental_wellbeing"
    assert dashboard.json()["ledger"]["task_stats"][0]["task"]["category"] == ("mental_wellbeing")
    assert archived.json()["category"] == "mental_wellbeing"
    assert listed_archived.json()[0]["category"] == "mental_wellbeing"
    assert archived_history.json()[0]["task"]["category"] == "mental_wellbeing"
    assert restored.json()["category"] == "mental_wellbeing"


def test_category_default_and_invalid_input(ledger_app: FastAPI) -> None:
    with TestClient(ledger_app) as client:
        _authenticate(client)

        defaulted = client.post(
            "/api/v1/ledger/tasks",
            json={"name": "Legacy caller", "cutoff_message": "Keep compatibility"},
        )
        invalid_create = client.post(
            "/api/v1/ledger/tasks",
            json={
                "name": "Invalid",
                "cutoff_message": "Invalid category",
                "category": "not_a_category",
            },
        )
        invalid_update = client.patch(
            "/api/v1/ledger/tasks/Legacy%20caller",
            json={"category": "not_a_category"},
        )

    assert defaulted.status_code == 201
    assert defaulted.json()["category"] == "habits_discipline"
    assert invalid_create.status_code == 422
    assert invalid_update.status_code == 422

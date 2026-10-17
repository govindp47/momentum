"""End-to-end API coverage for atomic Ledger entry batches."""

from __future__ import annotations

from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from momentum.api.app import create_app
from momentum.config import AppConfig

PASSWORD = "correct horse battery"
ENTRY_DATE = "2026-10-13"


@pytest.fixture
def ledger_app(tmp_path: Path) -> FastAPI:
    return create_app(
        config_factory=lambda: AppConfig(
            data_dir=tmp_path,
            db_path=tmp_path / "ledger-batch-entries.db",
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


def _create_task(client: TestClient, name: str) -> int:
    response = client.post(
        "/api/v1/ledger/tasks",
        json={"name": name, "cutoff_message": f"Complete {name}"},
    )
    assert response.status_code == 201
    return int(response.json()["id"])


def test_record_entry_batch_persists_all_decisions(ledger_app: FastAPI) -> None:
    with TestClient(ledger_app) as client:
        _authenticate(client)
        exercise_id = _create_task(client, "Exercise")
        reading_id = _create_task(client, "Read")

        response = client.post(
            "/api/v1/ledger/entries/batch",
            json={
                "date": ENTRY_DATE,
                "entries": [
                    {"task_id": exercise_id, "completed": True},
                    {"task_id": reading_id, "completed": False},
                ],
            },
        )
        day_entries = client.get(f"/api/v1/ledger/entries?date={ENTRY_DATE}")

    assert response.status_code == 200
    assert [(entry["task_id"], entry["date"], entry["completed"]) for entry in response.json()] == [
        (exercise_id, ENTRY_DATE, True),
        (reading_id, ENTRY_DATE, False),
    ]
    assert {pair["task"]["id"]: pair["entry"]["completed"] for pair in day_entries.json()} == {
        exercise_id: True,
        reading_id: False,
    }


def test_invalid_entry_batch_does_not_partially_persist(ledger_app: FastAPI) -> None:
    with TestClient(ledger_app) as client:
        _authenticate(client)
        exercise_id = _create_task(client, "Exercise")

        response = client.post(
            "/api/v1/ledger/entries/batch",
            json={
                "date": ENTRY_DATE,
                "entries": [
                    {"task_id": exercise_id, "completed": True},
                    {"task_id": 999, "completed": False},
                ],
            },
        )
        day_entries = client.get(f"/api/v1/ledger/entries?date={ENTRY_DATE}")

    assert response.status_code == 404
    assert day_entries.json()[0]["entry"] is None


def test_entry_batch_rejects_duplicate_and_empty_items(ledger_app: FastAPI) -> None:
    with TestClient(ledger_app) as client:
        _authenticate(client)
        exercise_id = _create_task(client, "Exercise")

        duplicate = client.post(
            "/api/v1/ledger/entries/batch",
            json={
                "date": ENTRY_DATE,
                "entries": [
                    {"task_id": exercise_id, "completed": True},
                    {"task_id": exercise_id, "completed": False},
                ],
            },
        )
        empty = client.post(
            "/api/v1/ledger/entries/batch",
            json={"date": ENTRY_DATE, "entries": []},
        )

    assert duplicate.status_code == 400
    assert duplicate.json() == {"detail": "Each task can only appear once in a daily entry batch."}
    assert empty.status_code == 422

"""End-to-end API coverage for filtered Ledger Insights."""

from __future__ import annotations

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
            db_path=tmp_path / "ledger-insights.db",
            environment="test",
        )
    )


def _authenticate(client: TestClient) -> None:
    assert (
        client.post(
            "/api/v1/auth/signup",
            json={"name": "Momentum Owner", "username": "owner", "password": PASSWORD},
        ).status_code
        == 201
    )
    assert (
        client.post(
            "/api/v1/auth/login",
            json={"username": "owner", "password": PASSWORD},
        ).status_code
        == 200
    )


def _create_task(client: TestClient, name: str, category: str) -> int:
    response = client.post(
        "/api/v1/ledger/tasks",
        json={"name": name, "cutoff_message": name, "category": category},
    )
    assert response.status_code == 201
    return int(response.json()["id"])


def test_summary_exposes_filtered_recorded_day_semantics(ledger_app: FastAPI) -> None:
    with TestClient(ledger_app) as client:
        _authenticate(client)
        exercise_id = _create_task(client, "Exercise", "health_fitness")
        reading_id = _create_task(client, "Read", "reading_knowledge")
        for task_id, entry_date, completed in [
            (exercise_id, "2024-02-28", True),
            (exercise_id, "2024-02-29", False),
            (reading_id, "2024-02-29", True),
            (reading_id, "2024-03-02", True),
        ]:
            response = client.post(
                "/api/v1/ledger/entries",
                json={"task_id": task_id, "date": entry_date, "completed": completed},
            )
            assert response.status_code == 200

        summary = client.get(
            "/api/v1/ledger/insights/summary",
            params=[
                ("commitment_id", str(exercise_id)),
                ("commitment_id", str(reading_id)),
                ("start_date", "2024-02-28"),
                ("end_date", "2024-03-01"),
            ],
        )

    assert summary.status_code == 200
    body = summary.json()
    assert body["start_date"] == "2024-02-28"
    assert body["end_date"] == "2024-03-01"
    assert body["calendar_days"] == 3
    assert body["days_with_any_entry"] == 2
    assert body["selected_commitment_ids"] == [exercise_id, reading_id]
    assert body["total_completed_days"] == 2
    assert body["commitment_stats"][0] == {
        "task": body["commitment_stats"][0]["task"],
        "completed_days": 1,
        "not_completed_days": 1,
        "recorded_days": 2,
        "completion_percentage": 50.0,
        "distribution_percentage": 50.0,
    }
    assert body["commitment_stats"][0]["task"]["category"] == "health_fitness"
    assert body["commitment_stats"][1]["recorded_days"] == 1
    assert body["commitment_stats"][1]["distribution_percentage"] == 50.0


@pytest.mark.parametrize(("mode", "point_count"), [("monthly", 12), ("cumulative", 24)])
def test_trend_returns_calendar_based_points(
    ledger_app: FastAPI,
    mode: str,
    point_count: int,
) -> None:
    with TestClient(ledger_app) as client:
        _authenticate(client)
        task_id = _create_task(client, "Exercise", "health_fitness")
        trend = client.get(
            "/api/v1/ledger/insights/trend",
            params={
                "commitment_id": task_id,
                "reference_date": "2024-03-20",
                "year": 2024,
                "mode": mode,
            },
        )

    assert trend.status_code == 200
    body = trend.json()
    assert body["reference_date"] == "2024-03-20"
    assert body["year"] == 2024
    assert body["available_years"] == [2024]
    assert body["mode"] == mode
    assert body["period_count"] == point_count
    assert body["selected_commitment_ids"] == [task_id]
    points = body["series"][0]["points"]
    assert len(points) == point_count
    assert points[0]["start_date"] == "2023-04-01"
    assert points[0]["end_date"] == ("2023-04-30" if mode == "monthly" else "2023-04-15")
    assert points[-1]["start_date"] == ("2024-03-01" if mode == "monthly" else "2023-04-01")
    assert points[-1]["end_date"] == "2024-03-31"
    assert all(point["completed_days"] == 0 for point in points)
    assert all(point["recorded_days"] == 0 for point in points)
    assert all(point["completion_percentage"] == 0.0 for point in points)
    assert all(point["distribution_percentage"] == 0.0 for point in points)


def test_trend_exposes_each_commitments_share_of_period_completions(
    ledger_app: FastAPI,
) -> None:
    with TestClient(ledger_app) as client:
        _authenticate(client)
        exercise_id = _create_task(client, "Exercise", "health_fitness")
        reading_id = _create_task(client, "Read", "reading_knowledge")
        for task_id, entry_date in [
            (exercise_id, "2024-03-25"),
            (reading_id, "2024-03-26"),
            (reading_id, "2024-03-27"),
        ]:
            response = client.post(
                "/api/v1/ledger/entries",
                json={"task_id": task_id, "date": entry_date, "completed": True},
            )
            assert response.status_code == 200

        trend = client.get(
            "/api/v1/ledger/insights/trend",
            params=[
                ("commitment_id", str(exercise_id)),
                ("commitment_id", str(reading_id)),
                ("reference_date", "2024-03-31"),
                ("year", "2024"),
                ("mode", "monthly"),
            ],
        )

    assert trend.status_code == 200
    exercise_point = trend.json()["series"][0]["points"][-1]
    reading_point = trend.json()["series"][1]["points"][-1]
    assert exercise_point["completion_percentage"] == 100.0
    assert exercise_point["distribution_percentage"] == pytest.approx(100 / 3)
    assert reading_point["completion_percentage"] == 100.0
    assert reading_point["distribution_percentage"] == pytest.approx(200 / 3)


def test_insights_api_rejects_invalid_dates_ids_and_empty_selection(
    ledger_app: FastAPI,
) -> None:
    with TestClient(ledger_app) as client:
        _authenticate(client)
        task_id = _create_task(client, "Exercise", "health_fitness")
        reversed_dates = client.get(
            "/api/v1/ledger/insights/summary",
            params={
                "commitment_id": task_id,
                "start_date": "2024-03-02",
                "end_date": "2024-03-01",
            },
        )
        unknown = client.get(
            "/api/v1/ledger/insights/summary",
            params={
                "commitment_id": 999,
                "start_date": "2024-03-01",
                "end_date": "2024-03-01",
            },
        )
        empty = client.get(
            "/api/v1/ledger/insights/summary",
            params={"start_date": "2024-03-01", "end_date": "2024-03-01"},
        )
        oversized = client.get(
            "/api/v1/ledger/insights/summary",
            params={
                "commitment_id": task_id,
                "start_date": "2010-01-01",
                "end_date": "2024-03-01",
            },
        )
        invalid_period = client.get(
            "/api/v1/ledger/insights/trend",
            params={
                "commitment_id": task_id,
                "reference_date": "2024-03-01",
                "year": 2024,
                "mode": "weekly",
            },
        )
        future_year = client.get(
            "/api/v1/ledger/insights/trend",
            params={
                "commitment_id": task_id,
                "reference_date": "2024-03-01",
                "year": 2025,
                "mode": "monthly",
            },
        )

    assert reversed_dates.status_code == 400
    assert reversed_dates.json() == {"detail": "Start date cannot be after end date."}
    assert unknown.status_code == 404
    assert "999" in unknown.json()["detail"]
    assert empty.status_code == 422
    assert oversized.status_code == 400
    assert "3660" in oversized.json()["detail"]
    assert invalid_period.status_code == 422
    assert future_year.status_code == 400
    assert future_year.json() == {"detail": "Trend year cannot be after the current year."}


def test_trend_uses_a_previous_calendar_year_and_lists_entry_years(
    ledger_app: FastAPI,
) -> None:
    with TestClient(ledger_app) as client:
        _authenticate(client)
        task_id = _create_task(client, "Exercise", "health_fitness")
        for entry_date in ("2023-01-05", "2023-12-20"):
            response = client.post(
                "/api/v1/ledger/entries",
                json={"task_id": task_id, "date": entry_date, "completed": True},
            )
            assert response.status_code == 200

        trend = client.get(
            "/api/v1/ledger/insights/trend",
            params={
                "commitment_id": task_id,
                "reference_date": "2024-03-20",
                "year": 2023,
                "mode": "monthly",
            },
        )

    assert trend.status_code == 200
    body = trend.json()
    assert body["year"] == 2023
    assert body["available_years"] == [2024, 2023]
    assert body["series"][0]["points"][0]["start_date"] == "2023-01-01"
    assert body["series"][0]["points"][0]["end_date"] == "2023-01-31"
    assert body["series"][0]["points"][-1]["start_date"] == "2023-12-01"
    assert body["series"][0]["points"][-1]["end_date"] == "2023-12-31"

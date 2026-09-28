"""Pydantic schemas for the combined Momentum dashboard API."""

from __future__ import annotations

from datetime import date

from pydantic import BaseModel

from momentum.ledger.api.schemas import TaskStatsResponse
from momentum.stride.api.schemas import (
    DailyActivityResponse,
    JourneyResponse,
    ProgressSummaryResponse,
    StreakResponse,
)


class DashboardLedgerResponse(BaseModel):
    """LifeLedger information displayed on the dashboard."""

    start_date: date
    end_date: date
    task_stats: list[TaskStatsResponse]
    avg_rate: float | None
    min_rate: float | None
    max_rate: float | None
    spread: float | None
    tracked_days: int
    total_days: int


class DashboardJourneyResponse(BaseModel):
    """Active Stride journey information."""

    journey: JourneyResponse
    progress: ProgressSummaryResponse
    streak: StreakResponse


class DashboardResponse(BaseModel):
    """Complete cross-domain Momentum dashboard."""

    as_of: date
    ledger: DashboardLedgerResponse
    journeys: list[DashboardJourneyResponse]
    today_activity: dict[int, DailyActivityResponse]

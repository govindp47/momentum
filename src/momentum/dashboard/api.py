"""Combined Momentum dashboard HTTP API."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from momentum.api.dependencies import get_dashboard_service
from momentum.dashboard.schemas import (
    DashboardJourneyResponse,
    DashboardLedgerResponse,
    DashboardResponse,
)
from momentum.dashboard.service import DashboardService
from momentum.ledger.api.schemas import (
    task_stats_response,
)
from momentum.stride.api.schemas import (
    activity_response,
    journey_response,
    progress_summary_response,
    streak_response,
)

router = APIRouter(
    prefix="/dashboard",
    tags=["Dashboard"],
)


@router.get(
    "",
    response_model=DashboardResponse,
    summary="Get the combined Momentum dashboard",
)
def get_dashboard(
    days: int = Query(
        default=30,
        ge=1,
        le=365,
        description="Number of calendar days to analyze for LifeLedger statistics.",
    ),
    service: DashboardService = Depends(get_dashboard_service),
) -> DashboardResponse:
    """Return the complete cross-domain dashboard."""
    data = service.get_dashboard(days=days)

    ledger = data.ledger_stats

    return DashboardResponse(
        as_of=data.as_of,
        ledger=DashboardLedgerResponse(
            start_date=ledger.start_date,
            end_date=ledger.end_date,
            task_stats=[task_stats_response(task_stats) for task_stats in ledger.task_stats],
            avg_rate=ledger.avg_rate,
            min_rate=ledger.min_rate,
            max_rate=ledger.max_rate,
            spread=ledger.spread,
            tracked_days=ledger.tracked_days,
            total_days=ledger.total_days,
        ),
        journeys=[
            DashboardJourneyResponse(
                journey=journey_response(journey),
                progress=progress_summary_response(
                    data.journey_progress[journey.id],
                ),
                streak=streak_response(
                    data.journey_streaks[journey.id],
                ),
            )
            for journey in data.active_journeys
        ],
        today_activity={
            journey_id: activity_response(activity)
            for journey_id, activity in data.today_activity.items()
        },
    )

"""Combined dashboard service."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date

from momentum.ledger.domain.models import OverallStats
from momentum.ledger.services.stats_service import StatsService as LedgerStatsService
from momentum.stride.domain.enums import JourneyStatus
from momentum.stride.domain.models import DailyActivity, Journey, ProgressSummary, StreakInfo
from momentum.stride.services.journey_service import JourneyService
from momentum.stride.services.stats_service import StatsService as StrideStatsService


@dataclass(frozen=True, slots=True)
class DashboardData:
    """Aggregated data required by the Momentum dashboard."""

    ledger_stats: OverallStats
    active_journeys: list[Journey]
    journey_progress: dict[int, ProgressSummary]
    journey_streaks: dict[int, StreakInfo]
    today_activity: dict[int, DailyActivity]
    as_of: date


class DashboardService:
    """Aggregate data from the Ledger and Stride domains.

    The dashboard service does not own domain logic. It coordinates existing
    domain services and combines their results for the shared dashboard.
    """

    def __init__(
        self,
        ledger_stats_service: LedgerStatsService,
        stride_journey_service: JourneyService,
        stride_stats_service: StrideStatsService,
    ) -> None:
        self._ledger_stats_service = ledger_stats_service
        self._stride_journey_service = stride_journey_service
        self._stride_stats_service = stride_stats_service

    def get_dashboard(
        self,
        *,
        days: int = 30,
        today: date | None = None,
    ) -> DashboardData:
        """Build the combined dashboard data."""
        ledger_stats = self._ledger_stats_service.compute_overall_stats(days)

        active_journeys = self._stride_journey_service.list_journeys(
            status=JourneyStatus.ACTIVE,
        )

        journey_progress = {
            journey.id: self._stride_stats_service.get_progress(journey)
            for journey in active_journeys
        }

        journey_streaks = {
            journey.id: self._stride_stats_service.get_streak(journey)
            for journey in active_journeys
        }

        today_activity = self._stride_stats_service.get_today_activity(
            active_journeys,
        )

        return DashboardData(
            ledger_stats=ledger_stats,
            active_journeys=active_journeys,
            journey_progress=journey_progress,
            journey_streaks=journey_streaks,
            today_activity=today_activity,
            as_of=today or date.today(),
        )

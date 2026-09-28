"""FastAPI dependency providers."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Request

from momentum.app.context import AppContext
from momentum.dashboard.service import DashboardService
from momentum.ledger.services.stats_service import StatsService as LedgerStatsService
from momentum.ledger.services.task_service import TaskService as LedgerTaskService
from momentum.ledger.services.tracking_service import (
    TrackingService as LedgerTrackingService,
)
from momentum.stride.services.achievement_service import AchievementService
from momentum.stride.services.export_service import ExportService
from momentum.stride.services.journey_service import JourneyService
from momentum.stride.services.milestone_service import MilestoneService
from momentum.stride.services.progress_service import ProgressService
from momentum.stride.services.stats_service import StatsService as StrideStatsService


def get_app_context(request: Request) -> AppContext:
    """Return the application context associated with the current request."""
    context = getattr(request.app.state, "context", None)

    if not isinstance(context, AppContext):
        raise RuntimeError("Application context is not initialized.")

    return context


def get_ledger_task_service(
    context: Annotated[AppContext, Depends(get_app_context)],
) -> LedgerTaskService:
    """Return the LifeLedger task service."""
    return context.ledger_task_service


def get_ledger_tracking_service(
    context: Annotated[AppContext, Depends(get_app_context)],
) -> LedgerTrackingService:
    """Return the LifeLedger tracking service."""
    return context.ledger_tracking_service


def get_ledger_stats_service(
    context: Annotated[AppContext, Depends(get_app_context)],
) -> LedgerStatsService:
    """Return the LifeLedger statistics service."""
    return context.ledger_stats_service


def get_stride_journey_service(
    context: Annotated[AppContext, Depends(get_app_context)],
) -> JourneyService:
    """Return the Stride journey service."""
    return context.stride_journey_service


def get_stride_milestone_service(
    context: Annotated[AppContext, Depends(get_app_context)],
) -> MilestoneService:
    """Return the Stride milestone service."""
    return context.stride_milestone_service


def get_stride_progress_service(
    context: Annotated[AppContext, Depends(get_app_context)],
) -> ProgressService:
    """Return the Stride progress service."""
    return context.stride_progress_service


def get_stride_stats_service(
    context: Annotated[AppContext, Depends(get_app_context)],
) -> StrideStatsService:
    """Return the Stride statistics service."""
    return context.stride_stats_service


def get_stride_achievement_service(
    context: Annotated[AppContext, Depends(get_app_context)],
) -> AchievementService:
    """Return the Stride achievement service."""
    return context.stride_achievement_service


def get_stride_export_service(
    context: Annotated[AppContext, Depends(get_app_context)],
) -> ExportService:
    """Return the Stride export service."""
    return context.stride_export_service


def get_dashboard_service(
    context: Annotated[AppContext, Depends(get_app_context)],
) -> DashboardService:
    """Return the combined dashboard service."""
    return context.dashboard_service

"""FastAPI dependency providers."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, HTTPException, Request, status

from momentum.app.context import AppContext
from momentum.auth.constants import AUTH_COOKIE_NAME
from momentum.auth.domain.models import CurrentSession
from momentum.auth.services.authentication_service import AuthenticationService
from momentum.dashboard.service import DashboardService
from momentum.frontend_telemetry.service import FrontendTelemetryService
from momentum.ledger.services.stats_service import StatsService as LedgerStatsService
from momentum.ledger.services.task_service import TaskService as LedgerTaskService
from momentum.ledger.services.tracking_service import (
    TrackingService as LedgerTrackingService,
)
from momentum.observability.service import BackendTelemetryService
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


def get_authentication_service(
    context: Annotated[AppContext, Depends(get_app_context)],
) -> AuthenticationService:
    """Return the single-owner authentication service."""
    return context.authentication_service


def get_current_session(
    request: Request,
    service: Annotated[AuthenticationService, Depends(get_authentication_service)],
) -> CurrentSession:
    """Require and return a valid owner session."""
    current = service.authenticate(request.cookies.get(AUTH_COOKIE_NAME))
    if current is None:
        detail = "Authentication required." if service.is_initialized() else "Setup required."
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=detail)
    return current


def require_developer_mode(
    current: Annotated[CurrentSession, Depends(get_current_session)],
    service: Annotated[AuthenticationService, Depends(get_authentication_service)],
) -> CurrentSession:
    """Require configured developer authorization and active per-session mode."""
    if not service.is_developer_authorized(current.user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Developer authorization is required.",
        )
    if not service.developer_mode_active(current):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Developer mode is not enabled for this session.",
        )
    return current


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


def get_frontend_telemetry_service(
    context: Annotated[AppContext, Depends(get_app_context)],
) -> FrontendTelemetryService:
    """Return the frontend telemetry service."""
    return context.frontend_telemetry_service


def get_backend_telemetry_service(
    context: Annotated[AppContext, Depends(get_app_context)],
) -> BackendTelemetryService:
    """Return the backend telemetry inspection service."""
    return context.backend_telemetry_service

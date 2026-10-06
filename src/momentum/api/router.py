"""Root API router."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from momentum.api.dependencies import get_current_session
from momentum.api.health import router as health_router
from momentum.auth.api.router import router as auth_router
from momentum.dashboard.api import router as dashboard_router
from momentum.frontend_telemetry.router import router as frontend_telemetry_router
from momentum.ledger.api.router import router as ledger_router
from momentum.observability.router import router as backend_telemetry_router
from momentum.stride.api.router import router as stride_router

API_PREFIX = "/api/v1"

router = APIRouter(prefix=API_PREFIX)
protected_router = APIRouter(dependencies=[Depends(get_current_session)])

router.include_router(health_router)
router.include_router(auth_router)
protected_router.include_router(dashboard_router)
protected_router.include_router(ledger_router)
protected_router.include_router(stride_router)
router.include_router(protected_router)
router.include_router(frontend_telemetry_router)
router.include_router(backend_telemetry_router)

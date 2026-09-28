"""Root API router."""

from __future__ import annotations

from fastapi import APIRouter

from momentum.api.health import router as health_router
from momentum.dashboard.api import router as dashboard_router
from momentum.ledger.api.router import router as ledger_router
from momentum.stride.api.router import router as stride_router

API_PREFIX = "/api/v1"

router = APIRouter(prefix=API_PREFIX)

router.include_router(health_router)
router.include_router(dashboard_router)
router.include_router(ledger_router)
router.include_router(stride_router)

"""Application health and readiness endpoints."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Request, status
from fastapi.responses import JSONResponse

from momentum.app.context import AppContext

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Health"])


@router.get(
    "/health",
    summary="Check application health",
    response_model=dict[str, str],
)
def health() -> dict[str, str]:
    """Return a successful response when the application process is alive."""
    return {"status": "ok"}


@router.get(
    "/ready",
    summary="Check application readiness",
    response_model=dict[str, str],
)
def readiness(request: Request) -> JSONResponse | dict[str, str]:
    """Check whether the application is initialized and its database is usable."""
    context: AppContext | None = getattr(
        request.app.state,
        "context",
        None,
    )

    if context is None:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"status": "not_ready"},
        )

    try:
        context.connection.execute("SELECT 1")
    except Exception:
        logger.exception(
            "Readiness database check failed",
            extra={
                "component": "api",
                "operation": "readiness_check",
                "status_code": status.HTTP_503_SERVICE_UNAVAILABLE,
            },
        )
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"status": "not_ready"},
        )

    return {"status": "ready"}

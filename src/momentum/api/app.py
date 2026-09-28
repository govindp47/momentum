"""FastAPI application factory."""

from __future__ import annotations

from collections.abc import Callable

import uvicorn
from fastapi import FastAPI

from momentum import __version__
from momentum.api.router import router as api_router
from momentum.app.lifespan import create_lifespan
from momentum.config import AppConfig, get_config

API_TITLE = "Momentum API"
API_DESCRIPTION = "Local-first personal tracking API."
API_VERSION = __version__


def create_app(
    config_factory: Callable[[], AppConfig] = get_config,
) -> FastAPI:
    """Create and configure the Momentum FastAPI application."""
    app = FastAPI(
        title=API_TITLE,
        description=API_DESCRIPTION,
        version=API_VERSION,
        lifespan=create_lifespan(config_factory),
    )

    app.include_router(api_router)

    return app


def main() -> None:
    """Run the Momentum API server."""
    uvicorn.run(
        "momentum.api.app:create_app",
        factory=True,
        host="127.0.0.1",
        port=8000,
        reload=False,
    )


app = create_app()

"""FastAPI application lifespan management."""

from __future__ import annotations

from collections.abc import AsyncGenerator, Callable
from contextlib import AbstractAsyncContextManager, asynccontextmanager

from fastapi import FastAPI

from momentum.app.context import AppContext
from momentum.config import AppConfig, get_config
from momentum.observability.logging import configure_logging


def create_lifespan(
    config_factory: Callable[[], AppConfig] = get_config,
) -> Callable[[FastAPI], AbstractAsyncContextManager[None]]:
    """Create the FastAPI application lifespan handler.

    Configuration is resolved when the application starts rather than when
    the application module is imported. This keeps resource initialization
    inside the application lifecycle and allows callers to provide explicit
    configuration when constructing the application.
    """

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
        """Initialize and clean up application-wide resources."""
        config = config_factory()
        context = AppContext(config)
        logging_runtime = configure_logging(
            config,
            context.backend_telemetry_repository,
        )

        app.state.context = context

        try:
            yield
        finally:
            logging_runtime.close()
            context.close()
            app.state.context = None

    return lifespan

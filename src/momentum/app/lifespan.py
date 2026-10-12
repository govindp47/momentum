"""FastAPI application lifespan management."""

from __future__ import annotations

import logging
import sys
from collections.abc import AsyncGenerator, Callable
from contextlib import AbstractAsyncContextManager, asynccontextmanager

from fastapi import FastAPI

from momentum.app.context import AppContext
from momentum.config import AppConfig, get_config
from momentum.observability.logging import configure_logging

logger = logging.getLogger(__name__)


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
        logger.info(
            "Momentum backend started",
            extra={"component": "application", "operation": "startup"},
        )

        try:
            yield
        finally:
            primary_error = sys.exception()
            cleanup_errors: list[BaseException] = []

            logger.info(
                "Momentum backend shutting down",
                extra={"component": "application", "operation": "shutdown"},
            )

            for operation, close_resource in (
                ("Logging shutdown", logging_runtime.close),
                ("Application context shutdown", context.close),
            ):
                try:
                    close_resource()
                except BaseException as cleanup_error:
                    if primary_error is not None:
                        primary_error.add_note(
                            f"{operation} also failed with {type(cleanup_error).__name__}."
                        )
                    else:
                        cleanup_errors.append(cleanup_error)

            app.state.context = None

            if cleanup_errors:
                first_error = cleanup_errors[0]
                for additional_error in cleanup_errors[1:]:
                    first_error.add_note(
                        f"Additional cleanup failed with {type(additional_error).__name__}."
                    )
                raise first_error

    return lifespan

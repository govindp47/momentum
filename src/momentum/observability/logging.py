"""Application-owned setup for runtime and persistent logging handlers."""

from __future__ import annotations

import logging

from momentum.config import AppConfig
from momentum.observability.context import get_request_context
from momentum.observability.handler import PersistentTelemetryHandler
from momentum.observability.repository import BackendTelemetryRepository


class RequestContextFilter(logging.Filter):
    """Add a bounded request identifier to runtime log output."""

    def filter(self, record: logging.LogRecord) -> bool:
        context = get_request_context()
        record.runtime_request_id = context.request_id if context is not None else "-"
        return True


class LoggingRuntime:
    """Own the logging handlers attached for an application lifetime."""

    def __init__(
        self,
        *,
        logger: logging.Logger,
        runtime_handler: logging.Handler,
        persistent_handler: logging.Handler,
        previous_level: int,
        previous_propagate: bool,
    ) -> None:
        self._logger = logger
        self._runtime_handler = runtime_handler
        self._persistent_handler = persistent_handler
        self._previous_level = previous_level
        self._previous_propagate = previous_propagate
        self._closed = False

    def close(self) -> None:
        """Detach handlers before closing their persistence connection."""
        if self._closed:
            return
        self._closed = True

        self._logger.removeHandler(self._runtime_handler)
        self._runtime_handler.close()

        self._logger.removeHandler(self._persistent_handler)
        self._persistent_handler.close()

        self._logger.setLevel(self._previous_level)
        self._logger.propagate = self._previous_propagate


def configure_logging(
    config: AppConfig,
    repository: BackendTelemetryRepository,
) -> LoggingRuntime:
    """Configure runtime output and persistence using a context-owned repository."""
    logger = logging.getLogger("momentum")
    previous_level = logger.level
    previous_propagate = logger.propagate

    runtime_handler = logging.StreamHandler()
    runtime_handler.setLevel(config.log_level)
    runtime_handler.addFilter(RequestContextFilter())
    runtime_handler.setFormatter(
        logging.Formatter(
            fmt=(
                "%(asctime)s %(levelname)s %(name)s [request_id=%(runtime_request_id)s] %(message)s"
            ),
            datefmt="%Y-%m-%dT%H:%M:%S%z",
        )
    )
    logger.addHandler(runtime_handler)

    persistent_handler = PersistentTelemetryHandler(
        repository,
        environment=config.environment,
        level=config.persistent_log_level,
    )
    logger.addHandler(persistent_handler)

    logger.setLevel(min(config.log_level, config.persistent_log_level))
    logger.propagate = False

    return LoggingRuntime(
        logger=logger,
        runtime_handler=runtime_handler,
        persistent_handler=persistent_handler,
        previous_level=previous_level,
        previous_propagate=previous_propagate,
    )

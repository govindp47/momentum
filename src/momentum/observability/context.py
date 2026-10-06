"""Request-scoped context made available to backend log records."""

from __future__ import annotations

from contextvars import ContextVar, Token
from dataclasses import dataclass


@dataclass(slots=True)
class RequestLogContext:
    """Safe HTTP context associated with the current request."""

    request_id: str
    method: str
    path: str
    route: str | None = None
    status_code: int | None = None


_request_context: ContextVar[RequestLogContext | None] = ContextVar(
    "momentum_request_log_context",
    default=None,
)


def bind_request_context(context: RequestLogContext) -> Token[RequestLogContext | None]:
    """Bind context for the current async/thread execution context."""
    return _request_context.set(context)


def reset_request_context(token: Token[RequestLogContext | None]) -> None:
    """Restore the request context that preceded ``token``."""
    _request_context.reset(token)


def get_request_context() -> RequestLogContext | None:
    """Return the active request context, if logging runs during a request."""
    return _request_context.get()

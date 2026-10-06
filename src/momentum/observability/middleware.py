"""FastAPI request correlation and unexpected-exception boundary."""

from __future__ import annotations

import logging
import re
from uuid import uuid4

from starlette.datastructures import Headers, MutableHeaders
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from momentum.observability.context import (
    RequestLogContext,
    bind_request_context,
    reset_request_context,
)

REQUEST_ID_HEADER = "X-Request-ID"
MAX_REQUEST_ID_LENGTH = 128

_REQUEST_ID_PATTERN = re.compile(r"[A-Za-z0-9][A-Za-z0-9._:-]*")

logger = logging.getLogger(__name__)


class RequestContextMiddleware:
    """Correlate requests and persist only exceptions escaping FastAPI."""

    def __init__(self, app: ASGIApp) -> None:
        self._app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self._app(scope, receive, send)
            return

        request_id = _request_id(Headers(scope=scope).get(REQUEST_ID_HEADER))
        context = RequestLogContext(
            request_id=request_id,
            method=scope["method"],
            path=scope["path"],
        )
        token = bind_request_context(context)
        response_started = False

        async def send_with_request_id(message: Message) -> None:
            nonlocal response_started
            if message["type"] == "http.response.start":
                response_started = True
                context.status_code = message["status"]
                context.route = context.route or _matched_route(scope)
                MutableHeaders(scope=message)[REQUEST_ID_HEADER] = request_id
            await send(message)

        try:
            await self._app(scope, receive, send_with_request_id)
        except Exception:
            context.route = _matched_route(scope)
            context.status_code = 500
            logger.exception(
                "Unhandled exception during HTTP request",
                extra={
                    "component": "api",
                    "operation": "http_request",
                    "status_code": 500,
                },
            )

            if response_started:
                raise

            response = JSONResponse(
                status_code=500,
                content={"detail": "Internal Server Error"},
            )
            await response(scope, receive, send_with_request_id)
        finally:
            reset_request_context(token)


def _request_id(candidate: str | None) -> str:
    if (
        candidate is not None
        and len(candidate) <= MAX_REQUEST_ID_LENGTH
        and _REQUEST_ID_PATTERN.fullmatch(candidate)
    ):
        return candidate
    return uuid4().hex


def _matched_route(scope: Scope) -> str | None:
    route = scope.get("route")
    path = getattr(route, "path", None)
    return path if isinstance(path, str) else None

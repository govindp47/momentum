"""Normalization and fail-safe persistence for Python log records."""

from __future__ import annotations

import hashlib
import json
import logging
import math
import platform
import re
import sys
import threading
from collections.abc import Mapping, Sequence
from contextlib import suppress
from datetime import UTC, datetime

from momentum import __version__
from momentum.observability.context import get_request_context
from momentum.observability.models import BackendLogEvent
from momentum.observability.repository import BackendTelemetryRepository

MAX_MESSAGE_LENGTH = 4_096
MAX_TRACEBACK_LENGTH = 131_072
MAX_METADATA_JSON_LENGTH = 16_384
MAX_METADATA_STRING_LENGTH = 1_024
MAX_METADATA_ITEMS = 25
MAX_METADATA_DEPTH = 4
MAX_FIELD_LENGTH = 2_048

_SENSITIVE_KEY = re.compile(
    r"(?:authorization|cookie|password|passwd|secret|token|api[_-]?key|session)",
    re.IGNORECASE,
)
_SENSITIVE_VALUE = re.compile(
    r"(?i)\b(authorization|cookie|password|passwd|secret|token|api[_-]?key|session)"
    r"(\s*[:=]\s*)(?:\"[^\"]*\"|'[^']*'|[^\s,;]+)"
)
_BEARER_VALUE = re.compile(r"(?i)\bbearer\s+[a-z0-9._~+/=-]+")
_UUID_VALUE = re.compile(
    r"\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b",
    re.IGNORECASE,
)
_HEX_VALUE = re.compile(r"\b[0-9a-f]{16,}\b", re.IGNORECASE)
_NUMBER_VALUE = re.compile(r"\b\d+\b")
_WHITESPACE = re.compile(r"\s+")

_STANDARD_RECORD_FIELDS = frozenset(
    logging.LogRecord(
        name="",
        level=0,
        pathname="",
        lineno=0,
        msg="",
        args=(),
        exc_info=None,
    ).__dict__
) | {"message", "asctime"}
_STRUCTURED_FIELDS = frozenset(
    {
        "component",
        "method",
        "operation",
        "path",
        "request_id",
        "route",
        "runtime_request_id",
        "status_code",
    }
)


class PersistentTelemetryHandler(logging.Handler):
    """Persist WARNING+ records without allowing diagnostics to break the app."""

    def __init__(
        self,
        repository: BackendTelemetryRepository,
        *,
        environment: str,
        level: int = logging.WARNING,
    ) -> None:
        super().__init__(max(level, logging.WARNING))
        self._repository = repository
        self._environment = _bounded_text(environment, 128)
        self._local = threading.local()

    def emit(self, record: logging.LogRecord) -> None:
        """Normalize and persist a record; swallow all telemetry failures."""
        if record.levelno < logging.WARNING or getattr(self._local, "active", False):
            return

        self._local.active = True
        try:
            self._repository.insert(self._event_from_record(record))
        except Exception as exc:
            self._write_fallback(exc)
        finally:
            self._local.active = False

    def _event_from_record(self, record: logging.LogRecord) -> BackendLogEvent:
        context = get_request_context()
        message = _bounded_text(_redact_text(record.getMessage()), MAX_MESSAGE_LENGTH)
        traceback_text = _format_traceback(record)
        exception_type = _exception_type(record)

        request_id = _record_text(record, "request_id")
        method = _record_text(record, "method")
        path = _record_text(record, "path")
        route = _record_text(record, "route")
        status_code = _record_int(record, "status_code")

        if context is not None:
            request_id = request_id or context.request_id
            method = method or context.method
            path = path or context.path
            route = route or context.route
            status_code = status_code or context.status_code

        operation = _record_text(record, "operation", maximum=255)
        component = _record_text(record, "component", maximum=255)
        module = _bounded_text(record.module, 255)
        function = _bounded_text(record.funcName, 255)
        logger_name = _bounded_text(record.name, 255)
        timestamp = _serialize_datetime(datetime.fromtimestamp(record.created, tz=UTC))
        created_at = _serialize_datetime(datetime.now(UTC))
        metadata_json = _metadata_json(record)

        return BackendLogEvent(
            timestamp=timestamp,
            level=record.levelname,
            logger_name=logger_name,
            source=f"{module}:{record.lineno}",
            fingerprint=_fingerprint(
                level=record.levelname,
                logger_name=logger_name,
                exception_type=exception_type,
                message=message,
                module=module,
                function=function,
                route=route,
            ),
            request_id=_bounded_optional(request_id, 128),
            method=_bounded_optional(method, 16),
            path=_bounded_optional(path, MAX_FIELD_LENGTH),
            route=_bounded_optional(route, MAX_FIELD_LENGTH),
            status_code=status_code,
            operation=operation,
            component=component,
            module=module,
            function=function,
            exception_type=exception_type,
            message=message,
            traceback=traceback_text,
            application_version=__version__,
            environment=self._environment,
            process_id=record.process or 0,
            thread_id=record.thread or 0,
            python_version=platform.python_version(),
            metadata_json=metadata_json,
            created_at=created_at,
        )

    @staticmethod
    def _write_fallback(exc: Exception) -> None:
        """Report handler failure without re-entering Python logging."""
        with suppress(Exception):
            sys.stderr.write(
                "Momentum telemetry persistence failed "
                f"({type(exc).__name__}); application execution continues.\n"
            )


def _record_text(
    record: logging.LogRecord,
    name: str,
    *,
    maximum: int = MAX_FIELD_LENGTH,
) -> str | None:
    value = record.__dict__.get(name)
    if not isinstance(value, str) or not value:
        return None
    return _bounded_text(_redact_text(value), maximum)


def _record_int(record: logging.LogRecord, name: str) -> int | None:
    value = record.__dict__.get(name)
    if isinstance(value, bool) or not isinstance(value, int):
        return None
    return value


def _exception_type(record: logging.LogRecord) -> str | None:
    if record.exc_info is None or record.exc_info[0] is None:
        return None

    exception_class = record.exc_info[0]
    if exception_class.__module__ == "builtins":
        return exception_class.__qualname__
    return f"{exception_class.__module__}.{exception_class.__qualname__}"


def _format_traceback(record: logging.LogRecord) -> str | None:
    if record.exc_info is None:
        return None

    formatted = logging.Formatter().formatException(record.exc_info)
    return _bounded_text(_redact_text(formatted), MAX_TRACEBACK_LENGTH)


def _fingerprint(
    *,
    level: str,
    logger_name: str,
    exception_type: str | None,
    message: str,
    module: str,
    function: str,
    route: str | None,
) -> str:
    normalized_message = _normalize_dynamic_values(message)
    payload = "\x1f".join(
        (
            level,
            logger_name,
            exception_type or "",
            normalized_message,
            module,
            function,
            route or "",
        )
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _normalize_dynamic_values(value: str) -> str:
    value = _UUID_VALUE.sub("<uuid>", value.lower())
    value = _HEX_VALUE.sub("<hex>", value)
    value = _NUMBER_VALUE.sub("<number>", value)
    return _WHITESPACE.sub(" ", value).strip()


def _metadata_json(record: logging.LogRecord) -> str | None:
    metadata: dict[str, object] = {}
    seen: set[int] = set()

    for key, value in record.__dict__.items():
        if key in _STANDARD_RECORD_FIELDS or key in _STRUCTURED_FIELDS:
            continue
        if len(metadata) >= MAX_METADATA_ITEMS:
            metadata["_truncated"] = True
            break
        metadata[key] = _sanitize_value(key, value, depth=0, seen=seen)

    if not metadata:
        return None

    serialized = json.dumps(metadata, ensure_ascii=True, sort_keys=True, separators=(",", ":"))
    if len(serialized) <= MAX_METADATA_JSON_LENGTH:
        return serialized

    return json.dumps(
        {"_truncated": True, "keys": sorted(metadata)[:MAX_METADATA_ITEMS]},
        separators=(",", ":"),
    )


def _sanitize_value(
    key: str,
    value: object,
    *,
    depth: int,
    seen: set[int],
) -> object:
    if _SENSITIVE_KEY.search(key):
        return "[REDACTED]"
    if value is None or isinstance(value, bool | int):
        return value
    if isinstance(value, float):
        return value if math.isfinite(value) else str(value)
    if isinstance(value, str):
        return _bounded_text(_redact_text(value), MAX_METADATA_STRING_LENGTH)
    if depth >= MAX_METADATA_DEPTH:
        return f"<{type(value).__name__}>"

    if isinstance(value, Mapping):
        identity = id(value)
        if identity in seen:
            return "[CIRCULAR]"
        seen.add(identity)
        result: dict[str, object] = {}
        for index, (nested_key, nested_value) in enumerate(value.items()):
            if index >= MAX_METADATA_ITEMS:
                result["_truncated"] = True
                break
            safe_key = _bounded_text(str(nested_key), 128)
            result[safe_key] = _sanitize_value(
                safe_key,
                nested_value,
                depth=depth + 1,
                seen=seen,
            )
        seen.remove(identity)
        return result

    if isinstance(value, Sequence) and not isinstance(value, bytes | bytearray):
        identity = id(value)
        if identity in seen:
            return "[CIRCULAR]"
        seen.add(identity)
        sequence_result = [
            _sanitize_value("item", item, depth=depth + 1, seen=seen)
            for item in value[:MAX_METADATA_ITEMS]
        ]
        if len(value) > MAX_METADATA_ITEMS:
            sequence_result.append("[TRUNCATED]")
        seen.remove(identity)
        return sequence_result

    return f"<{type(value).__name__}>"


def _redact_text(value: str) -> str:
    value = _SENSITIVE_VALUE.sub(r"\1\2[REDACTED]", value)
    return _BEARER_VALUE.sub("Bearer [REDACTED]", value)


def _bounded_optional(value: str | None, maximum: int) -> str | None:
    return _bounded_text(value, maximum) if value is not None else None


def _bounded_text(value: str, maximum: int) -> str:
    if len(value) <= maximum:
        return value
    marker = "\n...[truncated]...\n"
    if maximum <= len(marker):
        return value[:maximum]
    available = maximum - len(marker)
    beginning = int(available * 0.65)
    return value[:beginning] + marker + value[-(available - beginning) :]


def _serialize_datetime(value: datetime) -> str:
    return value.isoformat(timespec="microseconds")

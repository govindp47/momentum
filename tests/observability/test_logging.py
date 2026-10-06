"""Tests for backend log normalization, persistence, and safety."""

from __future__ import annotations

import json
import logging
from pathlib import Path

from momentum.config import AppConfig
from momentum.observability.context import (
    RequestLogContext,
    bind_request_context,
    reset_request_context,
)
from momentum.observability.handler import PersistentTelemetryHandler
from momentum.observability.logging import configure_logging
from momentum.observability.models import BackendLogEvent
from momentum.observability.repository import (
    MAX_RETAINED_EVENTS,
    BackendTelemetryRepository,
)
from momentum.storage.database import Database


def _logger_with_handler(
    handler: logging.Handler,
    name: str = "momentum.tests.telemetry",
) -> logging.Logger:
    logger = logging.getLogger(name)
    logger.handlers = [handler]
    logger.setLevel(logging.DEBUG)
    logger.propagate = False
    return logger


def _event(index: int) -> BackendLogEvent:
    return BackendLogEvent(
        timestamp=f"2026-10-06T00:00:{index % 60:02d}+00:00",
        level="WARNING",
        logger_name="momentum.tests",
        source="test_logging:1",
        fingerprint=f"fingerprint-{index}",
        request_id=None,
        method=None,
        path=None,
        route=None,
        status_code=None,
        operation=None,
        component=None,
        module="test_logging",
        function="_event",
        exception_type=None,
        message=f"event {index}",
        traceback=None,
        application_version="0.1.0",
        environment="test",
        process_id=1,
        thread_id=1,
        python_version="3.12.0",
        metadata_json=None,
        created_at=f"2026-10-06T00:00:{index % 60:02d}+00:00",
    )


def test_persistent_handler_stores_warning_and_above_only(db: Database) -> None:
    repository = BackendTelemetryRepository(db.conn)
    handler = PersistentTelemetryHandler(repository, environment="test")
    logger = _logger_with_handler(handler)

    logger.debug("debug message")
    logger.info("info message")
    logger.warning("warning message")
    logger.error("error message")
    logger.critical("critical message")

    rows = db.conn.execute("SELECT level, message FROM backend_log_events ORDER BY id").fetchall()
    assert [(row["level"], row["message"]) for row in rows] == [
        ("WARNING", "warning message"),
        ("ERROR", "error message"),
        ("CRITICAL", "critical message"),
    ]


def test_runtime_log_level_is_configurable(tmp_path: Path, capsys) -> None:  # type: ignore[no-untyped-def]
    config = AppConfig(
        data_dir=tmp_path,
        db_path=tmp_path / "runtime.db",
        log_level=logging.ERROR,
        persistent_log_level=logging.CRITICAL,
        environment="test",
    )
    database = Database(config.db_path)
    database.connect()
    repository = BackendTelemetryRepository(database.conn)
    runtime = configure_logging(config, repository)
    logger = logging.getLogger("momentum.tests.runtime")

    try:
        logger.info("hidden info")
        logger.error("visible error")
    finally:
        runtime.close()

    captured = capsys.readouterr()
    assert "hidden info" not in captured.err
    assert "visible error" in captured.err

    try:
        count = database.conn.execute("SELECT COUNT(*) FROM backend_log_events").fetchone()[0]
        assert count == 0
    finally:
        database.close()


def test_exception_traceback_and_chain_are_preserved(db: Database) -> None:
    handler = PersistentTelemetryHandler(
        BackendTelemetryRepository(db.conn),
        environment="test",
    )
    logger = _logger_with_handler(handler)

    try:
        try:
            raise ValueError("lower-level failure")
        except ValueError as exc:
            raise RuntimeError("higher-level failure") from exc
    except RuntimeError:
        logger.exception("operation failed", extra={"operation": "test_chain"})

    row = db.conn.execute("SELECT * FROM backend_log_events").fetchone()
    assert row is not None
    assert row["exception_type"] == "RuntimeError"
    assert row["message"] == "operation failed"
    assert "ValueError: lower-level failure" in row["traceback"]
    assert "direct cause" in row["traceback"]
    assert "RuntimeError: higher-level failure" in row["traceback"]
    assert row["operation"] == "test_chain"


def test_request_id_and_timestamp_do_not_change_fingerprint(db: Database) -> None:
    handler = PersistentTelemetryHandler(
        BackendTelemetryRepository(db.conn),
        environment="test",
    )
    logger = _logger_with_handler(handler)

    for request_id, item_id in (("request-one", 123), ("request-two", 456)):
        token = bind_request_context(
            RequestLogContext(
                request_id=request_id,
                method="GET",
                path=f"/items/{item_id}",
                route="/items/{item_id}",
            )
        )
        try:
            logger.warning("Item %d has inconsistent state", item_id)
        finally:
            reset_request_context(token)

    rows = db.conn.execute(
        "SELECT request_id, fingerprint FROM backend_log_events ORDER BY id"
    ).fetchall()
    assert [row["request_id"] for row in rows] == ["request-one", "request-two"]
    assert rows[0]["fingerprint"] == rows[1]["fingerprint"]


def test_metadata_is_redacted_bounded_and_cycle_safe(db: Database) -> None:
    handler = PersistentTelemetryHandler(
        BackendTelemetryRepository(db.conn),
        environment="test",
    )
    logger = _logger_with_handler(handler)
    cyclic: dict[str, object] = {"safe": "value"}
    cyclic["self"] = cyclic

    logger.warning(
        "Request failed with authorization=top-secret",
        extra={
            "authorization": "Bearer abc.def",
            "cookie": "session=private",
            "payload": cyclic,
            "oversized": "x" * 100_000,
        },
    )

    row = db.conn.execute("SELECT message, metadata_json FROM backend_log_events").fetchone()
    assert row is not None
    assert "top-secret" not in row["message"]
    assert len(row["metadata_json"]) <= 16_384
    metadata = json.loads(row["metadata_json"])
    assert metadata["authorization"] == "[REDACTED]"
    assert metadata["cookie"] == "[REDACTED]"
    assert metadata["payload"]["self"] == "[CIRCULAR]"


def test_persistence_failure_never_escapes_logging(db: Database, capsys) -> None:  # type: ignore[no-untyped-def]
    repository = BackendTelemetryRepository(db.conn)
    handler = PersistentTelemetryHandler(repository, environment="test")
    logger = _logger_with_handler(handler)
    db.close()

    logger.error("the original operation failed")

    assert "application execution continues" in capsys.readouterr().err


def test_handler_does_not_recurse_when_repository_logs(db: Database) -> None:
    class RecursiveRepository(BackendTelemetryRepository):
        def __init__(self) -> None:
            self.calls = 0

        def insert(self, event: BackendLogEvent) -> None:
            self.calls += 1
            logging.getLogger("momentum.tests.recursion").warning("nested warning")

    repository = RecursiveRepository()
    handler = PersistentTelemetryHandler(repository, environment="test")
    logger = _logger_with_handler(handler, "momentum.tests.recursion")

    logger.warning("outer warning")

    assert repository.calls == 1


def test_repository_retains_latest_two_thousand_events(db: Database) -> None:
    repository = BackendTelemetryRepository(db.conn)

    for index in range(MAX_RETAINED_EVENTS + 5):
        repository.insert(_event(index))

    row = db.conn.execute(
        "SELECT COUNT(*) AS count, MIN(message) AS first FROM backend_log_events"
    ).fetchone()
    oldest = db.conn.execute(
        "SELECT message FROM backend_log_events ORDER BY id LIMIT 1"
    ).fetchone()
    assert row["count"] == MAX_RETAINED_EVENTS
    assert oldest["message"] == "event 5"

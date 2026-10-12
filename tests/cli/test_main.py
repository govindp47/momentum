"""Tests for the root CLI exception boundary."""

from __future__ import annotations

import logging

import pytest

import momentum.cli.main as cli_main
from momentum.ledger.domain.errors import TaskNotFoundError


def test_expected_domain_error_remains_user_facing(
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    error = TaskNotFoundError("missing")
    rendered: list[Exception] = []

    def fail_with_expected_error() -> None:
        raise error

    monkeypatch.setattr(cli_main, "app", fail_with_expected_error)
    monkeypatch.setattr(cli_main, "render_error", rendered.append)

    with pytest.raises(SystemExit) as captured:
        cli_main.main()

    assert captured.value.code == 1
    assert rendered == [error]
    assert caplog.records == []


def test_unexpected_error_is_logged_and_not_rendered_verbatim(
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    rendered: list[Exception] = []

    def fail_unexpectedly() -> None:
        raise RuntimeError("sensitive internal database detail")

    monkeypatch.setattr(cli_main, "app", fail_unexpectedly)
    monkeypatch.setattr(cli_main, "render_error", rendered.append)

    with (
        caplog.at_level(logging.ERROR, logger="momentum.cli.main"),
        pytest.raises(SystemExit) as captured,
    ):
        cli_main.main()

    assert captured.value.code == 1
    assert [str(error) for error in rendered] == ["An unexpected backend error occurred."]
    assert len(caplog.records) == 1
    record = caplog.records[0]
    assert record.getMessage() == "Unhandled exception during CLI command"
    assert record.exc_info is not None
    assert getattr(record, "operation", None) == "cli_command"
    assert getattr(record, "component", None) == "cli"

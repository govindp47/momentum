"""End-to-end CLI tests for Momentum progress commands."""

from __future__ import annotations

import pytest
from typer.testing import CliRunner

from momentum.cli.main import app

runner = CliRunner()

pytestmark = pytest.mark.usefixtures("isolated_db")


def _create_quantity_journey() -> None:
    result = runner.invoke(
        app,
        [
            "stride",
            "journey",
            "create",
            "Run 1000 km",
            "--method",
            "quantity",
            "--target",
            "1000",
            "--unit",
            "km",
            "--no-prompt",
        ],
    )

    assert result.exit_code == 0, result.output


def _create_count_journey() -> None:
    result = runner.invoke(
        app,
        [
            "stride",
            "journey",
            "create",
            "Gym 200 Days",
            "--method",
            "count",
            "--target",
            "200",
            "--no-prompt",
        ],
    )

    assert result.exit_code == 0, result.output


def _create_duration_journey() -> None:
    result = runner.invoke(
        app,
        [
            "stride",
            "journey",
            "create",
            "Study ML",
            "--method",
            "duration",
            "--target",
            "100",
            "--unit",
            "hours",
            "--no-prompt",
        ],
    )

    assert result.exit_code == 0, result.output


def _extract_event_id(output: str) -> str:
    """Extract the first numeric event ID from the history table."""
    for line in output.splitlines():
        if "│" not in line:
            continue

        columns = [column.strip() for column in line.split("│")]

        if len(columns) < 2:
            continue

        event_id = columns[1]

        if event_id.isdigit():
            return event_id

    raise AssertionError(f"Progress history output did not expose an event ID:\n{output}")


class TestProgressLogCLI:
    def test_log_quantity(self) -> None:
        _create_quantity_journey()

        result = runner.invoke(
            app,
            [
                "stride",
                "progress",
                "log",
                "Run 1000 km",
                "--value",
                "7.4",
            ],
        )

        assert result.exit_code == 0, result.output
        assert "7.4" in result.output

    def test_log_count(self) -> None:
        _create_count_journey()

        result = runner.invoke(
            app,
            [
                "stride",
                "progress",
                "log",
                "Gym 200 Days",
            ],
        )

        assert result.exit_code == 0, result.output

    def test_log_duration(self) -> None:
        _create_duration_journey()

        result = runner.invoke(
            app,
            [
                "stride",
                "progress",
                "log",
                "Study ML",
                "--hours",
                "1",
                "--minutes",
                "30",
            ],
        )

        assert result.exit_code == 0, result.output

    def test_log_historical_progress(self) -> None:
        _create_quantity_journey()

        result = runner.invoke(
            app,
            [
                "stride",
                "progress",
                "log",
                "Run 1000 km",
                "--value",
                "5.2",
                "--date",
                "2026-09-01",
            ],
        )

        assert result.exit_code == 0, result.output
        assert "5.2" in result.output

    def test_log_with_note(self) -> None:
        _create_quantity_journey()

        result = runner.invoke(
            app,
            [
                "stride",
                "progress",
                "log",
                "Run 1000 km",
                "--value",
                "8.0",
                "--note",
                "Morning run",
            ],
        )

        assert result.exit_code == 0, result.output
        assert "Morning run" in result.output

    def test_unknown_journey_is_rejected(self) -> None:
        result = runner.invoke(
            app,
            [
                "stride",
                "progress",
                "log",
                "Nonexistent",
                "--value",
                "5",
            ],
        )

        assert result.exit_code != 0
        assert "not found" in result.output.lower()

    def test_zero_quantity_is_rejected(self) -> None:
        _create_quantity_journey()

        result = runner.invoke(
            app,
            [
                "stride",
                "progress",
                "log",
                "Run 1000 km",
                "--value",
                "0",
            ],
        )

        assert result.exit_code != 0

    def test_negative_quantity_is_rejected(self) -> None:
        _create_quantity_journey()

        result = runner.invoke(
            app,
            [
                "stride",
                "progress",
                "log",
                "Run 1000 km",
                "--value",
                "-5",
            ],
        )

        assert result.exit_code != 0

    def test_count_does_not_accept_arbitrary_value(self) -> None:
        _create_count_journey()

        result = runner.invoke(
            app,
            [
                "stride",
                "progress",
                "log",
                "Gym 200 Days",
                "--value",
                "2",
            ],
        )

        assert result.exit_code != 0

    def test_milestone_journey_rejects_normal_progress(self) -> None:
        result = runner.invoke(
            app,
            [
                "stride",
                "journey",
                "create",
                "DS",
                "--method",
                "milestone",
                "--target",
                "1",
                "--no-prompt",
            ],
        )

        assert result.exit_code == 0, result.output

        result = runner.invoke(
            app,
            [
                "stride",
                "progress",
                "log",
                "DS",
            ],
        )

        assert result.exit_code != 0


class TestProgressPausedJourneyCLI:
    def test_paused_journey_rejects_progress(self) -> None:
        _create_quantity_journey()

        pause = runner.invoke(
            app,
            [
                "stride",
                "journey",
                "pause",
                "Run 1000 km",
            ],
        )

        assert pause.exit_code == 0, pause.output

        result = runner.invoke(
            app,
            [
                "stride",
                "progress",
                "log",
                "Run 1000 km",
                "--value",
                "5",
            ],
        )

        assert result.exit_code != 0
        assert "paused" in result.output.lower()


class TestProgressHistoryCLI:
    def test_history_empty(self) -> None:
        _create_quantity_journey()

        result = runner.invoke(
            app,
            [
                "stride",
                "progress",
                "history",
                "Run 1000 km",
            ],
        )

        assert result.exit_code == 0, result.output

    def test_history_shows_logged_value(self) -> None:
        _create_quantity_journey()

        log = runner.invoke(
            app,
            [
                "stride",
                "progress",
                "log",
                "Run 1000 km",
                "--value",
                "5.2",
            ],
        )

        assert log.exit_code == 0, log.output

        result = runner.invoke(
            app,
            [
                "stride",
                "progress",
                "history",
                "Run 1000 km",
            ],
        )

        assert result.exit_code == 0, result.output
        assert "5.2" in result.output

    def test_history_respects_range(self) -> None:
        _create_quantity_journey()

        old = runner.invoke(
            app,
            [
                "stride",
                "progress",
                "log",
                "Run 1000 km",
                "--value",
                "5",
                "--date",
                "2026-01-01",
            ],
        )

        assert old.exit_code == 0, old.output

        recent = runner.invoke(
            app,
            [
                "stride",
                "progress",
                "log",
                "Run 1000 km",
                "--value",
                "10",
                "--date",
                "2026-09-01",
            ],
        )

        assert recent.exit_code == 0, recent.output

        result = runner.invoke(
            app,
            [
                "stride",
                "progress",
                "history",
                "Run 1000 km",
                "--range",
                "this-month",
            ],
        )

        assert result.exit_code == 0, result.output
        assert "10" in result.output

    def test_delete_nonexistent_event_fails(self) -> None:
        result = runner.invoke(
            app,
            [
                "stride",
                "progress",
                "delete",
                "999999",
                "--force",
            ],
        )

        assert result.exit_code != 0

    def test_delete_event(self) -> None:
        _create_quantity_journey()

        log = runner.invoke(
            app,
            [
                "stride",
                "progress",
                "log",
                "Run 1000 km",
                "--value",
                "5",
            ],
        )

        assert log.exit_code == 0, log.output

        history = runner.invoke(
            app,
            [
                "stride",
                "progress",
                "history",
                "Run 1000 km",
            ],
        )

        assert history.exit_code == 0, history.output

        event_id = _extract_event_id(history.output)

        result = runner.invoke(
            app,
            [
                "stride",
                "progress",
                "delete",
                event_id,
                "--force",
            ],
        )

        assert result.exit_code == 0, result.output


class TestProgressStatsIntegrationCLI:
    def test_stats_show_after_progress(self) -> None:
        _create_quantity_journey()

        log = runner.invoke(
            app,
            [
                "stride",
                "progress",
                "log",
                "Run 1000 km",
                "--value",
                "10",
            ],
        )

        assert log.exit_code == 0, log.output

        result = runner.invoke(
            app,
            [
                "stride",
                "stats",
                "show",
                "Run 1000 km",
            ],
        )

        assert result.exit_code == 0, result.output
        assert "Run 1000 km" in result.output

    def test_stats_accepts_all_range(self) -> None:
        _create_quantity_journey()

        log = runner.invoke(
            app,
            [
                "stride",
                "progress",
                "log",
                "Run 1000 km",
                "--value",
                "10",
            ],
        )

        assert log.exit_code == 0, log.output

        result = runner.invoke(
            app,
            [
                "stride",
                "stats",
                "show",
                "Run 1000 km",
                "--range",
                "all",
            ],
        )

        assert result.exit_code == 0, result.output

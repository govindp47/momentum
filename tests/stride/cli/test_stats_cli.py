"""End-to-end CLI tests for Momentum statistics commands."""

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
            "Run",
            "--method",
            "quantity",
            "--target",
            "100",
            "--unit",
            "km",
            "--no-prompt",
        ],
    )

    assert result.exit_code == 0, result.output


class TestStatsCLI:
    def test_show(self) -> None:
        _create_quantity_journey()

        progress = runner.invoke(
            app,
            [
                "stride",
                "progress",
                "log",
                "Run",
                "--value",
                "10",
            ],
        )

        assert progress.exit_code == 0, progress.output

        result = runner.invoke(
            app,
            [
                "stride",
                "stats",
                "show",
                "Run",
            ],
        )

        assert result.exit_code == 0, result.output
        assert "Run" in result.output

    def test_all_range(self) -> None:
        _create_quantity_journey()

        result = runner.invoke(
            app,
            [
                "stride",
                "stats",
                "show",
                "Run",
                "--range",
                "all",
            ],
        )

        assert result.exit_code == 0, result.output

    def test_custom_start_and_end(self) -> None:
        _create_quantity_journey()

        result = runner.invoke(
            app,
            [
                "stride",
                "stats",
                "show",
                "Run",
                "--start",
                "2026-01-01",
                "--end",
                "2026-09-01",
            ],
        )

        assert result.exit_code == 0, result.output

    def test_range_cannot_be_combined_with_custom_dates(self) -> None:
        _create_quantity_journey()

        result = runner.invoke(
            app,
            [
                "stride",
                "stats",
                "show",
                "Run",
                "--range",
                "all",
                "--start",
                "2026-01-01",
            ],
        )

        assert result.exit_code != 0

    def test_invalid_range_is_rejected(self) -> None:
        _create_quantity_journey()

        result = runner.invoke(
            app,
            [
                "stride",
                "stats",
                "show",
                "Run",
                "--range",
                "not-a-range",
            ],
        )

        assert result.exit_code != 0

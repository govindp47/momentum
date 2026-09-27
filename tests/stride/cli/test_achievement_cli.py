"""End-to-end CLI tests for Momentum achievement commands."""

from __future__ import annotations

import pytest
from typer.testing import CliRunner

from momentum.cli.main import app

runner = CliRunner()

pytestmark = pytest.mark.usefixtures("isolated_db")


class TestAchievementCLI:
    def test_empty_achievements(self) -> None:
        result = runner.invoke(
            app,
            [
                "stride",
                "achievements",
                "show",
            ],
        )

        assert result.exit_code == 0, result.output

    def test_achievements_after_progress(self) -> None:
        create = runner.invoke(
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

        assert create.exit_code == 0, create.output

        progress = runner.invoke(
            app,
            [
                "stride",
                "progress",
                "log",
                "Run",
                "--value",
                "1",
            ],
        )

        assert progress.exit_code == 0, progress.output

        result = runner.invoke(
            app,
            [
                "stride",
                "achievements",
                "show",
            ],
        )

        assert result.exit_code == 0, result.output

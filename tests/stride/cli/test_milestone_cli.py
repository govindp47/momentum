"""End-to-end CLI tests for Momentum milestone commands."""

from __future__ import annotations

import pytest
from typer.testing import CliRunner

from momentum.cli.main import app

runner = CliRunner()

pytestmark = pytest.mark.usefixtures("isolated_db")


def _create_milestone_journey() -> None:
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
            "3",
            "--no-prompt",
        ],
    )

    assert result.exit_code == 0, result.output


class TestMilestoneCLI:
    def test_add_and_list(self) -> None:
        _create_milestone_journey()

        result = runner.invoke(
            app,
            [
                "stride",
                "milestone",
                "add",
                "DS",
                "Networking",
            ],
        )

        assert result.exit_code == 0, result.output

        result = runner.invoke(
            app,
            [
                "stride",
                "milestone",
                "list",
                "DS",
            ],
        )

        assert result.exit_code == 0, result.output
        assert "Networking" in result.output

    def test_complete_milestone(self) -> None:
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

        add = runner.invoke(
            app,
            [
                "stride",
                "milestone",
                "add",
                "DS",
                "Networking",
            ],
        )

        assert add.exit_code == 0, add.output

        result = runner.invoke(
            app,
            [
                "stride",
                "milestone",
                "complete",
                "DS",
                "1",
            ],
        )

        assert result.exit_code == 0, result.output
        assert "completed" in result.output.lower()

    def test_reopen_completed_milestone(self) -> None:
        _create_milestone_journey()

        add = runner.invoke(
            app,
            [
                "stride",
                "milestone",
                "add",
                "DS",
                "Networking",
            ],
        )

        assert add.exit_code == 0, add.output

        complete = runner.invoke(
            app,
            [
                "stride",
                "milestone",
                "complete",
                "DS",
                "1",
            ],
        )

        assert complete.exit_code == 0, complete.output

        result = runner.invoke(
            app,
            [
                "stride",
                "milestone",
                "reopen",
                "DS",
                "1",
            ],
        )

        assert result.exit_code == 0, result.output
        assert "pending" in result.output.lower() or "reopen" in result.output.lower()

    def test_complete_unknown_milestone_fails(self) -> None:
        _create_milestone_journey()

        result = runner.invoke(
            app,
            [
                "stride",
                "milestone",
                "complete",
                "DS",
                "999999",
            ],
        )

        assert result.exit_code != 0

    def test_milestone_command_rejects_non_milestone_journey(self) -> None:
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

        result = runner.invoke(
            app,
            [
                "stride",
                "milestone",
                "add",
                "Run",
                "First",
            ],
        )

        assert result.exit_code != 0

    def test_completing_last_milestone_completes_journey(self) -> None:
        _create_milestone_journey()

        for name in (
            "Networking",
            "Databases",
            "Distributed Systems",
        ):
            result = runner.invoke(
                app,
                [
                    "stride",
                    "milestone",
                    "add",
                    "DS",
                    name,
                ],
            )

            assert result.exit_code == 0, result.output

        for milestone_id in ("1", "2", "3"):
            result = runner.invoke(
                app,
                [
                    "stride",
                    "milestone",
                    "complete",
                    "DS",
                    milestone_id,
                ],
            )

            assert result.exit_code == 0, result.output

        result = runner.invoke(
            app,
            [
                "stride",
                "journey",
                "show",
                "DS",
            ],
        )

        assert result.exit_code == 0, result.output
        assert "completed" in result.output.lower()

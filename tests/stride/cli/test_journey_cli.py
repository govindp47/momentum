"""End-to-end CLI tests for Momentum journey commands."""

from __future__ import annotations

import pytest
from typer.testing import CliRunner

from momentum.cli.main import app

runner = CliRunner()

pytestmark = pytest.mark.usefixtures("isolated_db")


class TestVersionCLI:
    def test_version(self) -> None:
        result = runner.invoke(app, ["version"])

        assert result.exit_code == 0, result.output
        assert "Momentum" in result.output


class TestJourneyCreateCLI:
    def test_create_quantity_journey(self) -> None:
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
        assert "Run 1000 km" in result.output

        result = runner.invoke(
            app,
            ["stride", "journey", "list"],
        )

        assert result.exit_code == 0, result.output
        assert "Run 1000 km" in result.output
        assert "quantity" in result.output.lower()

    def test_create_count_journey(self) -> None:
        result = runner.invoke(
            app,
            [
                "stride",
                "journey",
                "create",
                "Gym",
                "--method",
                "count",
                "--target",
                "200",
                "--no-prompt",
            ],
        )

        assert result.exit_code == 0, result.output
        assert "Gym" in result.output

    def test_create_duration_journey(self) -> None:
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
        assert "Study ML" in result.output

    def test_create_milestone_journey(self) -> None:
        result = runner.invoke(
            app,
            [
                "stride",
                "journey",
                "create",
                "Learn Backend",
                "--method",
                "milestone",
                "--target",
                "3",
                "--no-prompt",
            ],
        )

        assert result.exit_code == 0, result.output
        assert "Learn Backend" in result.output

    def test_duplicate_name_is_rejected(self) -> None:
        args = [
            "stride",
            "journey",
            "create",
            "Dup",
            "--method",
            "count",
            "--target",
            "10",
            "--no-prompt",
        ]

        first = runner.invoke(app, args)
        assert first.exit_code == 0, first.output

        second = runner.invoke(app, args)

        assert second.exit_code != 0
        assert "already" in second.output.lower() or "duplicate" in second.output.lower()


class TestJourneyListCLI:
    def test_empty_list(self) -> None:
        result = runner.invoke(
            app,
            ["stride", "journey", "list"],
        )

        assert result.exit_code == 0, result.output

    def test_list_multiple_journeys(self) -> None:
        for name in ("Run", "Gym", "Study"):
            result = runner.invoke(
                app,
                [
                    "stride",
                    "journey",
                    "create",
                    name,
                    "--method",
                    "count",
                    "--target",
                    "10",
                    "--no-prompt",
                ],
            )

            assert result.exit_code == 0, result.output

        result = runner.invoke(
            app,
            ["stride", "journey", "list"],
        )

        assert result.exit_code == 0, result.output
        assert "Run" in result.output
        assert "Gym" in result.output
        assert "Study" in result.output


class TestJourneyShowCLI:
    def test_show_existing_journey(self) -> None:
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

        result = runner.invoke(
            app,
            [
                "stride",
                "journey",
                "show",
                "Run",
            ],
        )

        assert result.exit_code == 0, result.output
        assert "Run" in result.output
        assert "100" in result.output

    def test_show_nonexistent_journey(self) -> None:
        result = runner.invoke(
            app,
            [
                "stride",
                "journey",
                "show",
                "Nonexistent",
            ],
        )

        assert result.exit_code != 0
        assert "not found" in result.output.lower()


class TestJourneyLifecycleCLI:
    def test_pause_and_resume(self) -> None:
        create = runner.invoke(
            app,
            [
                "stride",
                "journey",
                "create",
                "Gym",
                "--method",
                "count",
                "--target",
                "200",
                "--no-prompt",
            ],
        )

        assert create.exit_code == 0, create.output

        result = runner.invoke(
            app,
            [
                "stride",
                "journey",
                "pause",
                "Gym",
            ],
        )

        assert result.exit_code == 0, result.output
        assert "paused" in result.output.lower()

        result = runner.invoke(
            app,
            [
                "stride",
                "journey",
                "resume",
                "Gym",
            ],
        )

        assert result.exit_code == 0, result.output
        assert "active" in result.output.lower()

    def test_archive(self) -> None:
        create = runner.invoke(
            app,
            [
                "stride",
                "journey",
                "create",
                "Old Journey",
                "--method",
                "count",
                "--target",
                "10",
                "--no-prompt",
            ],
        )

        assert create.exit_code == 0, create.output

        result = runner.invoke(
            app,
            [
                "stride",
                "journey",
                "archive",
                "Old Journey",
            ],
        )

        assert result.exit_code == 0, result.output
        assert "archived" in result.output.lower()

    def test_archived_journey_cannot_be_modified(self) -> None:
        create = runner.invoke(
            app,
            [
                "stride",
                "journey",
                "create",
                "Archived",
                "--method",
                "count",
                "--target",
                "10",
                "--no-prompt",
            ],
        )

        assert create.exit_code == 0, create.output

        archive = runner.invoke(
            app,
            [
                "stride",
                "journey",
                "archive",
                "Archived",
            ],
        )

        assert archive.exit_code == 0, archive.output

        result = runner.invoke(
            app,
            [
                "stride",
                "journey",
                "pause",
                "Archived",
            ],
        )

        assert result.exit_code != 0

    def test_nonexistent_journey_lifecycle_operation_fails(self) -> None:
        result = runner.invoke(
            app,
            [
                "stride",
                "journey",
                "pause",
                "Nonexistent",
            ],
        )

        assert result.exit_code != 0
        assert "not found" in result.output.lower()


class TestDashboardCLI:
    def test_empty_dashboard(self) -> None:
        result = runner.invoke(
            app,
            ["dashboard"],
        )

        assert result.exit_code == 0, result.output

    def test_dashboard_contains_active_journey(self) -> None:
        create = runner.invoke(
            app,
            [
                "stride",
                "journey",
                "create",
                "My Run",
                "--method",
                "quantity",
                "--target",
                "1000",
                "--unit",
                "km",
                "--no-prompt",
            ],
        )

        assert create.exit_code == 0, create.output

        result = runner.invoke(
            app,
            ["dashboard"],
        )

        assert result.exit_code == 0, result.output
        assert "My Run" in result.output

    def test_dashboard_does_not_show_archived_journey_as_active(self) -> None:
        create = runner.invoke(
            app,
            [
                "stride",
                "journey",
                "create",
                "Archived Run",
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

        archive = runner.invoke(
            app,
            [
                "stride",
                "journey",
                "archive",
                "Archived Run",
            ],
        )

        assert archive.exit_code == 0, archive.output

        result = runner.invoke(
            app,
            ["dashboard"],
        )

        assert result.exit_code == 0, result.output
        assert "Archived Run" not in result.output

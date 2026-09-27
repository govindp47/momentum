"""End-to-end CLI tests for Momentum export commands."""

from __future__ import annotations

import json
from pathlib import Path

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


class TestExportJSONCLI:
    def test_export_json(self, tmp_path: Path) -> None:
        _create_quantity_journey()

        progress = runner.invoke(
            app,
            [
                "stride",
                "progress",
                "log",
                "Run",
                "--value",
                "5",
            ],
        )

        assert progress.exit_code == 0, progress.output

        output = tmp_path / "export.json"

        result = runner.invoke(
            app,
            [
                "stride",
                "export",
                "json",
                "--output",
                str(output),
            ],
        )

        assert result.exit_code == 0, result.output
        assert output.exists()

        payload = json.loads(output.read_text())

        assert "journeys" in payload or "journey" in payload


class TestExportCSVCLI:
    def test_export_csv(self, tmp_path: Path) -> None:
        _create_quantity_journey()

        progress = runner.invoke(
            app,
            [
                "stride",
                "progress",
                "log",
                "Run",
                "--value",
                "5",
            ],
        )

        assert progress.exit_code == 0, progress.output

        result = runner.invoke(
            app,
            [
                "stride",
                "export",
                "csv",
                "--output",
                str(tmp_path),
            ],
        )

        assert result.exit_code == 0, result.output

        csv_files = list(tmp_path.glob("*.csv"))

        assert csv_files

"""Application service for exporting Stride data."""

from __future__ import annotations

import csv
import json
import re
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

from momentum.stride.domain.models import Journey, ProgressEvent
from momentum.stride.repositories.journey_repository import JourneyRepository
from momentum.stride.repositories.milestone_repository import MilestoneRepository
from momentum.stride.repositories.progress_repository import ProgressRepository


@dataclass(frozen=True, slots=True)
class ExportResult:
    """Result of a completed export operation."""

    journey_count: int
    files: tuple[Path, ...] = ()
    content: str | None = None


class ExportService:
    """Export journey data into portable JSON or CSV representations.

    Export is read-only. This service orchestrates repositories but never
    mutates application state or commits transactions.
    """

    def __init__(
        self,
        journey_repo: JourneyRepository,
        milestone_repo: MilestoneRepository,
        progress_repo: ProgressRepository,
    ) -> None:
        self._journeys = journey_repo
        self._milestones = milestone_repo
        self._progress = progress_repo

    def export_json(
        self,
        *,
        output: Path | None = None,
        journey: Journey | None = None,
    ) -> ExportResult:
        """Export journeys and their related data as JSON.

        Args:
            output: Optional destination JSON file. When omitted, the
                serialized JSON is returned in ``ExportResult.content``.
            journey: Optional journey to export. When omitted, all journeys
                are exported.

        Returns:
            ExportResult describing the exported data.
        """
        journeys = self._select_journeys(journey)

        payload = {
            "format": "stride",
            "version": 1,
            "exported_at": datetime.now().isoformat(
                timespec="seconds",
            ),
            "journeys": [self._serialize_journey(item) for item in journeys],
        }

        content = json.dumps(
            payload,
            indent=2,
            ensure_ascii=False,
        )

        if output is None:
            return ExportResult(
                journey_count=len(journeys),
                content=content,
            )

        self._write_text_file(
            output,
            content,
        )

        return ExportResult(
            journey_count=len(journeys),
            files=(output,),
        )

    def export_csv(
        self,
        *,
        output_dir: Path,
        journey: Journey | None = None,
    ) -> ExportResult:
        """Export progress events as one CSV file per journey.

        Each CSV contains the complete progress-event ledger for one
        journey, including milestone-completion events.
        """
        journeys = self._select_journeys(journey)

        output_dir.mkdir(
            parents=True,
            exist_ok=True,
        )

        files: list[Path] = []

        for item in journeys:
            events = self._progress.list_for_journey(
                item.id,
            )

            filename = self._build_csv_filename(item)
            path = output_dir / filename

            self._write_csv(
                path,
                events,
            )

            files.append(path)

        return ExportResult(
            journey_count=len(journeys),
            files=tuple(files),
        )

    def _select_journeys(
        self,
        journey: Journey | None,
    ) -> list[Journey]:
        """Resolve the journeys included in an export."""
        if journey is not None:
            return [journey]

        return self._journeys.list_all()

    def _serialize_journey(
        self,
        journey: Journey,
    ) -> dict[str, object]:
        """Build the stable JSON representation of one journey."""
        milestones = self._milestones.list_for_journey(
            journey.id,
        )
        events = self._progress.list_for_journey(
            journey.id,
        )

        return {
            "journey": {
                "id": journey.id,
                "name": journey.name,
                "description": journey.description,
                "tracking_method": journey.tracking_method.value,
                "target_value": journey.target_value,
                "unit": journey.unit,
                "status": journey.status.value,
                "start_date": journey.start_date.isoformat(),
                "target_date": (
                    journey.target_date.isoformat() if journey.target_date is not None else None
                ),
                "created_at": journey.created_at.isoformat(),
                "updated_at": journey.updated_at.isoformat(),
            },
            "milestones": [
                {
                    "id": milestone.id,
                    "journey_id": milestone.journey_id,
                    "name": milestone.name,
                    "description": milestone.description,
                    "position": milestone.position,
                    "target_value": milestone.target_value,
                    "unit": milestone.unit,
                    "status": milestone.status.value,
                    "created_at": milestone.created_at.isoformat(),
                    "completed_at": (
                        milestone.completed_at.isoformat()
                        if milestone.completed_at is not None
                        else None
                    ),
                }
                for milestone in milestones
            ],
            "progress_events": [
                {
                    "id": event.id,
                    "journey_id": event.journey_id,
                    "milestone_id": event.milestone_id,
                    "event_type": event.event_type.value,
                    "value": event.value,
                    "duration_seconds": event.duration_seconds,
                    "occurred_at": event.occurred_at.isoformat(),
                    "note": event.note,
                    "created_at": event.created_at.isoformat(),
                }
                for event in events
            ],
        }

    @staticmethod
    def _build_csv_filename(
        journey: Journey,
    ) -> str:
        """Build a deterministic filesystem-safe CSV filename."""
        safe_name = ExportService._safe_filename(
            journey.name,
        )

        return f"{journey.id}_{safe_name}.csv"

    @staticmethod
    def _safe_filename(name: str) -> str:
        """Convert a journey name into a filesystem-safe filename."""
        value = name.strip().lower()

        value = re.sub(
            r"[^a-z0-9]+",
            "_",
            value,
        )

        value = value.strip("_")

        return value[:60] or "journey"

    @staticmethod
    def _write_text_file(
        path: Path,
        content: str,
    ) -> None:
        """Write text content to a file."""
        path.parent.mkdir(
            parents=True,
            exist_ok=True,
        )

        path.write_text(
            content,
            encoding="utf-8",
        )

    @staticmethod
    def _write_csv(
        path: Path,
        events: list[ProgressEvent],
    ) -> None:
        """Write progress events to a CSV file."""
        with path.open(
            "w",
            newline="",
            encoding="utf-8",
        ) as file:
            writer = csv.DictWriter(
                file,
                fieldnames=(
                    "id",
                    "journey_id",
                    "milestone_id",
                    "event_type",
                    "value",
                    "duration_seconds",
                    "occurred_at",
                    "note",
                    "created_at",
                ),
            )

            writer.writeheader()

            for event in events:
                writer.writerow(
                    {
                        "id": event.id,
                        "journey_id": event.journey_id,
                        "milestone_id": ("" if event.milestone_id is None else event.milestone_id),
                        "event_type": event.event_type.value,
                        "value": ("" if event.value is None else event.value),
                        "duration_seconds": (
                            "" if event.duration_seconds is None else event.duration_seconds
                        ),
                        "occurred_at": event.occurred_at.isoformat(),
                        "note": event.note or "",
                        "created_at": event.created_at.isoformat(),
                    }
                )

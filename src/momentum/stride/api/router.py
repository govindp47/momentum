"""Stride HTTP API routes."""

from __future__ import annotations

from collections.abc import Callable
from datetime import date
from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Literal, NoReturn
from zipfile import ZIP_DEFLATED, ZipFile

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response

from momentum.api.dependencies import (
    get_stride_achievement_service,
    get_stride_export_service,
    get_stride_journey_service,
    get_stride_milestone_service,
    get_stride_progress_service,
    get_stride_stats_service,
)
from momentum.stride.api.schemas import (
    AchievementResponse,
    CalendarResponse,
    DailyActivityResponse,
    DashboardJourneyResponse,
    DashboardResponse,
    ExportJsonResponse,
    JourneyAnalyticsResponse,
    JourneyCreateRequest,
    JourneyResponse,
    JourneyUpdateRequest,
    MilestoneCompletionRequest,
    MilestoneCreateRequest,
    MilestoneReorderRequest,
    MilestoneResponse,
    MilestoneUpdateRequest,
    ProgressCreateRequest,
    ProgressEventResponse,
    ProgressUpdateRequest,
    achievement_response,
    activity_response,
    journey_response,
    milestone_response,
    pace_response,
    progress_response,
    progress_summary_response,
    stats_response,
    streak_response,
)
from momentum.stride.domain.enums import JourneyStatus
from momentum.stride.domain.errors import (
    DuplicateJourneyName,
    InvalidDuration,
    InvalidLifecycleTransition,
    InvalidProgressValue,
    InvalidTarget,
    InvalidTrackingMethod,
    JourneyArchived,
    JourneyCompleted,
    JourneyNotFound,
    JourneyPaused,
    MilestoneNotBelongingToJourney,
    MilestoneNotFound,
    ProgressEventNotFound,
    StrideError,
    ValidationError,
)
from momentum.stride.services.achievement_service import AchievementService
from momentum.stride.services.export_service import ExportService
from momentum.stride.services.journey_service import JourneyService
from momentum.stride.services.milestone_service import MilestoneService
from momentum.stride.services.progress_service import ProgressService
from momentum.stride.services.stats_service import DateRange, StatsService

router = APIRouter(
    prefix="/stride",
    tags=["Stride"],
)

LifecycleOperation = Literal[
    "pause",
    "resume",
    "complete",
    "archive",
    "reopen",
]

# ---------------------------------------------------------------------------
# Error mapping
# ---------------------------------------------------------------------------


def _raise_http_error(exc: StrideError) -> NoReturn:
    if isinstance(exc, JourneyNotFound):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc

    if isinstance(exc, (MilestoneNotFound, ProgressEventNotFound)):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc

    if isinstance(exc, DuplicateJourneyName):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc

    if isinstance(
        exc,
        (
            JourneyArchived,
            JourneyPaused,
            JourneyCompleted,
            InvalidLifecycleTransition,
            MilestoneNotBelongingToJourney,
        ),
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc

    if isinstance(
        exc,
        (
            InvalidTrackingMethod,
            InvalidTarget,
            InvalidProgressValue,
            InvalidDuration,
            ValidationError,
        ),
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=str(exc),
    ) from exc


# ---------------------------------------------------------------------------
# Journey endpoints
# ---------------------------------------------------------------------------


@router.get(
    "/journeys",
    response_model=list[JourneyResponse],
    summary="List journeys",
)
def list_journeys(
    status_filter: JourneyStatus | None = Query(
        default=None,
        alias="status",
    ),
    service: JourneyService = Depends(get_stride_journey_service),
) -> list[JourneyResponse]:
    try:
        journeys = service.list_journeys(status=status_filter)
        return [journey_response(journey) for journey in journeys]
    except StrideError as exc:
        _raise_http_error(exc)


@router.post(
    "/journeys",
    response_model=JourneyResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a journey",
)
def create_journey(
    request: JourneyCreateRequest,
    service: JourneyService = Depends(get_stride_journey_service),
) -> JourneyResponse:
    try:
        journey = service.create_journey(
            name=request.name,
            description=request.description,
            tracking_method=request.tracking_method,
            target_value=request.target_value,
            unit=request.unit,
            start_date=request.start_date,
            target_date=request.target_date,
            milestone_names=request.milestone_names,
        )
        return journey_response(journey)
    except StrideError as exc:
        _raise_http_error(exc)


@router.get(
    "/journeys/{journey}",
    response_model=JourneyResponse,
    summary="Get a journey",
)
def get_journey(
    journey: str,
    service: JourneyService = Depends(get_stride_journey_service),
) -> JourneyResponse:
    try:
        return journey_response(service.get_journey(journey))
    except StrideError as exc:
        _raise_http_error(exc)


@router.patch(
    "/journeys/{journey}",
    response_model=JourneyResponse,
    summary="Update a journey",
)
def update_journey(
    journey: str,
    request: JourneyUpdateRequest,
    service: JourneyService = Depends(get_stride_journey_service),
) -> JourneyResponse:
    if request.target_date is not None and request.clear_target_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="target_date and clear_target_date cannot be used together.",
        )

    if request.unit is not None and request.clear_unit:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="unit and clear_unit cannot be used together.",
        )

    try:
        updated = service.edit_journey(
            journey,
            new_name=request.name,
            description=request.description,
            target_value=request.target_value,
            unit=request.unit,
            clear_unit=request.clear_unit,
            target_date=request.target_date,
            clear_target_date=request.clear_target_date,
        )
        return journey_response(updated)
    except StrideError as exc:
        _raise_http_error(exc)


def _lifecycle_operation(
    operation: LifecycleOperation,
    journey: str,
    service: JourneyService,
) -> JourneyResponse:
    try:
        handler = {
            "pause": service.pause,
            "resume": service.resume,
            "complete": service.complete,
            "archive": service.archive,
            "reopen": service.reopen,
        }[operation]

        return journey_response(handler(journey))
    except StrideError as exc:
        _raise_http_error(exc)


@router.post(
    "/journeys/{journey}/pause",
    response_model=JourneyResponse,
    summary="Pause a journey",
)
def pause_journey(
    journey: str,
    service: JourneyService = Depends(get_stride_journey_service),
) -> JourneyResponse:
    return _lifecycle_operation("pause", journey, service)


@router.post(
    "/journeys/{journey}/resume",
    response_model=JourneyResponse,
    summary="Resume a journey",
)
def resume_journey(
    journey: str,
    service: JourneyService = Depends(get_stride_journey_service),
) -> JourneyResponse:
    return _lifecycle_operation("resume", journey, service)


@router.post(
    "/journeys/{journey}/complete",
    response_model=JourneyResponse,
    summary="Complete a journey",
)
def complete_journey(
    journey: str,
    service: JourneyService = Depends(get_stride_journey_service),
) -> JourneyResponse:
    return _lifecycle_operation("complete", journey, service)


@router.post(
    "/journeys/{journey}/archive",
    response_model=JourneyResponse,
    summary="Archive a journey",
)
def archive_journey(
    journey: str,
    service: JourneyService = Depends(get_stride_journey_service),
) -> JourneyResponse:
    return _lifecycle_operation("archive", journey, service)


@router.post(
    "/journeys/{journey}/reopen",
    response_model=JourneyResponse,
    summary="Reopen a journey",
)
def reopen_journey(
    journey: str,
    service: JourneyService = Depends(get_stride_journey_service),
) -> JourneyResponse:
    return _lifecycle_operation("reopen", journey, service)


# ---------------------------------------------------------------------------
# Milestone endpoints
# ---------------------------------------------------------------------------


@router.get(
    "/journeys/{journey}/milestones",
    response_model=list[MilestoneResponse],
    summary="List journey milestones",
)
def list_milestones(
    journey: str,
    journey_service: JourneyService = Depends(get_stride_journey_service),
    milestone_service: MilestoneService = Depends(get_stride_milestone_service),
) -> list[MilestoneResponse]:
    try:
        current = journey_service.get_journey(journey)
        milestones = milestone_service.list_milestones(current.id)
        return [milestone_response(item) for item in milestones]
    except StrideError as exc:
        _raise_http_error(exc)


@router.post(
    "/journeys/{journey}/milestones",
    response_model=MilestoneResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add a milestone",
)
def add_milestone(
    journey: str,
    request: MilestoneCreateRequest,
    journey_service: JourneyService = Depends(get_stride_journey_service),
    milestone_service: MilestoneService = Depends(get_stride_milestone_service),
) -> MilestoneResponse:
    try:
        current = journey_service.get_journey(journey)
        milestone = milestone_service.add_milestone(
            current,
            name=request.name,
            description=request.description,
            position=request.position,
        )
        return milestone_response(milestone)
    except StrideError as exc:
        _raise_http_error(exc)


@router.patch(
    "/journeys/{journey}/milestones/{milestone_id}",
    response_model=MilestoneResponse,
    summary="Update a milestone",
)
def update_milestone(
    journey: str,
    milestone_id: int,
    request: MilestoneUpdateRequest,
    journey_service: JourneyService = Depends(get_stride_journey_service),
    milestone_service: MilestoneService = Depends(get_stride_milestone_service),
) -> MilestoneResponse:
    try:
        current = journey_service.get_journey(journey)
        milestone = milestone_service.edit_milestone(
            current,
            milestone_id,
            name=request.name,
            description=request.description,
        )
        return milestone_response(milestone)
    except StrideError as exc:
        _raise_http_error(exc)


@router.delete(
    "/journeys/{journey}/milestones/{milestone_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a milestone",
)
def delete_milestone(
    journey: str,
    milestone_id: int,
    journey_service: JourneyService = Depends(get_stride_journey_service),
    milestone_service: MilestoneService = Depends(get_stride_milestone_service),
) -> Response:
    try:
        current = journey_service.get_journey(journey)
        milestone_service.delete_milestone(current, milestone_id)
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except StrideError as exc:
        _raise_http_error(exc)


@router.post(
    "/journeys/{journey}/milestones/reorder",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Reorder milestones",
)
def reorder_milestones(
    journey: str,
    request: MilestoneReorderRequest,
    journey_service: JourneyService = Depends(get_stride_journey_service),
    milestone_service: MilestoneService = Depends(get_stride_milestone_service),
) -> Response:
    try:
        current = journey_service.get_journey(journey)
        milestone_service.reorder_milestones(
            current,
            request.ordered_ids,
        )
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except StrideError as exc:
        _raise_http_error(exc)


@router.post(
    "/journeys/{journey}/milestones/{milestone_id}/complete",
    response_model=ProgressEventResponse,
    summary="Complete a milestone",
)
def complete_milestone(
    journey: str,
    milestone_id: int,
    request: MilestoneCompletionRequest,
    progress_service: ProgressService = Depends(get_stride_progress_service),
) -> ProgressEventResponse:
    try:
        event = progress_service.complete_milestone(
            journey,
            milestone_id,
            occurred_at=request.occurred_at,
            note=request.note,
        )
        return progress_response(event)
    except StrideError as exc:
        _raise_http_error(exc)


@router.post(
    "/journeys/{journey}/milestones/{milestone_id}/reopen",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Reopen a milestone",
)
def reopen_milestone(
    journey: str,
    milestone_id: int,
    progress_service: ProgressService = Depends(get_stride_progress_service),
) -> Response:
    try:
        progress_service.reopen_milestone(
            journey,
            milestone_id,
        )
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except StrideError as exc:
        _raise_http_error(exc)


# ---------------------------------------------------------------------------
# Progress endpoints
# ---------------------------------------------------------------------------


@router.post(
    "/journeys/{journey}/progress",
    response_model=ProgressEventResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Log progress",
)
def log_progress(
    journey: str,
    request: ProgressCreateRequest,
    service: ProgressService = Depends(get_stride_progress_service),
) -> ProgressEventResponse:
    try:
        event = service.log_progress(
            journey,
            value=request.value,
            duration_seconds=request.duration_seconds,
            occurred_at=request.occurred_at,
            note=request.note,
        )
        return progress_response(event)
    except StrideError as exc:
        _raise_http_error(exc)


@router.get(
    "/journeys/{journey}/progress",
    response_model=list[ProgressEventResponse],
    summary="Get progress history",
)
def get_progress_history(
    journey: str,
    limit: int | None = Query(default=50, ge=1, le=500),
    start_date: date | None = None,
    end_date: date | None = None,
    journey_service: JourneyService = Depends(get_stride_journey_service),
    service: ProgressService = Depends(get_stride_progress_service),
) -> list[ProgressEventResponse]:
    try:
        journey_service.get_journey(journey)

        events = service.get_history(
            journey,
            limit=limit,
            start_date=start_date,
            end_date=end_date,
        )
        return [progress_response(event) for event in events]
    except StrideError as exc:
        _raise_http_error(exc)


@router.patch(
    "/progress/{event_id}",
    response_model=ProgressEventResponse,
    summary="Update a progress event",
)
def update_progress_event(
    event_id: int,
    request: ProgressUpdateRequest,
    service: ProgressService = Depends(get_stride_progress_service),
) -> ProgressEventResponse:
    try:
        event = service.edit_event(
            event_id,
            value=request.value,
            clear_value=request.clear_value,
            duration_seconds=request.duration_seconds,
            clear_duration=request.clear_duration,
            occurred_at=request.occurred_at,
            note=request.note,
            clear_note=request.clear_note,
        )
        return progress_response(event)
    except StrideError as exc:
        _raise_http_error(exc)


@router.delete(
    "/progress/{event_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a progress event",
)
def delete_progress_event(
    event_id: int,
    service: ProgressService = Depends(get_stride_progress_service),
) -> Response:
    try:
        service.delete_event(event_id)
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except StrideError as exc:
        _raise_http_error(exc)


# ---------------------------------------------------------------------------
# Statistics
# ---------------------------------------------------------------------------


def _resolve_date_range(
    range_name: str | None,
    start_date: date | None,
    end_date: date | None,
) -> DateRange | None:
    if range_name and (start_date or end_date):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="range cannot be combined with start_date or end_date.",
        )

    if start_date or end_date:
        try:
            return DateRange.custom(start_date, end_date)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(exc),
            ) from exc

    if range_name is None:
        return None

    presets: dict[str, Callable[[], DateRange]] = {
        "all": DateRange.all_time,
        "today": DateRange.today,
        "yesterday": DateRange.yesterday,
        "7d": lambda: DateRange.last_n_days(7),
        "30d": lambda: DateRange.last_n_days(30),
        "this-month": DateRange.this_month,
        "last-month": DateRange.last_month,
        "this-year": DateRange.this_year,
        "last-year": DateRange.last_year,
    }

    normalized = range_name.lower()
    factory = presets.get(normalized)

    if factory is None:
        valid = ", ".join(presets)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown range '{range_name}'. Valid ranges: {valid}.",
        )

    return factory()


@router.get(
    "/journeys/{journey}/stats",
    response_model=JourneyAnalyticsResponse,
    summary="Get journey analytics",
)
def get_journey_stats(
    journey: str,
    range_name: str | None = Query(default=None, alias="range"),
    start_date: date | None = None,
    end_date: date | None = None,
    journey_service: JourneyService = Depends(get_stride_journey_service),
    stats_service: StatsService = Depends(get_stride_stats_service),
) -> JourneyAnalyticsResponse:
    try:
        current = journey_service.get_journey(journey)

        date_range = _resolve_date_range(
            range_name,
            start_date,
            end_date,
        )

        progress = stats_service.get_progress(current)
        streak = stats_service.get_streak(current)
        pace = stats_service.get_pace(current, progress)
        stats = stats_service.get_stats(current, date_range)

        return JourneyAnalyticsResponse(
            progress=progress_summary_response(progress),
            streak=streak_response(streak),
            pace=pace_response(pace),
            stats=stats_response(stats),
        )
    except StrideError as exc:
        _raise_http_error(exc)


@router.get(
    "/journeys/{journey}/calendar/{year}",
    response_model=CalendarResponse,
    summary="Get journey calendar activity",
)
def get_calendar(
    journey: str,
    year: int,
    journey_service: JourneyService = Depends(get_stride_journey_service),
    stats_service: StatsService = Depends(get_stride_stats_service),
) -> CalendarResponse:
    if not 1900 <= year <= 9999:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="year must be between 1900 and 9999.",
        )

    try:
        current = journey_service.get_journey(journey)
        activity = stats_service.get_calendar_data(current, year)

        return CalendarResponse(
            year=year,
            journey=journey_response(current),
            activity=[activity_response(item) for item in activity],
        )
    except StrideError as exc:
        _raise_http_error(exc)


@router.get(
    "/dashboard",
    response_model=DashboardResponse,
    summary="Get the Stride dashboard",
)
def get_dashboard(
    journey_service: JourneyService = Depends(get_stride_journey_service),
    stats_service: StatsService = Depends(get_stride_stats_service),
) -> DashboardResponse:
    try:
        journeys = journey_service.list_journeys(
            status=JourneyStatus.ACTIVE,
        )

        summaries = {journey.id: stats_service.get_progress(journey) for journey in journeys}

        streaks = {journey.id: stats_service.get_streak(journey) for journey in journeys}

        today_activity = stats_service.get_today_activity(journeys)

        dashboard_journeys = [
            DashboardJourneyResponse(
                journey=journey_response(journey),
                progress=progress_summary_response(summaries[journey.id]),
                streak=streak_response(streaks[journey.id]),
            )
            for journey in journeys
        ]

        dashboard_activity: dict[int, DailyActivityResponse] = {
            journey_id: activity_response(activity)
            for journey_id, activity in today_activity.items()
        }

        return DashboardResponse(
            journeys=dashboard_journeys,
            today_activity=dashboard_activity,
        )
    except StrideError as exc:
        _raise_http_error(exc)


# ---------------------------------------------------------------------------
# Achievements
# ---------------------------------------------------------------------------


@router.get(
    "/achievements",
    response_model=list[AchievementResponse],
    summary="Get achievements",
)
def get_achievements(
    journey: str | None = None,
    journey_service: JourneyService = Depends(get_stride_journey_service),
    service: AchievementService = Depends(get_stride_achievement_service),
) -> list[AchievementResponse]:
    try:
        current = journey_service.get_journey(journey) if journey else None
        achievements = service.get_achievements(current)

        return [achievement_response(item) for item in achievements]
    except StrideError as exc:
        _raise_http_error(exc)


# ---------------------------------------------------------------------------
# Export
# ---------------------------------------------------------------------------


@router.get(
    "/export/json",
    response_model=ExportJsonResponse,
    summary="Export journey data as JSON",
)
def export_json(
    journey: str | None = None,
    journey_service: JourneyService = Depends(get_stride_journey_service),
    export_service: ExportService = Depends(get_stride_export_service),
) -> ExportJsonResponse:
    try:
        current = journey_service.get_journey(journey) if journey else None

        result = export_service.export_json(
            output=None,
            journey=current,
        )

        return ExportJsonResponse(
            journey_count=result.journey_count,
            content=result.content or "",
        )
    except StrideError as exc:
        _raise_http_error(exc)


@router.get(
    "/export/csv",
    summary="Export journey progress as CSV archive",
)
def export_csv(
    journey: str | None = None,
    journey_service: JourneyService = Depends(get_stride_journey_service),
    export_service: ExportService = Depends(get_stride_export_service),
) -> Response:
    """Export CSV files as a ZIP archive.

    The CLI writes CSV files to a directory. The HTTP API instead returns a
    ZIP archive so the server never needs to expose an arbitrary filesystem
    path to the client.
    """

    try:
        current = journey_service.get_journey(journey) if journey else None

        with TemporaryDirectory(prefix="momentum-stride-export-") as temp_dir:
            result = export_service.export_csv(
                output_dir=Path(temp_dir),
                journey=current,
            )

            archive = BytesIO()

            with ZipFile(
                archive,
                mode="w",
                compression=ZIP_DEFLATED,
            ) as zip_file:
                for path in result.files:
                    zip_file.write(
                        path,
                        arcname=path.name,
                    )

            archive.seek(0)

            return Response(
                content=archive.read(),
                media_type="application/zip",
                headers={
                    "Content-Disposition": 'attachment; filename="stride-export.zip"',
                },
            )

    except StrideError as exc:
        _raise_http_error(exc)

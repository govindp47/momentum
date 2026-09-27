"""Tests for AchievementService."""

from __future__ import annotations

from datetime import date, datetime, timedelta

from momentum.app.context import AppContext
from momentum.stride.domain.enums import TrackingMethod
from momentum.stride.domain.models import Journey
from momentum.stride.services.achievement_service import AchievementService


def _achievement_service(context: AppContext) -> AchievementService:
    """Return the application-configured achievement service."""
    return context.stride_achievement_service


class TestAchievements:
    def test_no_achievements_with_no_data(
        self,
        context: AppContext,
    ) -> None:
        service = _achievement_service(context)

        achievements = service.get_achievements()

        keys = {achievement.key for achievement in achievements}

        assert "journeys_1" not in keys
        assert "events_10" not in keys

    def test_first_journey_achievement(
        self,
        context: AppContext,
    ) -> None:
        journey = context.stride_journey_service.create_journey(
            name="J",
            tracking_method=TrackingMethod.COUNT,
            target_value=10,
        )

        service = _achievement_service(context)

        achievements = service.get_achievements()
        keys = {achievement.key for achievement in achievements}

        assert "journeys_1" in keys

    def test_first_step_requires_actual_progress(
        self,
        running_journey: Journey,
        context: AppContext,
    ) -> None:
        service = _achievement_service(context)

        achievements = service.get_achievements(
            running_journey,
        )

        keys = {achievement.key for achievement in achievements}

        assert f"{running_journey.id}:first_step" not in keys

        context.stride_progress_service.log_progress(
            running_journey.id,
            value=1.0,
        )

        achievements = service.get_achievements(
            running_journey,
        )

        keys = {achievement.key for achievement in achievements}

        assert f"{running_journey.id}:first_step" in keys

    def test_halfway_achievement(
        self,
        context: AppContext,
    ) -> None:
        journey = context.stride_journey_service.create_journey(
            name="Small",
            tracking_method=TrackingMethod.COUNT,
            target_value=10,
        )

        for _ in range(5):
            context.stride_progress_service.log_progress(journey.id)

        service = _achievement_service(context)

        achievements = service.get_achievements(journey)
        keys = {achievement.key for achievement in achievements}

        assert f"{journey.id}:halfway" in keys

    def test_completed_achievement(
        self,
        context: AppContext,
    ) -> None:
        journey = context.stride_journey_service.create_journey(
            name="Finish",
            tracking_method=TrackingMethod.COUNT,
            target_value=3,
        )

        for _ in range(3):
            context.stride_progress_service.log_progress(journey.id)

        service = _achievement_service(context)

        achievements = service.get_achievements(journey)
        keys = {achievement.key for achievement in achievements}

        assert f"{journey.id}:finished" in keys

    def test_streak_achievement(
        self,
        context: AppContext,
    ) -> None:
        journey = context.stride_journey_service.create_journey(
            name="Streaker",
            tracking_method=TrackingMethod.COUNT,
            target_value=100,
        )

        today = date.today()

        for offset in range(6, -1, -1):
            day = today - timedelta(days=offset)

            context.stride_progress_service.log_progress(
                journey.id,
                occurred_at=datetime(
                    day.year,
                    day.month,
                    day.day,
                ),
            )

        service = _achievement_service(context)

        achievements = service.get_achievements(journey)
        keys = {achievement.key for achievement in achievements}

        assert f"{journey.id}:streak_7" in keys

    def test_no_duplicate_achievements(
        self,
        context: AppContext,
    ) -> None:
        journey = context.stride_journey_service.create_journey(
            name="J",
            tracking_method=TrackingMethod.COUNT,
            target_value=10,
        )

        context.stride_progress_service.log_progress(journey.id)

        service = _achievement_service(context)

        achievements = service.get_achievements(journey)
        keys = [achievement.key for achievement in achievements]

        assert len(keys) == len(set(keys))

    def test_global_event_count_achievement(
        self,
        context: AppContext,
    ) -> None:
        journey = context.stride_journey_service.create_journey(
            name="J",
            tracking_method=TrackingMethod.COUNT,
            target_value=100,
        )

        for _ in range(10):
            context.stride_progress_service.log_progress(journey.id)

        service = _achievement_service(context)

        achievements = service.get_achievements()
        keys = {achievement.key for achievement in achievements}

        assert "events_10" in keys

    def test_milestone_completion_counts_as_activity(
        self,
        milestone_journey: Journey,
        context: AppContext,
    ) -> None:
        achievement_service = _achievement_service(context)

        milestone = context.stride_milestone_service.add_milestone(
            milestone_journey,
            name="First milestone",
        )

        context.stride_progress_service.complete_milestone(
            milestone_journey.id,
            milestone.id,
        )

        achievements = achievement_service.get_achievements(
            milestone_journey,
        )

        keys = {achievement.key for achievement in achievements}

        assert f"{milestone_journey.id}:first_step" in keys

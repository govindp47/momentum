"""Achievement service — derives accomplishments from current activity.

Achievements are intentionally not persisted in V1. They are recalculated
from current journey/event data, so historical corrections automatically
affect which achievements are currently unlocked.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from momentum.stride.domain.models import Achievement, Journey
from momentum.stride.repositories.journey_repository import JourneyRepository
from momentum.stride.repositories.progress_repository import ProgressRepository
from momentum.stride.services.stats_service import StatsService


@dataclass(frozen=True, slots=True)
class AchievementDef:
    """Static definition of an achievement."""

    key: str
    title: str
    description: str


PROGRESS_ACHIEVEMENTS: tuple[tuple[float, AchievementDef], ...] = (
    (
        0.01,
        AchievementDef(
            "first_step",
            "First Step",
            "Logged your first progress event.",
        ),
    ),
    (
        10.0,
        AchievementDef(
            "getting_started",
            "Getting Started",
            "Reached 10% of your target.",
        ),
    ),
    (
        25.0,
        AchievementDef(
            "quarter_way",
            "Quarter Way",
            "Reached 25% of your target.",
        ),
    ),
    (
        50.0,
        AchievementDef(
            "halfway",
            "Halfway There",
            "Reached 50% of your target.",
        ),
    ),
    (
        75.0,
        AchievementDef(
            "three_quarters",
            "Three Quarters",
            "Reached 75% of your target.",
        ),
    ),
    (
        100.0,
        AchievementDef(
            "finished",
            "Finished!",
            "Completed your journey.",
        ),
    ),
)


STREAK_ACHIEVEMENTS: tuple[tuple[int, AchievementDef], ...] = (
    (
        3,
        AchievementDef(
            "streak_3",
            "3-Day Streak",
            "Active for 3 consecutive days.",
        ),
    ),
    (
        7,
        AchievementDef(
            "streak_7",
            "Week Warrior",
            "Active for 7 consecutive days.",
        ),
    ),
    (
        14,
        AchievementDef(
            "streak_14",
            "Fortnight Strong",
            "Active for 14 consecutive days.",
        ),
    ),
    (
        30,
        AchievementDef(
            "streak_30",
            "Monthly Dedication",
            "Active for 30 consecutive days.",
        ),
    ),
    (
        100,
        AchievementDef(
            "streak_100",
            "Century Streak",
            "Active for 100 consecutive days.",
        ),
    ),
)


EVENT_COUNT_ACHIEVEMENTS: tuple[tuple[int, AchievementDef], ...] = (
    (
        1,
        AchievementDef(
            "events_1",
            "First Log",
            "Logged your very first progress event.",
        ),
    ),
    (
        10,
        AchievementDef(
            "events_10",
            "10 Events",
            "Logged 10 progress events.",
        ),
    ),
    (
        50,
        AchievementDef(
            "events_50",
            "50 Events",
            "Logged 50 progress events.",
        ),
    ),
    (
        100,
        AchievementDef(
            "events_100",
            "Century Logger",
            "Logged 100 progress events.",
        ),
    ),
    (
        500,
        AchievementDef(
            "events_500",
            "500 Events",
            "Logged 500 progress events.",
        ),
    ),
    (
        1000,
        AchievementDef(
            "events_1000",
            "Power Logger",
            "Logged 1000 progress events.",
        ),
    ),
)


JOURNEY_COUNT_ACHIEVEMENTS: tuple[tuple[int, AchievementDef], ...] = (
    (
        1,
        AchievementDef(
            "journeys_1",
            "First Journey",
            "Started your first journey.",
        ),
    ),
    (
        5,
        AchievementDef(
            "journeys_5",
            "5 Journeys",
            "Started 5 journeys.",
        ),
    ),
    (
        10,
        AchievementDef(
            "journeys_10",
            "10 Journeys",
            "Started 10 journeys.",
        ),
    ),
    (
        25,
        AchievementDef(
            "journeys_25",
            "25 Journeys",
            "Started 25 journeys.",
        ),
    ),
)


class AchievementService:
    """Derive all currently unlocked achievements."""

    def __init__(
        self,
        journey_repo: JourneyRepository,
        progress_repo: ProgressRepository,
        stats_service: StatsService,
    ) -> None:
        self._journeys = journey_repo
        self._events = progress_repo
        self._stats = stats_service

    def get_achievements(
        self,
        journey: Journey | None = None,
    ) -> list[Achievement]:
        """Return currently unlocked achievements."""
        journeys = [journey] if journey is not None else self._journeys.list_all()

        achievements: list[Achievement] = []

        for current_journey in journeys:
            achievements.extend(
                self._get_journey_achievements(
                    current_journey,
                )
            )

        if journey is None:
            achievements.extend(self._get_global_achievements())

        return achievements

    def _get_journey_achievements(
        self,
        journey: Journey,
    ) -> list[Achievement]:
        """Calculate achievements belonging to one journey."""
        progress = self._stats.get_progress(journey)
        streak = self._stats.get_streak(journey)

        results: list[Achievement] = []

        for threshold, definition in PROGRESS_ACHIEVEMENTS:
            if self._progress_threshold_reached(
                journey,
                progress.percentage,
                threshold,
            ):
                results.append(
                    self._build_journey_achievement(
                        journey,
                        definition,
                    )
                )

        for threshold, definition in STREAK_ACHIEVEMENTS:
            if streak.longest_streak >= threshold:
                results.append(
                    self._build_journey_achievement(
                        journey,
                        definition,
                    )
                )

        return results

    @staticmethod
    def _progress_threshold_reached(
        journey: Journey,
        percentage: float,
        threshold: float,
    ) -> bool:
        """Determine whether a progress achievement is unlocked."""
        if threshold == 0.01:
            # "First Step" means at least one actual activity event.
            return percentage > 0.0

        return percentage >= threshold

    @staticmethod
    def _build_journey_achievement(
        journey: Journey,
        definition: AchievementDef,
    ) -> Achievement:
        """Create a derived journey achievement."""
        return Achievement(
            key=f"{journey.id}:{definition.key}",
            title=definition.title,
            description=definition.description,
            journey_id=journey.id,
            journey_name=journey.name,
            # Achievements are derived, so this timestamp means when the
            # achievement was evaluated, not historical unlock time.
            unlocked_at=datetime.now(),
        )

    def _get_global_achievements(self) -> list[Achievement]:
        """Calculate global achievements."""
        results: list[Achievement] = []

        total_events = self._events.total_event_count()

        for threshold, definition in EVENT_COUNT_ACHIEVEMENTS:
            if total_events >= threshold:
                results.append(
                    self._build_global_achievement(
                        definition,
                    )
                )

        total_journeys = len(self._journeys.list_all())

        for threshold, definition in JOURNEY_COUNT_ACHIEVEMENTS:
            if total_journeys >= threshold:
                results.append(
                    self._build_global_achievement(
                        definition,
                    )
                )

        return results

    @staticmethod
    def _build_global_achievement(
        definition: AchievementDef,
    ) -> Achievement:
        """Create a derived global achievement."""
        return Achievement(
            key=definition.key,
            title=definition.title,
            description=definition.description,
            journey_id=None,
            journey_name=None,
            unlocked_at=datetime.now(),
        )

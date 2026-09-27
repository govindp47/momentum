"""Application context and service construction."""

from __future__ import annotations

import sqlite3
from collections.abc import Generator
from contextlib import contextmanager

from momentum.config import AppConfig
from momentum.dashboard.service import DashboardService
from momentum.ledger.repositories.entry_repository import (
    EntryRepository as LedgerEntryRepository,
)
from momentum.ledger.repositories.task_repository import (
    TaskRepository as LedgerTaskRepository,
)
from momentum.ledger.services.stats_service import (
    StatsService as LedgerStatsService,
)
from momentum.ledger.services.task_service import (
    TaskService as LedgerTaskService,
)
from momentum.ledger.services.tracking_service import (
    TrackingService as LedgerTrackingService,
)
from momentum.storage.database import Database
from momentum.stride.repositories.journey_repository import (
    JourneyRepository as StrideJourneyRepository,
)
from momentum.stride.repositories.milestone_repository import (
    MilestoneRepository as StrideMilestoneRepository,
)
from momentum.stride.repositories.progress_repository import (
    ProgressRepository as StrideProgressRepository,
)
from momentum.stride.services.achievement_service import AchievementService
from momentum.stride.services.export_service import ExportService
from momentum.stride.services.journey_service import JourneyService
from momentum.stride.services.milestone_service import MilestoneService
from momentum.stride.services.progress_service import ProgressService
from momentum.stride.services.stats_service import (
    StatsService as StrideStatsService,
)


class AppContext:
    """Application-wide dependency context.

    Owns the application database and all service dependencies created
    from that database connection.
    """

    def __init__(
        self,
        config: AppConfig,
        database: Database | None = None,
    ) -> None:
        self.config = config

        if database is None:
            self.database = Database(config.db_path)
            self.database.connect()
            self._owns_database = True
        else:
            self.database = database
            self._owns_database = False

        connection = self.database.conn

        # LifeLedger services.
        self.ledger_task_service = LedgerTaskService(
            LedgerTaskRepository(connection),
        )
        self.ledger_tracking_service = LedgerTrackingService(
            LedgerTaskRepository(connection),
            LedgerEntryRepository(connection),
        )
        self.ledger_stats_service = LedgerStatsService(
            LedgerTaskRepository(connection),
            LedgerEntryRepository(connection),
        )

        # Stride services.
        self.stride_journey_service = JourneyService(
            StrideJourneyRepository(connection),
            StrideMilestoneRepository(connection),
            self.database.transaction,
        )
        self.stride_milestone_service = MilestoneService(
            StrideMilestoneRepository(connection),
            self.database.transaction,
        )
        self.stride_progress_service = ProgressService(
            StrideJourneyRepository(connection),
            StrideMilestoneRepository(connection),
            StrideProgressRepository(connection),
            self.database.transaction,
        )
        self.stride_stats_service = StrideStatsService(
            StrideJourneyRepository(connection),
            StrideMilestoneRepository(connection),
            StrideProgressRepository(connection),
        )
        self.stride_achievement_service = AchievementService(
            StrideJourneyRepository(connection),
            StrideProgressRepository(connection),
            self.stride_stats_service,
        )
        self.stride_export_service = ExportService(
            StrideJourneyRepository(connection),
            StrideMilestoneRepository(connection),
            StrideProgressRepository(connection),
        )

        # Dashboard service.
        self.dashboard_service = DashboardService(
            self.ledger_stats_service,
            self.stride_journey_service,
            self.stride_stats_service,
        )

    @property
    def connection(self) -> sqlite3.Connection:
        """Return the active application database connection."""
        return self.database.conn

    def close(self) -> None:
        """Close the database if this context owns it."""
        if self._owns_database:
            self.database.close()

    def __enter__(self) -> AppContext:
        """Enter the application context."""
        return self

    def __exit__(
        self,
        exc_type: object,
        exc_value: object,
        traceback: object,
    ) -> None:
        """Close the application context."""
        self.close()


@contextmanager
def app_context(config: AppConfig) -> Generator[AppContext, None, None]:
    """Provide an application context for one CLI command."""
    context = AppContext(config)

    try:
        yield context
    finally:
        context.close()

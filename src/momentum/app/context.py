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

    Owns the application database and all application services created
    from that database connection.

    The context is shared by all delivery mechanisms, including the CLI
    and FastAPI application. Business logic remains inside domain services;
    this class only composes their dependencies.
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

        # repository instances and database connection.
        ledger_task_repository = LedgerTaskRepository(connection)
        ledger_entry_repository = LedgerEntryRepository(connection)

        stride_journey_repository = StrideJourneyRepository(connection)
        stride_milestone_repository = StrideMilestoneRepository(connection)
        stride_progress_repository = StrideProgressRepository(connection)

        # LifeLedger services.
        self.ledger_task_service = LedgerTaskService(
            ledger_task_repository,
        )
        self.ledger_tracking_service = LedgerTrackingService(
            ledger_task_repository,
            ledger_entry_repository,
        )
        self.ledger_stats_service = LedgerStatsService(
            ledger_task_repository,
            ledger_entry_repository,
        )

        # Stride services.
        self.stride_journey_service = JourneyService(
            stride_journey_repository,
            stride_milestone_repository,
            self.database.transaction,
        )
        self.stride_milestone_service = MilestoneService(
            stride_milestone_repository,
            self.database.transaction,
        )
        self.stride_progress_service = ProgressService(
            stride_journey_repository,
            stride_milestone_repository,
            stride_progress_repository,
            self.database.transaction,
        )
        self.stride_stats_service = StrideStatsService(
            stride_journey_repository,
            stride_milestone_repository,
            stride_progress_repository,
        )
        self.stride_achievement_service = AchievementService(
            stride_journey_repository,
            stride_progress_repository,
            self.stride_stats_service,
        )
        self.stride_export_service = ExportService(
            stride_journey_repository,
            stride_milestone_repository,
            stride_progress_repository,
        )

        # Cross-domain application service.
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

"""Shared pytest fixtures for Momentum tests."""

from __future__ import annotations

from collections.abc import Callable, Generator
from datetime import date
from pathlib import Path

import pytest

from momentum.app.context import AppContext
from momentum.config import AppConfig
from momentum.ledger.domain.models import Task
from momentum.ledger.repositories.entry_repository import EntryRepository
from momentum.ledger.repositories.task_repository import TaskRepository
from momentum.ledger.services.stats_service import StatsService
from momentum.ledger.services.task_service import TaskService
from momentum.ledger.services.tracking_service import TrackingService
from momentum.storage.database import Database
from momentum.stride.domain.enums import TrackingMethod
from momentum.stride.domain.models import Journey
from momentum.stride.repositories.journey_repository import JourneyRepository
from momentum.stride.repositories.milestone_repository import MilestoneRepository
from momentum.stride.repositories.progress_repository import ProgressRepository

# ── Database ──────────────────────────────────────────────────────────────────


@pytest.fixture
def isolated_db(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> Generator[Path, None, None]:
    """Run a CLI test against an isolated temporary Momentum data directory."""
    monkeypatch.setenv("MOMENTUM_DATA_DIR", str(tmp_path))
    yield tmp_path


@pytest.fixture
def db(tmp_path: Path) -> Generator[Database, None, None]:
    """Provide a temporary Momentum database."""
    database = Database(tmp_path / "test.db")
    database.connect()

    try:
        yield database
    finally:
        database.close()


@pytest.fixture
def context(
    db: Database,
    tmp_path: Path,
) -> Generator[AppContext, None, None]:
    """Provide an application context backed by the test database."""
    config = AppConfig(
        data_dir=tmp_path,
        db_path=tmp_path / "test.db",
    )

    context = AppContext(
        config,
        database=db,
    )

    yield context


# ── Ledger repositories ───────────────────────────────────────────────────────


@pytest.fixture
def task_repo(
    db: Database,
) -> TaskRepository:
    """Provide a task repository backed by the test database."""
    return TaskRepository(db.conn)


@pytest.fixture
def entry_repo(
    db: Database,
) -> EntryRepository:
    """Provide an entry repository backed by the test database."""
    return EntryRepository(db.conn)


# ── Ledger services ───────────────────────────────────────────────────────────


@pytest.fixture
def task_svc(
    db: Database,
) -> TaskService:
    """Provide a task service backed by the test database."""
    return TaskService(
        TaskRepository(db.conn),
    )


@pytest.fixture
def tracking_svc(
    db: Database,
) -> TrackingService:
    """Provide a tracking service backed by the test database."""
    return TrackingService(
        TaskRepository(db.conn),
        EntryRepository(db.conn),
    )


@pytest.fixture
def stats_svc(
    db: Database,
) -> StatsService:
    """Provide a statistics service backed by the test database."""
    return StatsService(
        TaskRepository(db.conn),
        EntryRepository(db.conn),
    )


# ── Ledger test data ──────────────────────────────────────────────────────────


@pytest.fixture
def create_task(
    task_svc: TaskService,
) -> Callable[[str, str], Task]:
    """Create a task with arbitrary test-specific data."""

    def factory(name: str, cutoff_message: str) -> Task:
        return task_svc.create_task(name, cutoff_message)

    return factory


@pytest.fixture
def exercise_task(
    task_svc: TaskService,
) -> Task:
    """Provide a standard exercise task for tests."""
    return task_svc.create_task(
        "Exercise",
        "At least 30 minutes of physical activity",
    )


@pytest.fixture
def learning_task(
    task_svc: TaskService,
) -> Task:
    """Provide a standard learning task for tests."""
    return task_svc.create_task(
        "Learning",
        "At least 45 minutes of focused learning",
    )


# ── Stride repositories ───────────────────────────────────────────────────────


@pytest.fixture
def journey_repo(
    db: Database,
) -> JourneyRepository:
    """Provide a journey repository backed by the test database."""
    return JourneyRepository(db.conn)


@pytest.fixture
def milestone_repo(
    db: Database,
) -> MilestoneRepository:
    """Provide a milestone repository backed by the test database."""
    return MilestoneRepository(db.conn)


@pytest.fixture
def progress_repo(
    db: Database,
) -> ProgressRepository:
    """Provide a progress repository backed by the test database."""
    return ProgressRepository(db.conn)


# ── Stride test data ──────────────────────────────────────────────────────────


@pytest.fixture
def running_journey(
    journey_repo: JourneyRepository,
) -> Journey:
    """Provide a standard running journey for tests."""
    return journey_repo.create(
        name="Running",
        description="Running journey",
        tracking_method=TrackingMethod.QUANTITY,
        target_value=1000,
        unit="km",
        start_date=date(2026, 1, 1),
        target_date=date(2026, 12, 31),
    )


@pytest.fixture
def gym_journey(
    journey_repo: JourneyRepository,
) -> Journey:
    """Provide a standard gym journey for tests."""
    return journey_repo.create(
        name="Gym",
        description="Gym journey",
        tracking_method=TrackingMethod.COUNT,
        target_value=200,
        unit="days",
        start_date=date(2026, 1, 1),
    )


@pytest.fixture
def study_journey(
    journey_repo: JourneyRepository,
) -> Journey:
    """Provide a standard study journey for tests."""
    return journey_repo.create(
        name="Study",
        description="Study journey",
        tracking_method=TrackingMethod.DURATION,
        target_value=100,
        unit="hours",
        start_date=date(2026, 1, 1),
    )


@pytest.fixture
def milestone_journey(
    journey_repo: JourneyRepository,
) -> Journey:
    """Provide a standard milestone-based journey for tests."""
    return journey_repo.create(
        name="Learning",
        description="Learning journey",
        tracking_method=TrackingMethod.MILESTONE,
        target_value=3,
        unit=None,
        start_date=date(2026, 1, 1),
    )

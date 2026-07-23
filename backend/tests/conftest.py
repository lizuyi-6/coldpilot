"""Test configuration and fixtures.

Each test gets an isolated temp-file SQLite database. The default ``Database``
singleton is overridden via ``set_database`` so both the HTTP layer and the
worker see the same isolated store. Lifespan is NOT used by the ASGI transport,
so tests own DB / worker lifecycle explicitly.
"""

from __future__ import annotations

import os
import sys
from collections.abc import AsyncIterator
from pathlib import Path

import pytest_asyncio
from httpx import ASGITransport, AsyncClient

# Ensure backend/ is importable as the project root when running pytest from it.
BACKEND_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_ROOT))

# Force deterministic agent + isolated data dir for the whole test session.
os.environ.setdefault("AGENT_MODE", "deterministic")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///./data/coldpilot-test.db")

from app.infrastructure.db.session import Database, set_database  # noqa: E402
from app.infrastructure.tasks.runtime import get_worker, reset_worker  # noqa: E402


@pytest_asyncio.fixture
async def db(tmp_path: Path) -> AsyncIterator[Database]:
    """Fresh isolated database (temp file) per test."""
    db_file = tmp_path / "coldpilot.db"
    database = Database(database_url=f"sqlite+aiosqlite:///{db_file}")
    set_database(database)
    # Ensure schema exists once models are defined (B1+). Safe no-op in B0.
    await _ensure_schema(database)
    try:
        yield database
    finally:
        await database.dispose()


async def _ensure_schema(database: Database) -> None:
    """Create tables from metadata (used until Alembic migrations are run in tests)."""
    from app.infrastructure.db.models import Base  # noqa: E402

    async with database.engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


@pytest_asyncio.fixture
async def worker():
    """Fresh worker (no handlers unless a test registers them)."""
    reset_worker()
    w = get_worker()
    yield w
    await w.stop()


@pytest_asyncio.fixture
async def client(db, worker) -> AsyncIterator[AsyncClient]:  # noqa: ANN001
    """HTTP client bound to the isolated DB + a fresh worker."""
    from app.main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac

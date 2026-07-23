"""Async database engine and session management (SQLAlchemy 2.0 + aiosqlite)."""

from __future__ import annotations

from collections.abc import AsyncIterator

from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import get_settings


def _build_engine(database_url: str):
    engine = create_async_engine(
        database_url,
        echo=False,
        future=True,
        # SQLite needs a single connection context for PRAGMAs applied via listener.
        connect_args={"check_same_thread": False},
    )

    @event.listens_for(engine.sync_engine, "connect")
    def _set_sqlite_pragmas(dbapi_connection, connection_record):  # noqa: ANN001
        # Enable WAL, enforce FK constraints, and tolerate brief write locks.
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA busy_timeout=5000")
        cursor.close()

    return engine


class Database:
    """Owns the async engine + session factory.

    Kept as a small class (not a module global) so tests can build isolated
    in-memory/per-file databases and the lifespan can manage teardown cleanly.
    """

    def __init__(self, database_url: str | None = None) -> None:
        settings = get_settings()
        self.database_url = database_url or settings.database_url
        self.engine = _build_engine(self.database_url)
        self.session_factory: async_sessionmaker[AsyncSession] = async_sessionmaker(
            self.engine,
            expire_on_commit=False,
            class_=AsyncSession,
        )

    async def dispose(self) -> None:
        await self.engine.dispose()

    def session(self) -> AsyncSession:
        return self.session_factory()

    async def session_scope(self) -> AsyncIterator[AsyncSession]:
        """Context-managed session. Use as: ``async with db.session_scope() as s:``."""
        async with self.session_factory() as session:
            yield session


# Default process-wide instance, built lazily from settings.
_default_db: Database | None = None


def get_database() -> Database:
    global _default_db
    if _default_db is None:
        _default_db = Database()
    return _default_db


def set_database(database: Database) -> None:
    """Inject a Database instance (used by tests for isolation)."""
    global _default_db
    _default_db = database


async def get_session() -> AsyncIterator[AsyncSession]:
    """FastAPI dependency yielding a session."""
    db = get_database()
    async with db.session_factory() as session:
        yield session

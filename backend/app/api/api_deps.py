"""Shared FastAPI dependencies."""

from __future__ import annotations

from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.db.session import get_database


async def get_session() -> AsyncIterator[AsyncSession]:
    db = get_database()
    async with db.session_factory() as session:
        yield session

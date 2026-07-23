"""SQLAlchemy ORM models.

The declarative :class:`Base` is defined here and all models register against it.
Concrete tables are added in B1. Tests create the schema from this metadata;
production uses Alembic migrations.
"""

from __future__ import annotations

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Declarative base for all ORM models."""

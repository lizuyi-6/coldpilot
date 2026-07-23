"""Worker runtime: owns the process-wide :class:`TaskWorker` singleton."""

from __future__ import annotations

from app.infrastructure.tasks.worker import TaskWorker

_worker: TaskWorker | None = None


def get_worker() -> TaskWorker:
    global _worker
    if _worker is None:
        _worker = TaskWorker()
    return _worker


def reset_worker() -> None:
    """Test helper: drop the cached worker so a fresh one is built next time."""
    global _worker
    _worker = None

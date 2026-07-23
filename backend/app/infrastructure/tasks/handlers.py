"""Register task handlers onto the worker.

This module is intentionally the single place where concrete handlers are
wired in, so ``main.py`` never changes as phases add handlers. Handlers are
added in B3 (diagnosis) and B6 (execution).
"""

from __future__ import annotations

from app.infrastructure.tasks.worker import TaskWorker


def register_all(worker: TaskWorker) -> None:
    """Register all available task handlers. Populated in later build phases."""
    # B3 will register the diagnosis handler here.
    # B6 will register the execution handler here.

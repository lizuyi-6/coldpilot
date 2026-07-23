"""Register task handlers onto the worker.

Single place where concrete handlers are wired, so ``main.py`` never changes as
phases add handlers.
"""

from __future__ import annotations

from app.application.diagnosis import DiagnosisHandler
from app.application.execution import ExecutionHandler
from app.infrastructure.tasks.worker import TaskWorker
from app.infrastructure.tools.tools import build_tool_registry


def register_all(worker: TaskWorker) -> None:
    """Register all available task handlers."""
    registry = build_tool_registry()
    worker.add_handler(DiagnosisHandler(registry))
    worker.add_handler(ExecutionHandler())

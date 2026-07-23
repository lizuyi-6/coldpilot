"""In-process asyncio task worker.

Design constraints (per project decisions):
- NO FastAPI BackgroundTasks for the core persistence system.
- Single process, single worker, managed by FastAPI lifespan.
- ``queued`` tasks are recovered after a restart.
- ``running`` tasks older than the stale timeout are reset to ``queued`` (or
  failed) so no task is ever stuck in ``running`` forever.

The worker itself is generic: it owns only the lifecycle (start/stop/loop) and
delegates actual claiming/processing/recovery to registered :class:`TaskHandler`
implementations. Concrete handlers are added in B3 (diagnosis) and B6 (execution).
"""

from __future__ import annotations

import asyncio

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.infrastructure.db.session import get_database
from app.infrastructure.logging import get_logger

log = get_logger(__name__)


class TaskHandler:
    """Base class for a task-type handler. Subclasses override the methods."""

    name: str = "handler"

    async def recover_stale(self, session: AsyncSession, stale_timeout_seconds: float) -> int:
        """Reset/finish stale ``running`` tasks for this handler's task type.

        Returns the number of tasks affected. Default: no-op.
        """
        return 0

    async def claim_and_process(self, session: AsyncSession) -> int:
        """Claim one ``queued`` task and advance it. Returns number processed.

        Returning 0 means nothing was claimable this tick.
        """
        return 0


class TaskWorker:
    """Runs a single async loop that recovers stale tasks and processes queued ones."""

    def __init__(
        self,
        handlers: list[TaskHandler] | None = None,
        poll_interval: float | None = None,
    ) -> None:
        settings = get_settings()
        self.handlers = handlers or []
        self.poll_interval = poll_interval if poll_interval is not None else settings.worker_poll_interval_seconds
        self.stale_timeout = settings.worker_stale_running_timeout_seconds
        self._task: asyncio.Task | None = None
        self._stop_event = asyncio.Event()

    def add_handler(self, handler: TaskHandler) -> None:
        self.handlers.append(handler)

    async def _tick(self) -> None:
        db = get_database()
        async with db.session_factory() as session:
            # Recover stale tasks first (e.g. after a crash/restart).
            for handler in self.handlers:
                try:
                    affected = await handler.recover_stale(session, self.stale_timeout)
                    if affected:
                        log.info("worker.recovered_stale", handler=handler.name, count=affected)
                except Exception:  # noqa: BLE001
                    log.exception("worker.recover_failed", handler=handler.name)
                    await session.rollback()
                    continue

            # Process at most ONE step per handler per tick. This yields genuine
            # progressive reveal (one tool/observation per poll interval) and keeps
            # a single worker fair across task types.
            for handler in self.handlers:
                try:
                    await handler.claim_and_process(session)
                except Exception:  # noqa: BLE001
                    log.exception("worker.process_failed", handler=handler.name)
                    await session.rollback()

    async def _run(self) -> None:
        log.info("worker.started", handlers=[h.name for h in self.handlers])
        while not self._stop_event.is_set():
            try:
                await self._tick()
            except Exception:  # noqa: BLE001
                log.exception("worker.tick_failed")
            try:
                await asyncio.wait_for(self._stop_event.wait(), timeout=self.poll_interval)
            except TimeoutError:
                pass
        log.info("worker.stopped")

    def start(self) -> None:
        if self._task is None or self._task.done():
            self._stop_event.clear()
            self._task = asyncio.create_task(self._run(), name="coldpilot-task-worker")

    async def stop(self, timeout: float = 10.0) -> None:
        self._stop_event.set()
        if self._task is not None:
            try:
                await asyncio.wait_for(self._task, timeout=timeout)
            except TimeoutError:
                self._task.cancel()
            self._task = None

    async def run_once(self) -> None:
        """Process a single tick (used by tests to drive the worker deterministically)."""
        await self._tick()

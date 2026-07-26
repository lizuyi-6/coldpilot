"""Process-local keyed locks for atomic application-service operations.

ColdPilot intentionally runs as one FastAPI process with one in-process task
worker. Within that deployment boundary, concurrent requests still execute in
separate asyncio tasks. These keyed locks make each idempotency check and its
commit one critical section without serializing unrelated business resources.
"""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from weakref import WeakKeyDictionary

_locks_by_event_loop: WeakKeyDictionary[
    asyncio.AbstractEventLoop,
    dict[str, asyncio.Lock],
] = WeakKeyDictionary()


def _get_operation_lock(operation_key: str) -> asyncio.Lock:
    """Return the stable lock for one operation key in the current event loop."""
    event_loop = asyncio.get_running_loop()
    event_loop_locks = _locks_by_event_loop.setdefault(event_loop, {})
    operation_lock = event_loop_locks.get(operation_key)
    if operation_lock is None:
        operation_lock = asyncio.Lock()
        event_loop_locks[operation_key] = operation_lock
    return operation_lock


@asynccontextmanager
async def acquire_operation_lock(
    operation_key: str,
) -> AsyncIterator[None]:
    """Serialize one check-and-commit sequence for a shared business resource."""
    operation_lock = _get_operation_lock(operation_key)
    async with operation_lock:
        yield

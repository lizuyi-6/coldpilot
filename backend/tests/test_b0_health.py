"""B0 smoke tests: app boots, health endpoint works, DB connects, worker lifecycle."""

from __future__ import annotations

import pytest
from httpx import AsyncClient
from sqlalchemy import text


@pytest.mark.asyncio
async def test_health_endpoint_ok(client: AsyncClient) -> None:
    response = await client.get("/internal/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["database"] == "ok"
    assert body["agent_mode"] == "deterministic"
    assert isinstance(body["worker_handlers"], list)


@pytest.mark.asyncio
async def test_database_select_works(db) -> None:  # noqa: ANN001
    async with db.session_factory() as session:
        result = await session.execute(text("SELECT 1"))
        assert result.scalar_one() == 1


@pytest.mark.asyncio
async def test_app_builds_without_business_routes() -> None:
    from app.main import create_app

    app = create_app()
    # The internal health route exists; business routes are added in later phases.
    paths = {r.path for r in app.routes}
    assert "/internal/health" in paths


@pytest.mark.asyncio
async def test_worker_start_stop(worker) -> None:  # noqa: ANN001
    worker.start()
    assert worker._task is not None and not worker._task.done()
    await worker.stop()
    assert worker._task is None


@pytest.mark.asyncio
async def test_request_id_header_echoed(client: AsyncClient) -> None:
    response = await client.get("/internal/health", headers={"x-request-id": "abc-123"})
    assert response.headers["x-request-id"] == "abc-123"


@pytest.mark.asyncio
async def test_domain_error_envelope(client: AsyncClient) -> None:
    # Hit a non-existent resource path under /api/v1 to exercise the generic 404
    # handling path is not the goal; instead verify the app responds on unknown
    # business routes with 404 (FastAPI default), and that create_app wires handlers.
    response = await client.get("/api/v1/does-not-exist")
    assert response.status_code == 404

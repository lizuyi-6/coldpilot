"""FastAPI application entrypoint.

Lifespan owns the single asyncio worker (start/stop). Routes are registered in
phase-specific modules under ``app.api`` and mounted here. The 13 business
endpoints live under ``/api/v1``; an internal health endpoint lives at
``/internal/health`` (not part of the frozen contract).
"""

from __future__ import annotations

import uuid
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.api.errors import install_exception_handlers
from app.config import get_settings
from app.infrastructure.db.session import get_database
from app.infrastructure.logging import configure_logging, get_logger
from app.infrastructure.tasks.handlers import register_all
from app.infrastructure.tasks.runtime import get_worker

log = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    configure_logging(json_logs=True, level="INFO")
    log.info("app.starting", app=settings.app_name, agent_mode=settings.agent_mode)

    # Ensure the default database is initialized.
    db = get_database()

    # Seed demo data on first start (idempotent). Tables must already exist
    # (created via `alembic upgrade head`); seeding failures are non-fatal.
    try:
        from app.seed.demo_data import seed_database  # noqa: PLC0415

        async with db.session_factory() as session:
            await seed_database(session)
    except Exception:  # noqa: BLE001
        log.exception("app.seed_failed")

    # Build + register the single worker, then start it.
    worker = get_worker()
    register_all(worker)
    worker.start()

    try:
        yield
    finally:
        log.info("app.stopping")
        await worker.stop()
        await db.dispose()
        log.info("app.stopped")


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="ColdPilot Backend",
        version="0.1.0",
        lifespan=lifespan,
        # The frozen contract is the SSOT; FastAPI's auto-generated OpenAPI is
        # only an implementation artifact and is deliberately not served as the
        # authoritative contract.
        openapi_url="/internal/openapi.json",
        docs_url="/internal/docs",
        redoc_url=None,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def request_id_middleware(request: Request, call_next):  # noqa: ANN001, ANN202
        request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers["x-request-id"] = request_id
        return response

    # --- Internal health (NOT one of the 13 business endpoints) ---
    @app.get("/internal/health", tags=["internal"])
    async def health() -> dict[str, object]:
        db = get_database()
        db_ok = True
        try:
            async with db.session_factory() as session:
                await session.execute(text("SELECT 1"))
        except Exception:  # noqa: BLE001
            db_ok = False
        worker = get_worker()
        return {
            "status": "ok" if db_ok else "degraded",
            "database": "ok" if db_ok else "error",
            "worker_handlers": [h.name for h in worker.handlers],
            "agent_mode": settings.agent_mode,
        }

    # --- Business routers (mounted under /api/v1) ---
    # Routers are registered lazily to avoid import cycles; each phase adds its
    # own. They all share the /api/v1 prefix.
    _register_routers(app)
    install_exception_handlers(app)

    return app


def _register_routers(app: FastAPI) -> None:
    """Mount business routers. Safe to call before routers exist (B0)."""
    from app.api.routes import router as root_router  # noqa: PLC0415

    app.include_router(root_router, prefix="/api/v1")


app = create_app()

"""Business route aggregator.

All 13 contract endpoints are mounted under ``/api/v1`` (the prefix is applied
in ``app.main``). Phase-specific routers are included here as they are built.
"""

from __future__ import annotations

from fastapi import APIRouter

from app.api.anomaly_events import router as anomaly_router
from app.api.diagnosis import router as diagnosis_router

router = APIRouter()
router.include_router(anomaly_router)
router.include_router(diagnosis_router)

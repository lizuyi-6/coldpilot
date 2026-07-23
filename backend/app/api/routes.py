"""Business route aggregator.

All 13 contract endpoints are mounted under ``/api/v1`` (the prefix is applied
in ``app.main``). Phase-specific routers are included here as they are built.
"""

from __future__ import annotations

from fastapi import APIRouter

router = APIRouter()

# Phase routers are included here as they are implemented:
# B2: anomaly events, control plans (read), reports, security audit
# B3: diagnosis / agent tasks
# B4: simulation
# B5: approvals
# B6: executions

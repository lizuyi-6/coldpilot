"""Control plan routes (simulation). Implements: runSimulation."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.api_deps import get_session
from app.api.schemas import SimulationResult
from app.application import simulation

router = APIRouter()


@router.post("/control-plans/{planId}/simulation", response_model=SimulationResult)
async def run_simulation(
    planId: str, session: AsyncSession = Depends(get_session)
) -> SimulationResult:
    return await simulation.run_simulation(session, planId)

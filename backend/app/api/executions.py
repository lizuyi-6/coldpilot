"""Execution routes. Implements: startExecution, getExecutionTask."""

from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.api_deps import get_session
from app.api.schemas import ExecutionTask
from app.application import execution

router = APIRouter()


@router.post(
    "/control-plans/{planId}/execution",
    response_model=ExecutionTask,
    status_code=status.HTTP_202_ACCEPTED,
)
async def start_execution(
    planId: str, session: AsyncSession = Depends(get_session)
) -> ExecutionTask:
    return await execution.start_execution(session, planId)


@router.get("/execution-tasks/{taskId}", response_model=ExecutionTask)
async def get_execution_task(
    taskId: str, session: AsyncSession = Depends(get_session)
) -> ExecutionTask:
    return await execution.get_execution_task(session, taskId)

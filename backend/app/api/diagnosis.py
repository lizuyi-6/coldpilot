"""Diagnosis / agent task routes.

Implements 3 of the 13 contract endpoints (operationIds):
  startDiagnosis, getAgentTask, getDiagnosisResult
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.api_deps import get_session
from app.api.schemas import AgentTask, DiagnosisResult
from app.application import diagnosis

router = APIRouter()


@router.post(
    "/anomaly-events/{eventId}/diagnosis",
    response_model=AgentTask,
    status_code=status.HTTP_202_ACCEPTED,
)
async def start_diagnosis(
    eventId: str, session: AsyncSession = Depends(get_session)
) -> AgentTask:
    return await diagnosis.start_diagnosis(session, eventId)


@router.get("/agent-tasks/{taskId}", response_model=AgentTask)
async def get_agent_task(
    taskId: str, session: AsyncSession = Depends(get_session)
) -> AgentTask:
    return await diagnosis.get_agent_task(session, taskId)


@router.get("/agent-tasks/{taskId}/diagnosis-result", response_model=DiagnosisResult)
async def get_diagnosis_result(
    taskId: str, session: AsyncSession = Depends(get_session)
) -> DiagnosisResult:
    return await diagnosis.get_diagnosis_result(session, taskId)

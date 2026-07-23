"""Anomaly event read routes: list, detail, control plans, report, security audit.

Implements 5 of the 13 contract endpoints (operationIds):
  listAnomalyEvents, getAnomalyEvent, listControlPlans, getEventReport,
  listSecurityAuditEntries
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.api_deps import get_session
from app.api.schemas import (
    AnomalyEventDetail,
    AnomalyEventSummary,
    ControlPlan,
    EventReport,
    SecurityAuditEntry,
)
from app.application import queries

router = APIRouter()


@router.get("/anomaly-events", response_model=list[AnomalyEventSummary])
async def list_anomaly_events(
    session: AsyncSession = Depends(get_session),
) -> list[AnomalyEventSummary]:
    return await queries.list_anomaly_events(session)


@router.get("/anomaly-events/{eventId}", response_model=AnomalyEventDetail)
async def get_anomaly_event(
    eventId: str, session: AsyncSession = Depends(get_session)
) -> AnomalyEventDetail:
    return await queries.get_anomaly_event(session, eventId)


@router.get(
    "/anomaly-events/{eventId}/control-plans", response_model=list[ControlPlan]
)
async def list_control_plans(
    eventId: str, session: AsyncSession = Depends(get_session)
) -> list[ControlPlan]:
    return await queries.list_control_plans(session, eventId)


@router.get("/anomaly-events/{eventId}/report", response_model=EventReport)
async def get_event_report(
    eventId: str, session: AsyncSession = Depends(get_session)
) -> EventReport:
    return await queries.get_event_report(session, eventId)


@router.get(
    "/anomaly-events/{eventId}/security-audit",
    response_model=list[SecurityAuditEntry],
)
async def list_security_audit_entries(
    eventId: str, session: AsyncSession = Depends(get_session)
) -> list[SecurityAuditEntry]:
    return await queries.list_security_audit(session, eventId)

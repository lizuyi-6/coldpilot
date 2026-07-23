"""Read-side query services (application layer).

Thin async functions over AsyncSession that return contract schemas. They
compute derived fields and enforce read-only access. Write/mutation services
live in their phase-specific modules (B3+).
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api import mappers
from app.api.errors import not_found
from app.api.schemas import (
    AnomalyEventDetail,
    AnomalyEventSummary,
    ControlPlan,
    EventReport,
    SecurityAuditEntry,
)
from app.infrastructure.audit.repository import SecurityAuditRepository
from app.infrastructure.db.models import (
    AnomalyEvent,
    ColdRoom,
    ControlPlanVersion,
)
from app.infrastructure.db.models import (
    ControlPlan as ControlPlanModel,
)
from app.infrastructure.db.models import (
    EventReport as EventReportModel,
)


async def list_anomaly_events(session: AsyncSession) -> list[AnomalyEventSummary]:
    result = await session.execute(
        select(AnomalyEvent)
        .options(selectinload(AnomalyEvent.room))
        .order_by(AnomalyEvent.started_at)
    )
    events = result.scalars().all()
    return [mappers.map_event_summary(e, e.room.name) for e in events]


async def get_anomaly_event(session: AsyncSession, event_id: str) -> AnomalyEventDetail:
    result = await session.execute(
        select(AnomalyEvent)
        .where(AnomalyEvent.id == event_id)
        .options(
            selectinload(AnomalyEvent.room).selectinload(ColdRoom.devices),
            selectinload(AnomalyEvent.room).selectinload(ColdRoom.sensors),
            selectinload(AnomalyEvent.room).selectinload(ColdRoom.inventory),
            selectinload(AnomalyEvent.room).selectinload(ColdRoom.telemetry),
            selectinload(AnomalyEvent.room).selectinload(ColdRoom.room_events),
        )
    )
    event = result.scalar_one_or_none()
    if event is None:
        raise not_found(f"未找到异常事件 {event_id}")
    return mappers.map_event_detail(event)


async def list_control_plans(session: AsyncSession, event_id: str) -> list[ControlPlan]:
    event = await session.get(AnomalyEvent, event_id)
    if event is None:
        raise not_found(f"未找到异常事件 {event_id}")

    plan_rows = (
        await session.execute(
            select(ControlPlanModel)
            .where(ControlPlanModel.event_id == event_id)
            .order_by(ControlPlanModel.kind, ControlPlanModel.id)
        )
    ).scalars().all()

    plans: list[ControlPlan] = []
    for plan in plan_rows:
        version = (
            await session.execute(
                select(ControlPlanVersion)
                .where(
                    ControlPlanVersion.plan_id == plan.id,
                    ControlPlanVersion.version == plan.current_version,
                )
            )
        ).scalar_one_or_none()
        if version is None:
            continue
        plans.append(mappers.map_control_plan(plan, version))
    return plans


async def get_event_report(session: AsyncSession, event_id: str) -> EventReport:
    event = await session.get(AnomalyEvent, event_id)
    if event is None:
        raise not_found(f"未找到异常事件 {event_id}")
    report = (
        await session.execute(
            select(EventReportModel).where(EventReportModel.event_id == event_id)
        )
    ).scalar_one_or_none()
    if report is None:
        raise not_found(f"事件 {event_id} 尚无报告")
    return mappers.map_event_report(report)


async def list_security_audit(
    session: AsyncSession, event_id: str
) -> list[SecurityAuditEntry]:
    event = await session.get(AnomalyEvent, event_id)
    if event is None:
        raise not_found(f"未找到异常事件 {event_id}")
    repo = SecurityAuditRepository(session)
    entries = await repo.list_for_event(event_id)
    return [mappers.map_security_audit(e) for e in entries]

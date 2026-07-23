"""Approval application service (L2) + L3 interception.

- request_approval: requires simulated L2 plan; binds planId+planVersion; runs
  the 5 deterministic safety checks; idempotent while a request is pending.
- submit_approval: server-injected demo actor (frontend approverId is NOT
  trusted); idempotent for the same decision, 409 for a conflicting one.
- record_l3_block: an L3 action is intercepted by the safety rule engine and
  produces ONLY a SecurityAuditEntry (no plan / approval / command / execution).
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import mappers
from app.api.errors import conflict, forbidden, invalid_state, not_found
from app.api.schemas import ApprovalRequest as ApprovalRequestSchema
from app.api.schemas import ApprovalResult as ApprovalResultSchema
from app.config import get_settings
from app.domain.constants import can_transition
from app.domain.safety import classify_action, evaluate_l2
from app.infrastructure.audit.repository import SecurityAuditRepository
from app.infrastructure.db.models import (
    AnomalyEvent,
    ApprovalRequest,
    ColdRoom,
    ControlPlan,
    ControlPlanVersion,
    SimulationResult,
)
from app.infrastructure.logging import get_logger

log = get_logger(__name__)


def _checks_to_json(checks) -> list[dict]:  # noqa: ANN001
    return [{"key": c.key, "label": c.label, "passed": c.passed, "detail": c.detail} for c in checks]


async def request_approval(session: AsyncSession, plan_id: str) -> ApprovalRequestSchema:
    plan = await session.get(ControlPlan, plan_id)
    if plan is None:
        raise not_found(f"未找到方案 {plan_id}")

    version = (
        await session.execute(
            select(ControlPlanVersion).where(
                ControlPlanVersion.plan_id == plan_id,
                ControlPlanVersion.version == plan.current_version,
            )
        )
    ).scalar_one_or_none()
    if version is None:
        raise not_found(f"未找到方案版本（方案 {plan_id}）")

    event = await session.get(AnomalyEvent, plan.event_id)
    if event is None:
        raise not_found(f"未找到事件（方案 {plan_id}）")

    # L3 never becomes an approval target. (Plans are L2-only by contract, but
    # guard anyway: any L3-classified intent is intercepted here.)
    if plan.approval_level != "L2":
        raise forbidden("该方案不属于可审批的 L2 操作")

    # Must have a successful simulation for this plan+version.
    sim = (
        await session.execute(
            select(SimulationResult).where(
                SimulationResult.plan_id == plan_id,
                SimulationResult.plan_version == version.version,
            )
        )
    ).scalar_one_or_none()
    if sim is None:
        raise invalid_state("未完成仿真不得申请审批", plan_id=plan_id)

    # Idempotency: a pending request for the same plan+version is returned as-is.
    pending = (
        await session.execute(
            select(ApprovalRequest).where(
                ApprovalRequest.plan_id == plan_id,
                ApprovalRequest.plan_version == version.version,
                ApprovalRequest.status == "pending",
            )
        )
    ).scalar_one_or_none()
    if pending is not None:
        return mappers.map_approval_request(pending)

    if not can_transition(event.stage, "awaitingApproval"):
        raise invalid_state(
            f"当前阶段 {event.stage} 不允许申请审批", current_stage=event.stage
        )

    room = (
        await session.execute(select(ColdRoom).where(ColdRoom.id == event.room_id))
    ).scalar_one()
    safety = room.safety_params or {}
    checks = evaluate_l2(
        version.params or [],
        min_temp_c=float(safety.get("minTempC", 5)),
        max_temp_c=float(safety.get("maxTempC", 12)),
    )

    request = ApprovalRequest(
        id=f"apr-{uuid.uuid4().hex[:10]}",
        plan_id=plan_id,
        plan_version=version.version,
        level="L2",
        safety_checks=_checks_to_json(checks),
        status="pending",
    )
    session.add(request)
    event.stage = "awaitingApproval"
    await session.commit()
    log.info("approval.requested", plan_id=plan_id, version=version.version)
    return mappers.map_approval_request(request)


async def submit_approval(
    session: AsyncSession, request_id: str, decision: str, reason: str | None
) -> ApprovalResultSchema:
    request = await session.get(ApprovalRequest, request_id)
    if request is None:
        raise not_found(f"未找到审批请求 {request_id}")

    # Server-injected identity only; the frontend's approverId is ignored.
    actor = get_settings().demo_actor

    if request.status != "pending":
        # Idempotent: same decision by the same actor -> return existing.
        if request.status == decision and request.decided_by == actor.display_name:
            return mappers.map_approval_result(request)
        raise conflict("该审批请求已被处理", existing_decision=request.status)

    # Resolve the event via the plan (the request row has no event_id column).
    plan = await session.get(ControlPlan, request.plan_id)
    if plan is None:
        raise not_found("关联方案不存在")
    event = await session.get(AnomalyEvent, plan.event_id)
    if event is None:
        raise not_found("关联事件不存在")

    now = datetime.now(UTC)
    request.status = decision
    request.decided_by = actor.display_name
    request.decided_at = now
    request.reason = reason

    if decision == "approved":
        if not can_transition(event.stage, "approved"):
            raise invalid_state(f"当前阶段 {event.stage} 不允许批准", current_stage=event.stage)
        event.stage = "approved"
    else:  # rejected
        if not can_transition(event.stage, "rejected"):
            raise invalid_state(f"当前阶段 {event.stage} 不允许驳回", current_stage=event.stage)
        event.stage = "rejected"

    await session.commit()
    log.info("approval.decided", request_id=request_id, decision=decision, actor=actor.actor_id)
    return mappers.map_approval_result(request)


async def record_l3_block(
    session: AsyncSession,
    *,
    event_id: str,
    action: str,
    source: str = "agent",
) -> None:
    """Intercept an L3 action: write ONLY a security audit entry.

    Produces no ControlPlan / ApprovalRequest / ControlCommand / ExecutionTask.
    """
    if classify_action(action) != "L3":
        return
    repo = SecurityAuditRepository(session)
    await repo.append(
        event_id=event_id,
        category="blocked_action",
        action=action,
        source=source,
        approval_level="L3",
        triggered_rule="RULE-SAFETY-001 · 禁止越过设备保护范围",
        rule_version="1",
        reason="该动作试图越过 PLC 联锁与设备保护机制，属于 L3 永久禁止项",
        outcome="blocked",
    )
    await session.commit()
    log.warning("safety.l3_blocked", event_id=event_id, action=action)

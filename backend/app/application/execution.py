"""Execution + verification application service + worker handler.

- start_execution: requires an approval for the plan's CURRENT version (version
  guard); generates a structured ControlCommand once (idempotent); creates an
  execution task (async). get_execution_task polls it.
- ExecutionHandler drives the mock device adapter across ticks: executing
  (progressive observed series) -> verifying -> recovered | failed. A device
  "recovered" report still passes through verifying; execution never skips to
  recovered. Failure sets triggered_rollback + stage executionFailed.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import mappers
from app.api.errors import invalid_state, not_found
from app.api.schemas import ExecutionTask as ExecutionTaskSchema
from app.domain.constants import can_transition
from app.domain.safety import evaluate_l2, is_safe
from app.infrastructure.db.models import (
    AnomalyEvent,
    ApprovalRequest,
    ColdRoom,
    ControlCommand,
    ControlPlan,
    ControlPlanVersion,
    EventReport,
    ExecutionTask,
    SimulationResult,
)
from app.infrastructure.logging import get_logger
from app.infrastructure.tasks.worker import TaskHandler

log = get_logger(__name__)

_ACTIVE_STATUSES = ("queued", "executing", "verifying")
# Reveal ~1/EXEC_TICKS of the curve per executing tick so the whole run finishes
# in a bounded number of ticks (progressive but quick).
EXEC_TICKS = 5


def _latest_temperature_from_points(points: list[dict]) -> float | None:
    return float(points[-1]["value"]) if points else None


async def _full_curve(session: AsyncSession, plan_id: str, plan_version: int) -> list[dict]:
    sim = (
        await session.execute(
            select(SimulationResult).where(
                SimulationResult.plan_id == plan_id,
                SimulationResult.plan_version == plan_version,
            )
        )
    ).scalar_one_or_none()
    return list(sim.predicted_series) if sim else []


async def start_execution(session: AsyncSession, plan_id: str) -> ExecutionTaskSchema:
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

    # Must have an approval bound to the CURRENT version (version guard).
    approval = (
        await session.execute(
            select(ApprovalRequest)
            .where(
                ApprovalRequest.plan_id == plan_id,
                ApprovalRequest.plan_version == version.version,
                ApprovalRequest.status == "approved",
            )
            .order_by(ApprovalRequest.created_at.desc())
        )
    ).scalars().first()
    if approval is None:
        raise invalid_state("方案未批准（或审批已因方案变更失效），不能执行", plan_id=plan_id)

    # Idempotency: an execution task for this plan+version+approval already exists.
    existing_task = (
        await session.execute(
            select(ExecutionTask).where(
                ExecutionTask.plan_id == plan_id,
                ExecutionTask.plan_version == version.version,
                ExecutionTask.approval_request_id == approval.id,
            )
        )
    ).scalars().first()
    if existing_task is not None:
        return mappers.map_execution_task(existing_task)

    if not can_transition(event.stage, "executing"):
        raise invalid_state(f"当前阶段 {event.stage} 不允许执行", current_stage=event.stage)

    # Re-run safety at execution time (defense in depth; independent of approval).
    room = (
        await session.execute(select(ColdRoom).where(ColdRoom.id == event.room_id))
    ).scalar_one()
    safety = room.safety_params or {}
    checks = evaluate_l2(
        version.params or [],
        min_temp_c=float(safety.get("minTempC", 5)),
        max_temp_c=float(safety.get("maxTempC", 12)),
    )
    if not is_safe(checks):
        raise invalid_state("执行前安全校验未通过", failed=[c.key for c in checks if not c.passed])

    # Generate ONE structured command (idempotent via unique constraint).
    command = (
        await session.execute(
            select(ControlCommand).where(
                ControlCommand.plan_id == plan_id,
                ControlCommand.plan_version == version.version,
                ControlCommand.approval_request_id == approval.id,
            )
        )
    ).scalars().first()
    if command is None:
        command = ControlCommand(
            id=f"cmd-{uuid.uuid4().hex[:10]}",
            plan_id=plan_id,
            plan_version=version.version,
            approval_request_id=approval.id,
            payload={"params": version.params, "planVersion": version.version},
            status="sent",
        )
        session.add(command)
        await session.flush()

    task = ExecutionTask(
        id=f"exec-{uuid.uuid4().hex[:10]}",
        plan_id=plan_id,
        command_id=command.id,
        plan_version=version.version,
        approval_request_id=approval.id,
        status="queued",
        started_at=datetime.now(UTC),
        observed_series=[],
        provenance="simulated",
    )
    session.add(task)
    event.stage = "executing"
    await session.commit()
    await session.refresh(task)
    log.info("execution.started", task_id=task.id, plan_id=plan_id)
    return mappers.map_execution_task(task)


async def get_execution_task(session: AsyncSession, task_id: str) -> ExecutionTaskSchema:
    task = await session.get(ExecutionTask, task_id)
    if task is None:
        raise not_found(f"未找到执行任务 {task_id}")
    return mappers.map_execution_task(task)


# --------------------------------------------------------------------------- #
# Worker handler (mock device adapter drives the recovery curve)
# --------------------------------------------------------------------------- #


class ExecutionHandler(TaskHandler):
    name = "execution"

    async def _claim(self, session: AsyncSession) -> ExecutionTask | None:
        return (
            await session.execute(
                select(ExecutionTask)
                .where(ExecutionTask.status.in_(_ACTIVE_STATUSES))
                .order_by(ExecutionTask.created_at)
                .limit(1)
            )
        ).scalars().first()

    async def claim_and_process(self, session: AsyncSession) -> int:
        task = await self._claim(session)
        if task is None:
            return 0

        plan = await session.get(ControlPlan, task.plan_id)
        event = await session.get(AnomalyEvent, plan.event_id if plan else "")
        if plan is None or event is None:
            task.status = "failed"
            task.triggered_rollback = "关联方案/事件不存在"
            task.finished_at = datetime.now(UTC)
            await session.commit()
            return 1

        room = (
            await session.execute(select(ColdRoom).where(ColdRoom.id == event.room_id))
        ).scalar_one()

        now = datetime.now(UTC)
        if task.status == "queued":
            task.status = "executing"
            task.started_at = now
            task.last_advanced_at = now
            await session.commit()
            return 1

        if task.status == "executing":
            return await self._advance_executing(session, task, event, room, now)

        # verifying
        return await self._finalize_verifying(session, task, event, room, now)

    async def _advance_executing(self, session, task, event, room, now):  # noqa: ANN001
        full = await _full_curve(session, task.plan_id, task.plan_version)
        if not full:
            task.status = "failed"
            task.triggered_rollback = "缺少仿真曲线，已回退传统规则 / PID"
            task.finished_at = now
            if can_transition(event.stage, "executionFailed"):
                event.stage = "executionFailed"
            await session.commit()
            return 1

        revealed = len(task.observed_series)
        if revealed >= len(full):
            task.status = "verifying"
            task.last_advanced_at = now
            if can_transition(event.stage, "verifying"):
                event.stage = "verifying"
            await session.commit()
            return 1

        step = max(1, len(full) // EXEC_TICKS)
        task.observed_series = full[: revealed + step]
        task.last_advanced_at = now
        if len(task.observed_series) >= len(full):
            task.status = "verifying"
            if can_transition(event.stage, "verifying"):
                event.stage = "verifying"
        await session.commit()
        return 1

    async def _finalize_verifying(self, session, task, event, room, now):  # noqa: ANN001
        target = room.target_range or {}
        last = _latest_temperature_from_points(task.observed_series)
        sim = (
            await session.execute(
                select(SimulationResult).where(
                    SimulationResult.plan_id == task.plan_id,
                    SimulationResult.plan_version == task.plan_version,
                )
            )
        ).scalar_one_or_none()
        recovery_hours = sim.recovery_hours if sim else 0.0

        within = last is not None and target.get("min") <= last <= target.get("max")
        if within:
            task.status = "recovered"
            task.recovery_minutes = int(round(recovery_hours * 60))
            task.finished_at = now
            if can_transition(event.stage, "recovered"):
                event.stage = "recovered"
            await self._ensure_report(session, event, recovery_hours)
        else:
            task.status = "failed"
            task.triggered_rollback = "执行偏差超限，已回退传统规则 / PID"
            task.finished_at = now
            if can_transition(event.stage, "executionFailed"):
                event.stage = "executionFailed"
        await session.commit()
        log.info("execution.finalized", task_id=task.id, status=task.status)
        return 1

    async def _ensure_report(self, session, event, recovery_hours):  # noqa: ANN001
        existing = (
            await session.execute(
                select(EventReport).where(EventReport.event_id == event.id)
            )
        ).scalar_one_or_none()
        if existing is not None:
            return
        report = EventReport(
            id=f"report-{uuid.uuid4().hex[:10]}",
            event_id=event.id,
            generated_at=datetime.now(UTC),
            summary=f"{event.title} 事件已完成处置并恢复至目标区间。",
            cause_summary=[],
            tools_used=[],
            approval={"level": "L2", "decision": "已批准", "approver": "冷库管理员"},
            outcome=f"恢复用时约 {recovery_hours:.1f} 小时（仿真结果）。",
            follow_ups=[],
            provenance="demo",
        )
        session.add(report)

    async def recover_stale(self, session: AsyncSession, stale_timeout_seconds: float) -> int:
        cutoff = datetime.now(UTC) - timedelta(seconds=stale_timeout_seconds)
        stale = (
            await session.execute(
                select(ExecutionTask).where(
                    ExecutionTask.status.in_(("executing", "verifying", "queued")),
                    ExecutionTask.last_advanced_at < cutoff,
                )
            )
        ).scalars().all()
        count = 0
        for task in stale:
            task.status = "failed"
            task.triggered_rollback = "任务超时未推进，已回退传统规则 / PID"
            task.finished_at = datetime.now(UTC)
            plan = await session.get(ControlPlan, task.plan_id)
            if plan is not None:
                event = await session.get(AnomalyEvent, plan.event_id)
                if event is not None and can_transition(event.stage, "executionFailed"):
                    event.stage = "executionFailed"
            count += 1
        if count:
            await session.commit()
        return count

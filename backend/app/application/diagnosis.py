"""Diagnosis application service + worker handler.

- start_diagnosis / get_agent_task / get_diagnosis_result: contract operations.
- DiagnosisHandler (TaskHandler): drives the agent one step per worker tick for
  genuine progressive tool reveal, persists full tool IO, and synthesizes the
  structured diagnosis result on completion.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api import mappers
from app.api.errors import invalid_state, not_found
from app.api.schemas import AgentTask as AgentTaskSchema
from app.api.schemas import DiagnosisResult as DiagnosisResultSchema
from app.config import get_settings
from app.domain.agent import Agent, AgentContext, DeterministicAgent, LlmAgent
from app.domain.constants import can_transition
from app.infrastructure.db.models import (
    AgentTask,
    AnomalyEvent,
    ColdRoom,
    DiagnosisResult,
    DiagnosticCause,
    DiagnosticEvidence,
    ToolInvocation,
)
from app.infrastructure.logging import get_logger
from app.infrastructure.operation_locks import acquire_operation_lock
from app.infrastructure.tasks.worker import TaskHandler
from app.ports.tools import ToolResult

log = get_logger(__name__)

_ACTIVE_STATUSES = ("queued", "running")


# --------------------------------------------------------------------------- #
# Agent factory + context
# --------------------------------------------------------------------------- #


def build_agent() -> Agent:
    settings = get_settings()
    if settings.agent_mode == "llm" and settings.llm_configured:
        return LlmAgent(
            base_url=settings.llm_base_url or "",
            api_key=settings.llm_api_key or "",
            model=settings.llm_model or "",
            timeout=settings.llm_request_timeout_seconds,
        )
    return DeterministicAgent()


async def _build_context(session: AsyncSession, event: AnomalyEvent) -> AgentContext:
    room = (
        await session.execute(
            select(ColdRoom)
            .where(ColdRoom.id == event.room_id)
            .options(selectinload(ColdRoom.inventory))
        )
    ).scalar_one()
    # "Recent" inbound is relative to the event's own timeframe (the demo data is
    # anchored to a fixed reference time, not wall-clock now), so batches inbound
    # in the ~6h leading up to the anomaly count as heat-load contributors.
    anchor = event.started_at or datetime.now(UTC)
    cutoff = anchor - timedelta(hours=6)
    recent = [
        {
            "id": b.id,
            "category": b.category,
            "quantityKg": b.quantity_kg,
            "inboundAt": b.inbound_at.isoformat() if b.inbound_at else None,
        }
        for b in room.inventory
        if b.inbound_at and cutoff <= b.inbound_at <= anchor + timedelta(hours=1)
    ]
    return AgentContext(
        room_id=event.room_id,
        goal=f"分析 {room.name} 的异常原因，给出安全、节能的处理方向",
        event_title=event.title,
        started_at_iso=event.started_at.isoformat() if event.started_at else "",
        recent_inbound=recent,
    )


# --------------------------------------------------------------------------- #
# Contract operations
# --------------------------------------------------------------------------- #


async def start_diagnosis(session: AsyncSession, event_id: str) -> AgentTaskSchema:
    operation_key = f"diagnosis:event:{event_id}"
    async with acquire_operation_lock(operation_key):
        return await _start_diagnosis_locked(session, event_id)


async def _start_diagnosis_locked(session: AsyncSession, event_id: str) -> AgentTaskSchema:
    event = await session.get(AnomalyEvent, event_id)
    if event is None:
        raise not_found(f"未找到异常事件 {event_id}")

    # Idempotency: an active (queued/running) task exists -> return it.
    existing = (
        await session.execute(
            select(AgentTask)
            .where(AgentTask.event_id == event_id, AgentTask.status.in_(_ACTIVE_STATUSES))
            .order_by(AgentTask.created_at.desc())
        )
    ).scalars().first()

    if existing is not None:
        await session.refresh(existing, attribute_names=["tool_invocations"])
        return mappers.map_agent_task(existing)

    # Stage guard: diagnosis may start from detected / diagnosisFailed / diagnosisCompleted.
    if not can_transition(event.stage, "diagnosing"):
        raise invalid_state(
            f"当前阶段 {event.stage} 不允许发起诊断",
            current_stage=event.stage,
        )

    agent = build_agent()
    now = datetime.now(UTC)
    task = AgentTask(
        id=f"task-{uuid.uuid4().hex[:12]}",
        event_id=event_id,
        goal=f"分析 {event.title} 的原因，给出安全、节能的处理方案",
        status="queued",
        started_at=now,
        agent_mode=agent.agent_mode,
        model_id=agent.model_id,
        prompt_template_id=agent.prompt_template_id,
        prompt_template_version=agent.prompt_template_version,
        knowledge_version=agent.knowledge_version,
        tool_registry_version="1",
    )
    session.add(task)
    event.stage = "diagnosing"
    await session.commit()
    await session.refresh(task, attribute_names=["tool_invocations"])
    return mappers.map_agent_task(task)


async def get_agent_task(session: AsyncSession, task_id: str) -> AgentTaskSchema:
    task = (
        await session.execute(
            select(AgentTask)
            .where(AgentTask.id == task_id)
            .options(selectinload(AgentTask.tool_invocations))
        )
    ).scalar_one_or_none()
    if task is None:
        raise not_found(f"未找到诊断任务 {task_id}")
    return mappers.map_agent_task(task)


async def get_diagnosis_result(session: AsyncSession, task_id: str) -> DiagnosisResultSchema:
    task = await session.get(AgentTask, task_id)
    if task is None:
        raise not_found(f"未找到诊断任务 {task_id}")
    if task.status != "succeeded":
        raise invalid_state("诊断尚未完成，无法读取诊断结果", status=task.status)
    result = (
        await session.execute(
            select(DiagnosisResult)
            .where(DiagnosisResult.task_id == task_id)
            .options(
                selectinload(DiagnosisResult.causes).selectinload(DiagnosticCause.evidence)
            )
        )
    ).scalar_one_or_none()
    if result is None:
        raise not_found(f"未找到诊断结果（任务 {task_id}）")
    return mappers.map_diagnosis_result(result)


# --------------------------------------------------------------------------- #
# Worker handler
# --------------------------------------------------------------------------- #


class DiagnosisHandler(TaskHandler):
    name = "diagnosis"

    def __init__(self, registry) -> None:  # noqa: ANN001
        self.registry = registry

    async def _claim(self, session: AsyncSession) -> AgentTask | None:
        task = (
            await session.execute(
                select(AgentTask)
                .where(AgentTask.status.in_(_ACTIVE_STATUSES))
                .order_by(AgentTask.created_at)
                .options(selectinload(AgentTask.tool_invocations))
                .limit(1)
            )
        ).scalars().first()
        return task

    async def claim_and_process(self, session: AsyncSession) -> int:
        task = await self._claim(session)
        if task is None:
            return 0

        event = await session.get(AnomalyEvent, task.event_id)
        if event is None:
            task.status = "failed"
            task.failure_reason = "关联事件不存在"
            task.finished_at = datetime.now(UTC)
            await session.commit()
            return 1

        if task.status == "queued":
            task.status = "running"
            task.started_at = datetime.now(UTC)
            await session.commit()

        agent = build_agent()
        context = await _build_context(session, event)
        steps = agent.plan(context)
        existing = sorted(task.tool_invocations, key=lambda t: t.seq)
        done_names = [t.name for t in existing]

        # Find the next step not yet executed.
        next_step = next((s for s in steps if s.tool_name not in done_names), None)

        if next_step is not None:
            return await self._invoke_tool(session, task, agent, context, next_step, existing)

        # All tools done -> synthesize once.
        return await self._finalize(session, task, agent, context, existing)

    async def _invoke_tool(self, session, task, agent, context, step, existing):  # noqa: ANN001
        tool = self.registry.get(step.tool_name)
        seq = len(existing)
        if tool is None:
            inv = ToolInvocation(
                id=f"tool-{uuid.uuid4().hex[:10]}",
                task_id=task.id,
                seq=seq,
                name=step.tool_name,
                label=step.tool_name,
                input_summary=step.input_summary,
                output_summary="",
                input_json=step.input_data,
                output_json={},
                status="failed",
                error_code="TOOL_NOT_FOUND",
            )
            session.add(inv)
            await session.commit()
            return 1

        result: ToolResult = await tool.run(session, step.input_data)
        inv = ToolInvocation(
            id=f"tool-{uuid.uuid4().hex[:10]}",
            task_id=task.id,
            seq=seq,
            name=tool.name,
            label=getattr(tool, "label", tool.name),
            input_summary=step.input_summary,
            output_summary=result.output_summary,
            input_json=step.input_data,
            output_json=result.output_json,
            duration_ms=result.duration_ms,
            status=result.status,
            error_code=result.error_code,
        )
        session.add(inv)
        await session.commit()
        log.info("diagnosis.tool_invoked", task_id=task.id, tool=tool.name, status=result.status)
        return 1

    async def _finalize(self, session, task, agent, context, existing):  # noqa: ANN001
        # Re-fetch tool outputs in seq order for synthesis.
        results = []
        for step in agent.plan(context):
            inv = next((t for t in existing if t.name == step.tool_name), None)
            if inv is None:
                continue
            results.append(
                (step, ToolResult(output_json=inv.output_json or {}, output_summary=inv.output_summary,
                                  status=inv.status, error_code=inv.error_code, duration_ms=inv.duration_ms))
            )

        try:
            synthesis = agent.synthesize(context, results)
        except Exception as exc:  # noqa: BLE001
            log.exception("diagnosis.synthesis_failed", task_id=task.id)
            task.status = "failed"
            task.failure_reason = f"诊断综合失败：{exc}"
            task.finished_at = datetime.now(UTC)
            event = await session.get(AnomalyEvent, task.event_id)
            if event is not None and can_transition(event.stage, "diagnosisFailed"):
                event.stage = "diagnosisFailed"
            await session.commit()
            return 1

        diagnosis = DiagnosisResult(
            id=f"dx-{uuid.uuid4().hex[:10]}",
            event_id=task.event_id,
            task_id=task.id,
            understanding=synthesis.understanding,
            data_sources=list(synthesis.data_sources),
            uncertainties=list(synthesis.uncertainties),
        )
        for i, cause in enumerate(synthesis.causes):
            dc = DiagnosticCause(
                id=f"{diagnosis.id}-c{i + 1}",
                label=cause.label,
                confidence=cause.confidence,
                triage_order=cause.triage_order,
                recommended_checks=list(cause.recommended_checks),
            )
            for j, ev in enumerate(cause.evidence):
                dc.evidence.append(
                    DiagnosticEvidence(
                        id=f"{diagnosis.id}-c{i + 1}-e{j + 1}",
                        kind=ev.kind,
                        summary=ev.summary,
                        source_ref=ev.source_ref,
                    )
                )
            diagnosis.causes.append(dc)
        session.add(diagnosis)

        task.status = "succeeded"
        task.finished_at = datetime.now(UTC)
        event = await session.get(AnomalyEvent, task.event_id)
        if event is not None and can_transition(event.stage, "diagnosisCompleted"):
            event.stage = "diagnosisCompleted"
        await session.commit()
        log.info("diagnosis.completed", task_id=task.id, causes=len(synthesis.causes))
        return 1

    async def recover_stale(self, session: AsyncSession, stale_timeout_seconds: float) -> int:
        cutoff = datetime.now(UTC) - timedelta(seconds=stale_timeout_seconds)
        stale = (
            await session.execute(
                select(AgentTask).where(
                    AgentTask.status == "running", AgentTask.started_at < cutoff
                )
            )
        ).scalars().all()
        count = 0
        for task in stale:
            # Reset to queued and discard partial tool invocations for a clean re-run.
            await session.execute(delete(ToolInvocation).where(ToolInvocation.task_id == task.id))
            task.status = "queued"
            task.started_at = None
            count += 1
        if count:
            await session.commit()
        return count


# Re-export for type hints elsewhere.
__all__ = [
    "DiagnosisHandler",
    "build_agent",
    "get_agent_task",
    "get_diagnosis_result",
    "start_diagnosis",
]

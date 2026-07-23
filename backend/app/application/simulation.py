"""Simulation application service.

Contract: ``POST /control-plans/{planId}/simulation`` is SYNCHRONOUS (200
SimulationResult). Internally it creates a simulation run record (running ->
succeeded/failed), executes the deterministic simulator in-process, and stores
an immutable result bound to (planId, planVersion). A prior successful result
for the same plan+version is reused; a failed run may be re-run.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import mappers
from app.api.errors import internal_error, invalid_state, not_found
from app.api.schemas import SimulationResult as SimulationResultSchema
from app.domain.constants import can_transition
from app.infrastructure.db.models import (
    AnomalyEvent,
    ColdRoom,
    ControlPlan,
    ControlPlanVersion,
    SimulationResult,
    SimulationRun,
    TelemetrySeries,
)
from app.infrastructure.logging import get_logger
from app.infrastructure.simulator.thermal import DEFAULT_START_TEMP, parse_rate, simulate

log = get_logger(__name__)


def _param(params: list[dict], key: str) -> dict | None:
    return next((p for p in params if p.get("key") == key), None)


async def _latest_temperature(session: AsyncSession, room_id: str) -> float:
    row = (
        await session.execute(
            select(TelemetrySeries).where(
                TelemetrySeries.room_id == room_id, TelemetrySeries.metric == "temperature"
            )
        )
    ).scalar_one_or_none()
    if row and row.points:
        return float(row.points[-1]["value"])
    return DEFAULT_START_TEMP


async def run_simulation(session: AsyncSession, plan_id: str) -> SimulationResultSchema:
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

    # Reuse: a successful result for this plan+version already exists.
    existing = (
        await session.execute(
            select(SimulationResult).where(
                SimulationResult.plan_id == plan_id,
                SimulationResult.plan_version == version.version,
            )
        )
    ).scalar_one_or_none()
    if existing is not None:
        return mappers.map_simulation_result(existing)

    # Stage guard: must have completed diagnosis (or be re-running after a failure).
    if not can_transition(event.stage, "simulating"):
        raise invalid_state(
            f"当前阶段 {event.stage} 不允许仿真（需先完成诊断）",
            current_stage=event.stage,
        )

    room = (
        await session.execute(
            select(ColdRoom).where(ColdRoom.id == event.room_id)
        )
    ).scalar_one()
    start_temp = await _latest_temperature(session, event.room_id)

    params = version.params or []
    target_temp = float((_param(params, "targetTemp") or {}).get("value", 8.0))
    rate_cap = parse_rate((_param(params, "rate") or {}).get("value", 0.5))
    fan_mode = str((_param(params, "fanMode") or {}).get("value", "中速"))
    valve_opening = float((_param(params, "valveOpening") or {}).get("value", 60))
    min_temp_c = float((room.safety_params or {}).get("minTempC", 5))

    run = SimulationRun(
        id=f"simrun-{uuid.uuid4().hex[:10]}",
        plan_id=plan_id,
        plan_version=version.version,
        status="running",
    )
    session.add(run)
    event.stage = "simulating"
    await session.flush()

    try:
        out = simulate(
            start_temp=start_temp,
            target_temp=target_temp,
            rate_cap=rate_cap,
            fan_mode=fan_mode,
            valve_opening=valve_opening,
            min_temp_c=min_temp_c,
        )
    except Exception as exc:  # noqa: BLE001
        run.status = "failed"
        run.finished_at = datetime.now(UTC)
        run.failure_reason = str(exc)
        event.stage = "simulationFailed"
        await session.commit()
        log.exception("simulation.failed", plan_id=plan_id)
        raise internal_error("仿真服务暂时不可用，请重试") from exc

    result = SimulationResult(
        id=f"sim-{uuid.uuid4().hex[:10]}",
        plan_id=plan_id,
        plan_version=version.version,
        run_id=run.id,
        recovery_hours=out.recovery_hours,
        energy_kwh=out.energy_kwh,
        overshoot_risk=out.overshoot_risk,
        frost_risk=out.frost_risk,
        compressor_cycles=out.compressor_cycles,
        predicted_series=out.predicted_series,
        provenance="simulated",
    )
    session.add(result)
    run.status = "succeeded"
    run.finished_at = datetime.now(UTC)
    event.stage = "simulationCompleted"
    await session.commit()
    log.info(
        "simulation.completed",
        plan_id=plan_id,
        recovery_hours=out.recovery_hours,
        energy=out.energy_kwh,
    )
    return mappers.map_simulation_result(result)

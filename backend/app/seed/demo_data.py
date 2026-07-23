"""Demo seed data.

Mirrors the frozen frontend mock (``frontend/src/mocks``) so the backend serves
an identical demo narrative. All data is ``demo`` provenance; simulation /
execution outputs produced by the workflow are ``simulated``.

Idempotent: re-running on an already-seeded database is a no-op.
"""

from __future__ import annotations

import math
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.audit.repository import SecurityAuditRepository
from app.infrastructure.db.models import (
    AnomalyEvent,
    ColdRoom,
    ControlPlan,
    ControlPlanVersion,
    Device,
    EventReport,
    InventoryBatch,
    RoomEvent,
    SafetyRule,
    Sensor,
    TelemetrySeries,
)
from app.infrastructure.logging import get_logger

log = get_logger(__name__)

MOCK_NOW = datetime(2026, 7, 23, 10, 35, 0, tzinfo=UTC)


def minutes_ago(minutes: int) -> datetime:
    return MOCK_NOW - timedelta(minutes=minutes)


# --------------------------------------------------------------------------- #
# Deterministic RNG (port of frontend mulberry32) for reproducible demo series
# --------------------------------------------------------------------------- #


def _imul(a: int, b: int) -> int:
    return (a * b) & 0xFFFFFFFF


def mulberry32(seed: int):
    state = seed & 0xFFFFFFFF

    def rand() -> float:
        nonlocal state
        state = (state + 0x6D2B79F5) & 0xFFFFFFFF
        s = state
        t = _imul((s ^ (s >> 15)) & 0xFFFFFFFF, (1 | s) & 0xFFFFFFFF) & 0xFFFFFFFF
        inner = _imul((t ^ (t >> 7)) & 0xFFFFFFFF, (61 | t) & 0xFFFFFFFF) & 0xFFFFFFFF
        t = ((t + inner) & 0xFFFFFFFF) ^ t
        t = t & 0xFFFFFFFF
        t = (t ^ (t >> 14)) & 0xFFFFFFFF
        return t / 4294967296

    return rand


def round2(v: float) -> float:
    return round(v * 100) / 100


def _build_points(
    *,
    seed: int,
    base: float,
    amplitude: float,
    lift=None,
    window_minutes: int = 24 * 60,
    step_minutes: int = 10,
) -> list[dict]:
    rand = mulberry32(seed)
    points: list[dict] = []
    offset = -window_minutes
    while offset <= 0:
        wave = math.sin((offset / 60) * 1.3) * amplitude
        noise = (rand() - 0.5) * amplitude * 0.6
        lift_value = lift(offset) if lift else 0
        value = round2(base + wave + noise + lift_value)
        points.append({"t": (MOCK_NOW + timedelta(minutes=offset)).isoformat(), "value": value})
        offset += step_minutes
    return points


def _chili_lift(offset: int) -> float:
    if offset >= 0:
        return 1.8
    minutes_since_onset = offset + 80  # 09:15 onset
    if minutes_since_onset >= 0:
        progress = min(minutes_since_onset / 80, 1)
        return round2(1.8 * progress)
    if offset > -110:
        return round2(0.3 * ((offset + 110) / 30))
    return 0.0


def _humid_lift(offset: int) -> float:
    minutes_since_onset = offset + 25
    return min(minutes_since_onset / 25, 1) * 8 if minutes_since_onset >= 0 else 0.0


def _series(
    series_id: str,
    room_id: str,
    sensor_id: str,
    metric: str,
    unit: str,
    *,
    seed: int,
    base: float,
    amplitude: float,
    status: str = "online",
    target: dict | None = None,
    lift=None,
    provenance: str = "demo",
) -> TelemetrySeries:
    return TelemetrySeries(
        id=series_id,
        room_id=room_id,
        sensor_id=sensor_id,
        metric=metric,
        unit=unit,
        target=target,
        status=status,
        last_sample_at=minutes_ago(2),
        points=_build_points(seed=seed, base=base, amplitude=amplitude, lift=lift),
        provenance=provenance,
    )


# --------------------------------------------------------------------------- #
# Seed
# --------------------------------------------------------------------------- #


async def is_seeded(session: AsyncSession) -> bool:
    result = await session.execute(select(ColdRoom).where(ColdRoom.id == "room-1"))
    return result.scalar_one_or_none() is not None


async def seed_database(session: AsyncSession) -> None:
    if await is_seeded(session):
        log.info("seed.skipped_already_seeded")
        return

    await _seed_topology(session)
    await _seed_events_and_plans(session)
    await _seed_safety_rules(session)
    await _seed_audit_and_report(session)
    await session.commit()
    log.info("seed.complete")


async def _seed_topology(session: AsyncSession) -> None:
    rooms = [
        ColdRoom(
            id="room-1",
            name="1号辣椒库",
            location="A区 · 东侧",
            volume_m3=420,
            control_mode="ai_assisted",
            target_range={"metric": "temperature", "min": 8, "max": 10, "unit": "℃"},
            safety_params={"minTempC": 5, "maxTempC": 12, "maxRatePerHour": 0.5},
        ),
        ColdRoom(
            id="room-2",
            name="2号芒果库",
            location="A区 · 西侧",
            volume_m3=380,
            control_mode="ai_assisted",
            target_range={"metric": "temperature", "min": 10, "max": 13, "unit": "℃"},
            safety_params={"minTempC": 7, "maxTempC": 15, "maxRatePerHour": 0.5},
        ),
        ColdRoom(
            id="room-3",
            name="3号葡萄库",
            location="B区 · 北侧",
            volume_m3=350,
            control_mode="manual",
            target_range={"metric": "temperature", "min": 0, "max": 2, "unit": "℃"},
            safety_params={"minTempC": -2, "maxTempC": 4, "maxRatePerHour": 0.5},
        ),
    ]
    session.add_all(rooms)

    sensors = [
        # room-1
        Sensor(id="sen-temp-1", room_id="room-1", name="温度传感器", metric="temperature"),
        Sensor(id="sen-hum-1", room_id="room-1", name="湿度传感器", metric="humidity"),
        Sensor(id="sen-o2-1", room_id="room-1", name="O₂传感器", metric="o2"),
        Sensor(id="sen-co2-1", room_id="room-1", name="CO₂传感器", metric="co2"),
        Sensor(id="sen-pres-1", room_id="room-1", name="压差传感器", metric="pressureDiff"),
        # room-2
        Sensor(id="sen-temp-2", room_id="room-2", name="温度传感器", metric="temperature"),
        Sensor(id="sen-hum-2", room_id="room-2", name="湿度传感器", metric="humidity"),
        # room-3
        Sensor(id="sen-temp-3", room_id="room-3", name="温度传感器", metric="temperature"),
        Sensor(id="sen-pres-3", room_id="room-3", name="压差传感器", metric="pressureDiff"),
    ]
    session.add_all(sensors)

    devices = [
        Device(id="dev-compressor-1", room_id="room-1", kind="compressor", name="压缩机 A",
               status="running", metrics={"efficiencyPct": 78, "dischargeTempC": 86, "suctionPressureKpa": 320}),
        Device(id="dev-fan-1", room_id="room-1", kind="fan", name="冷风机",
               status="running", metrics={"airflowPct": 92}),
        Device(id="dev-valve-1", room_id="room-1", kind="valve", name="电子膨胀阀",
               status="running", metrics={"openingPct": 60}),
        Device(id="dev-door-1", room_id="room-1", kind="door", name="库门",
               status="idle", metrics={"openPct": 0}),
        Device(id="dev-meter-1", room_id="room-1", kind="meter", name="电表",
               status="running", metrics={"todayKwh": 1246}),
        Device(id="dev-compressor-2", room_id="room-2", kind="compressor", name="压缩机 B",
               status="running", metrics={"efficiencyPct": 88}),
        Device(id="dev-fan-2", room_id="room-2", kind="fan", name="冷风机",
               status="running", metrics={"airflowPct": 90}),
        Device(id="dev-door-2", room_id="room-2", kind="door", name="库门",
               status="idle", metrics={"openPct": 0}),
        Device(id="dev-compressor-3", room_id="room-3", kind="compressor", name="压缩机 C",
               status="running", metrics={"efficiencyPct": 91}),
        Device(id="dev-fan-3", room_id="room-3", kind="fan", name="冷风机",
               status="running", metrics={"airflowPct": 95}),
        Device(id="dev-door-3", room_id="room-3", kind="door", name="库门",
               status="idle", metrics={"openPct": 0}),
    ]
    session.add_all(devices)

    inventory = [
        InventoryBatch(id="batch-1", room_id="room-1", category="辣椒（线椒）", quantity_kg=800,
                       inbound_at=minutes_ago(110), maturity="完熟", source="本地合作社",
                       recommended_range={"metric": "temperature", "min": 8, "max": 10, "unit": "℃"},
                       max_storage_hours=240, risk="watch"),
        InventoryBatch(id="batch-2", room_id="room-1", category="辣椒（彩椒）", quantity_kg=1200,
                       inbound_at=minutes_ago(60 * 30), maturity="八成熟", source="寿光基地",
                       recommended_range={"metric": "temperature", "min": 8, "max": 10, "unit": "℃"},
                       max_storage_hours=300, risk="none"),
        InventoryBatch(id="batch-3", room_id="room-2", category="芒果（台农）", quantity_kg=950,
                       inbound_at=minutes_ago(60 * 20), maturity="七成熟", source="海南",
                       recommended_range={"metric": "temperature", "min": 10, "max": 13, "unit": "℃"},
                       max_storage_hours=360, risk="none"),
        InventoryBatch(id="batch-4", room_id="room-3", category="葡萄（巨峰）", quantity_kg=600,
                       inbound_at=minutes_ago(60 * 48), maturity="完熟", source="云南",
                       recommended_range={"metric": "temperature", "min": 0, "max": 2, "unit": "℃"},
                       max_storage_hours=480, risk="none"),
    ]
    session.add_all(inventory)

    room1_target = {"metric": "temperature", "min": 8, "max": 10, "unit": "℃"}
    room2_target = {"metric": "temperature", "min": 10, "max": 13, "unit": "℃"}
    room3_target = {"metric": "temperature", "min": 0, "max": 2, "unit": "℃"}

    telemetry = [
        _series("tel-1a", "room-1", "sen-temp-1", "temperature", "℃",
                seed=11, base=8.8, amplitude=0.4, target=room1_target, lift=_chili_lift),
        _series("tel-1b", "room-1", "sen-hum-1", "humidity", "%RH", seed=12, base=90, amplitude=2.5),
        _series("tel-1c", "room-1", "sen-o2-1", "o2", "%", seed=13, base=3.1, amplitude=0.4),
        _series("tel-1d", "room-1", "sen-co2-1", "co2", "%", seed=14, base=8.5, amplitude=0.8),
        _series("tel-1e", "room-1", "sen-pres-1", "pressureDiff", "Pa", seed=15, base=12, amplitude=1.5),
        _series("tel-2a", "room-2", "sen-temp-2", "temperature", "℃",
                seed=21, base=11.5, amplitude=0.5, target=room2_target),
        _series("tel-2b", "room-2", "sen-hum-2", "humidity", "%RH",
                seed=22, base=82, amplitude=2, lift=_humid_lift),
        _series("tel-3a", "room-3", "sen-temp-3", "temperature", "℃",
                seed=31, base=1, amplitude=0.3, target=room3_target),
        _series("tel-3b", "room-3", "sen-pres-3", "pressureDiff", "Pa", seed=32, base=8, amplitude=1),
    ]
    session.add_all(telemetry)

    room_events = [
        RoomEvent(id="rev-1", room_id="room-1", kind="inbound", at=minutes_ago(110),
                  label="入库", detail="0.8t 常温辣椒入库"),
        RoomEvent(id="rev-2", room_id="room-1", kind="door_open", at=minutes_ago(105),
                  label="库门开启", detail="库门开启"),
        RoomEvent(id="rev-3", room_id="room-1", kind="door_close", at=minutes_ago(90),
                  label="库门关闭", detail="开门约 15 分钟"),
        RoomEvent(id="rev-4", room_id="room-1", kind="compressor_start", at=minutes_ago(70),
                  label="压缩机启动", detail="压缩机启动"),
        RoomEvent(id="rev-5", room_id="room-1", kind="compressor_stop", at=minutes_ago(20),
                  label="压缩机停机", detail="压缩机停机"),
        RoomEvent(id="rev-6", room_id="room-2", kind="door_open", at=minutes_ago(30),
                  label="库门开启", detail="短时开门"),
    ]
    session.add_all(room_events)
    await session.flush()


async def _seed_events_and_plans(session: AsyncSession) -> None:
    events = [
        AnomalyEvent(id="evt-1", room_id="room-1", type="sustained_high_temp", title="持续高温",
                     severity="critical", started_at=minutes_ago(80), duration_minutes=80, stage="detected"),
        AnomalyEvent(id="evt-2", room_id="room-2", type="humidity_high", title="湿度偏高",
                     severity="warning", started_at=minutes_ago(25), duration_minutes=25, stage="detected"),
        AnomalyEvent(id="evt-3", room_id="room-3", type="pressure_fluctuation", title="压差波动",
                     severity="notice", started_at=minutes_ago(300), duration_minutes=40, stage="recovered"),
    ]
    session.add_all(events)

    plans = [
        ControlPlan(id="plan-a", event_id="evt-1", name="方案 A · 平滑逼近目标",
                    kind="recommended", approval_level="L2", current_version=1,
                    approach="平滑逼近目标温度，减少急降、过冲与频繁启停",
                    rollback_conditions=[
                        "温度过冲 > 0.8℃ 或 30 分钟未改善 → 回退 PID",
                        "AI 异常 / 数据中断 → 传统规则兜底",
                    ]),
        ControlPlan(id="plan-b", event_id="evt-1", name="方案 B · 快速强制降温",
                    kind="alternative", approval_level="L2", current_version=1,
                    approach="优先快速恢复目标温度，恢复更快但过冲与冻害风险更高",
                    rollback_conditions=[
                        "货物温度 < 7.0℃ → 立即回退",
                        "压缩机连续启停异常 → 回退 PID",
                    ]),
    ]
    session.add_all(plans)

    plan_a_params = [
        {"key": "targetTemp", "label": "目标温度", "value": 8.0, "unit": "℃", "bound": {"min": 7.5, "max": 9.0}},
        {"key": "rate", "label": "变化速率", "value": "≤0.5", "unit": "℃/h"},
        {"key": "fanMode", "label": "风机模式", "value": "中速"},
        {"key": "valveOpening", "label": "阀门开度", "value": 60, "unit": "%", "bound": {"min": 40, "max": 80}},
    ]
    plan_b_params = [
        {"key": "targetTemp", "label": "目标温度", "value": 7.5, "unit": "℃", "bound": {"min": 7.0, "max": 8.5}},
        {"key": "rate", "label": "变化速率", "value": "≤1.5", "unit": "℃/h"},
        {"key": "fanMode", "label": "风机模式", "value": "高速"},
        {"key": "valveOpening", "label": "阀门开度", "value": 85, "unit": "%", "bound": {"min": 60, "max": 100}},
    ]
    session.add_all([
        ControlPlanVersion(id="cpv-a-1", plan_id="plan-a", version=1, active=True, params=plan_a_params),
        ControlPlanVersion(id="cpv-b-1", plan_id="plan-b", version=1, active=True, params=plan_b_params),
    ])
    await session.flush()


async def _seed_safety_rules(session: AsyncSession) -> None:
    rules = [
        SafetyRule(id="rule-l3-001", rule_code="RULE-SAFETY-001", version="1",
                   level="L3", active=True,
                   definition={"description": "禁止越过设备保护范围 / 关闭联锁",
                               "patterns": ["关闭压缩机联锁", "越过设备保护", "强制满负荷"]}),
        SafetyRule(id="rule-whitelist-1", rule_code="RULE-WHITELIST", version="1",
                   level="L2", active=True,
                   definition={"allowed_param_keys": ["targetTemp", "rate", "fanMode", "valveOpening"]}),
        SafetyRule(id="rule-bounds-1", rule_code="RULE-BOUNDS", version="1",
                   level="L2", active=True,
                   definition={"description": "控制参数须在库房安全边界内"}),
    ]
    session.add_all(rules)
    await session.flush()


async def _seed_audit_and_report(session: AsyncSession) -> None:
    # L3 interception audit entry for evt-1 (agent attempted to bypass interlock).
    audit_repo = SecurityAuditRepository(session)
    await audit_repo.append(
        event_id="evt-1",
        category="blocked_action",
        action="关闭压缩机联锁保护以强制满负荷降温",
        source="agent",
        approval_level="L3",
        triggered_rule="RULE-SAFETY-001 · 禁止越过设备保护范围",
        rule_version="1",
        reason="该动作试图越过 PLC 联锁与设备保护机制，属于 L3 永久禁止项",
        outcome="blocked",
        attempted_at=minutes_ago(50),
    )

    # Pre-seeded event report for evt-1 (matches frontend mock; provenance=demo).
    session.add(EventReport(
        id="report-evt-1",
        event_id="evt-1",
        generated_at=minutes_ago(0),
        summary="1 号辣椒库持续高温事件已完成处置：定位为入库热量负荷为主因，经人工审批执行平滑逼近方案后恢复至目标区间。",
        cause_summary=["入库热量负荷（置信度 0.68）", "库门长时间开启（置信度 0.55）", "压缩机效率下降（置信度 0.32）"],
        tools_used=["读取实时数据", "查询库门记录", "查询设备日志", "检索知识库", "检索历史案例"],
        approval={"level": "L2", "decision": "已批准", "approver": "冷库管理员"},
        outcome="温度恢复至 8.0℃，未发生过冲与冻害，恢复用时约 6.2 小时（仿真结果）。",
        follow_ups=["入库货物建议预冷后入库", "安排压缩机效率检查", "确认传感器校准时间"],
        provenance="demo",
    ))
    await session.flush()

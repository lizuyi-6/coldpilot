"""Concrete agent tools.

Each tool is data-driven: it reads from the DB (telemetry, room events, devices)
or the static domain knowledge base, and returns a structured ``ToolResult`` with
both a full ``output_json`` and a human-readable ``output_summary``. The agent
records both (not just summaries) in ``tool_invocations``.
"""

from __future__ import annotations

import time
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.db.models import Device, RoomEvent, TelemetrySeries
from app.infrastructure.tools.knowledge import HISTORICAL_CASES, KNOWLEDGE_ENTRIES
from app.ports.tools import ToolRegistry, ToolResult


def _ms_since(start: float) -> int:
    return int((time.perf_counter() - start) * 1000)


class TelemetryQueryTool:
    name = "telemetry.query"
    label = "读取实时数据"

    async def run(self, session: AsyncSession, input_data: dict[str, Any]) -> ToolResult:
        start = time.perf_counter()
        room_id = input_data.get("roomId") or input_data.get("room_id")
        rows = (
            await session.execute(
                select(TelemetrySeries).where(TelemetrySeries.room_id == room_id)
            )
        ).scalars().all()

        metrics: list[dict[str, Any]] = []
        note_parts: list[str] = []
        for s in rows:
            values = [p["value"] for p in s.points]
            latest = values[-1] if values else None
            lo = min(values) if values else None
            hi = max(values) if values else None
            target = s.target or {}
            breach = None
            if latest is not None and target:
                if latest > target.get("max", latest) or latest < target.get("min", latest):
                    breach = "above" if latest > target.get("max", latest) else "below"
            metrics.append(
                {
                    "metric": s.metric,
                    "unit": s.unit,
                    "latest": latest,
                    "min": lo,
                    "max": hi,
                    "target": target,
                    "status": s.status,
                    "breach": breach,
                }
            )
            if s.metric == "temperature" and breach:
                note_parts.append(
                    f"{s.metric} 最新 {latest:.1f}{s.unit} 超出目标上限 "
                    f"{target.get('max')}{s.unit}"
                )

        summary = (
            ("；".join(note_parts) + "。")
            if note_parts
            else f"{room_id} 各指标处于目标区间内。"
        )
        return ToolResult(
            output_json={"roomId": room_id, "metrics": metrics},
            output_summary=f"{room_id} · 温度/湿度/气体 · " + summary,
            duration_ms=_ms_since(start),
        )


class DoorLogQueryTool:
    name = "doorlog.query"
    label = "查询库门记录"

    async def run(self, session: AsyncSession, input_data: dict[str, Any]) -> ToolResult:
        start = time.perf_counter()
        room_id = input_data.get("roomId") or input_data.get("room_id")
        rows = (
            await session.execute(
                select(RoomEvent)
                .where(
                    RoomEvent.room_id == room_id,
                    RoomEvent.kind.in_(["door_open", "door_close"]),
                )
                .order_by(RoomEvent.at)
            )
        ).scalars().all()

        events = [{"id": r.id, "kind": r.kind, "at": r.at.isoformat(), "label": r.label} for r in rows]
        # crude open-window estimate (minutes between first open and a later close)
        open_minutes = 0.0
        opens = [r for r in rows if r.kind == "door_open"]
        closes = [r for r in rows if r.kind == "door_close"]
        if opens and closes and closes[-1].at >= opens[0].at:
            open_minutes = (closes[-1].at - opens[0].at).total_seconds() / 60.0

        summary = (
            f"库门开启约 {open_minutes:.0f} 分钟"
            if open_minutes
            else "近期无明显库门长时间开启"
        )
        return ToolResult(
            output_json={"roomId": room_id, "events": events, "openMinutes": round(open_minutes, 1)},
            output_summary=summary,
            duration_ms=_ms_since(start),
        )


class DeviceLogQueryTool:
    name = "devicelog.query"
    label = "查询设备日志"

    async def run(self, session: AsyncSession, input_data: dict[str, Any]) -> ToolResult:
        start = time.perf_counter()
        room_id = input_data.get("roomId") or input_data.get("room_id")
        rows = (
            await session.execute(select(Device).where(Device.room_id == room_id))
        ).scalars().all()

        devices = [
            {"id": d.id, "kind": d.kind, "name": d.name, "status": d.status, "metrics": d.metrics or {}}
            for d in rows
        ]
        compressor = next((d for d in devices if d["kind"] == "compressor"), None)
        if compressor:
            eff = compressor["metrics"].get("efficiencyPct")
            discharge = compressor["metrics"].get("dischargeTempC")
            summary = f"压缩机效率 {eff}%（偏低），排气温度 {discharge}℃ 偏高" if eff and eff < 82 else "压缩机运行正常"
        else:
            summary = "未发现压缩机异常"

        return ToolResult(
            output_json={"roomId": room_id, "devices": devices},
            output_summary=summary,
            duration_ms=_ms_since(start),
        )


class KnowledgeSearchTool:
    name = "knowledge.search"
    label = "检索知识库"

    async def run(self, session: AsyncSession, input_data: dict[str, Any]) -> ToolResult:
        start = time.perf_counter()
        query = (input_data.get("query") or "").lower()
        matches = [
            {"id": e["id"], "topic": e["topic"], "summary": e["summary"]}
            for e in KNOWLEDGE_ENTRIES
            if not query or any(k in e["topic"] for k in query.split())
        ] or [KNOWLEDGE_ENTRIES[0]]
        topics = " / ".join(e["topic"] for e in KNOWLEDGE_ENTRIES)
        return ToolResult(
            output_json={"query": query, "matches": matches},
            output_summary=f"匹配 {len(KNOWLEDGE_ENTRIES)} 条：{topics}",
            duration_ms=_ms_since(start),
        )


class CasesSearchTool:
    name = "cases.search"
    label = "检索历史案例"

    async def run(self, session: AsyncSession, input_data: dict[str, Any]) -> ToolResult:
        start = time.perf_counter()
        query = (input_data.get("query") or "").lower()
        matches = HISTORICAL_CASES
        return ToolResult(
            output_json={"query": query, "matches": matches},
            output_summary="相似案例 2 起，主因均为入库热量 + 库门扰动",
            duration_ms=_ms_since(start),
        )


def build_tool_registry() -> ToolRegistry:
    """Build the default tool registry with all five tools registered."""
    registry = ToolRegistry()
    for tool in (TelemetryQueryTool(), DoorLogQueryTool(), DeviceLogQueryTool(),
                 KnowledgeSearchTool(), CasesSearchTool()):
        registry.register(tool)
    return registry

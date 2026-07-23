"""Agent abstraction: deterministic (default, offline) + optional LLM mode.

The agent ONLY performs diagnosis (tool calls + cause synthesis). It MUST NOT
make safety/approval/execution decisions — those live in the safety + execution
layers and never in prompts.

Deterministic mode runs fully offline with no external API and produces
data-driven output (real tool calls, structured IO recorded). It is NOT real
LLM reasoning.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from typing import Any

import httpx
from pydantic import BaseModel

from app.ports.tools import ToolResult


@dataclass
class EvidenceData:
    id: str
    kind: str  # supporting | counter
    summary: str
    source_ref: str


@dataclass
class CauseData:
    id: str
    label: str
    confidence: float
    triage_order: int
    evidence: list[EvidenceData] = field(default_factory=list)
    recommended_checks: list[str] = field(default_factory=list)


@dataclass
class DiagnosisSynthesis:
    understanding: str
    data_sources: list[str]
    causes: list[CauseData]
    uncertainties: list[str]


@dataclass
class AgentStep:
    tool_name: str
    input_data: dict[str, Any]
    input_summary: str


@dataclass
class AgentContext:
    room_id: str
    goal: str
    event_title: str
    started_at_iso: str
    recent_inbound: list[dict[str, Any]] = field(default_factory=list)


class Agent:
    """Base agent. Subclasses implement plan() and synthesize()."""

    agent_mode = "deterministic"
    model_id: str | None = None
    prompt_template_id: str | None = None
    prompt_template_version: str | None = None
    knowledge_version: str | None = "kb-1"

    def plan(self, context: AgentContext) -> list[AgentStep]:
        raise NotImplementedError

    def synthesize(
        self, context: AgentContext, results: list[tuple[AgentStep, ToolResult]]
    ) -> DiagnosisSynthesis:
        raise NotImplementedError


# --- Pydantic schema used to VALIDATE LLM structured output (safety: the LLM
#     cannot dictate structure; output is coerced into this shape). ---
class LlmCause(BaseModel):
    label: str
    confidence: float
    triage_order: int
    evidence: list[dict[str, str]]
    recommended_checks: list[str]


class LlmDiagnosis(BaseModel):
    understanding: str
    data_sources: list[str]
    causes: list[LlmCause]
    uncertainties: list[str]


class DeterministicAgent(Agent):
    """Offline, data-driven agent. Calls real tools and synthesizes causes."""

    agent_mode = "deterministic"
    prompt_template_id = "det-v1"
    prompt_template_version = "1"

    def plan(self, context: AgentContext) -> list[AgentStep]:
        return [
            AgentStep(
                "telemetry.query",
                {"roomId": context.room_id, "metrics": ["temperature", "humidity", "o2", "co2", "pressureDiff"], "windowHours": 24},
                f"{context.room_id} · 温度/湿度/气体 · 近24h",
            ),
            AgentStep(
                "doorlog.query",
                {"roomId": context.room_id, "windowHours": 24},
                f"{context.room_id} · 库门开关事件",
            ),
            AgentStep(
                "devicelog.query",
                {"roomId": context.room_id},
                f"{context.room_id} · 压缩机/风机/阀门",
            ),
            AgentStep(
                "knowledge.search",
                {"query": f"{context.event_title} 高温处置 SOP"},
                "辣椒保鲜 · 高温处置 SOP",
            ),
            AgentStep(
                "cases.search",
                {"query": "相似高温事件 · 近90天"},
                "相似高温事件 · 近90天",
            ),
        ]

    def synthesize(
        self, context: AgentContext, results: list[tuple[AgentStep, ToolResult]]
    ) -> DiagnosisSynthesis:
        by_name = {step.tool_name: res for step, res in results}
        telemetry = by_name.get("telemetry.query")
        doorlog = by_name.get("doorlog.query")
        devicelog = by_name.get("devicelog.query")

        temp_breach = False
        if telemetry:
            for m in telemetry.output_json.get("metrics", []):
                if m.get("metric") == "temperature":
                    temp_breach = bool(m.get("breach"))

        open_minutes = 0.0
        if doorlog:
            open_minutes = float(doorlog.output_json.get("openMinutes", 0) or 0)

        compressor_eff: float | None = None
        fan_ok = True
        if devicelog:
            for d in devicelog.output_json.get("devices", []):
                if d.get("kind") == "compressor":
                    compressor_eff = (d.get("metrics") or {}).get("efficiencyPct")
                if d.get("kind") == "fan":
                    airflow = (d.get("metrics") or {}).get("airflowPct")
                    fan_ok = airflow is None or airflow >= 80

        causes: list[CauseData] = []

        # 1. Inbound heat load (requires a recent inbound batch + temperature breach).
        if context.recent_inbound and temp_breach:
            batch = context.recent_inbound[0]
            causes.append(
                CauseData(
                    id="cause-1",
                    label="入库热量负荷",
                    confidence=0.68,
                    triage_order=1,
                    evidence=[
                        EvidenceData("ev-1a", "supporting",
                                     f"入库 {batch.get('quantityKg')}kg 常温{batch.get('category', '货物')}，库温随后上升",
                                     "telemetry.query"),
                        EvidenceData("ev-1b", "supporting",
                                     "入库后 30 分钟内库温上升约 0.8℃",
                                     "cases.search"),
                    ],
                    recommended_checks=["确认入库货物预冷情况", "评估是否分批入库"],
                )
            )

        # 2. Long door-open window.
        if open_minutes >= 10:
            causes.append(
                CauseData(
                    id="cause-2",
                    label="库门长时间开启",
                    confidence=0.55,
                    triage_order=2,
                    evidence=[
                        EvidenceData("ev-2a", "supporting",
                                     f"库门开启约 {open_minutes:.0f} 分钟，与升温时段重合",
                                     "doorlog.query"),
                        EvidenceData("ev-2b", "counter",
                                     "开门时长在该库属常见作业范围",
                                     "knowledge.search"),
                    ],
                    recommended_checks=["检查库门密封条与闭门器"],
                )
            )

        # 3. Compressor efficiency drop.
        if compressor_eff is not None and compressor_eff < 82:
            causes.append(
                CauseData(
                    id="cause-3",
                    label="压缩机效率下降",
                    confidence=0.32,
                    triage_order=3,
                    evidence=[
                        EvidenceData("ev-3a", "supporting",
                                     f"压缩机效率 {compressor_eff}%，排气温度偏高",
                                     "devicelog.query"),
                        EvidenceData("ev-3b", "counter",
                                     "功率与制冷量仍在安全边界内",
                                     "telemetry.query"),
                    ],
                    recommended_checks=["核对吸气/排气压力", "必要时安排维保"],
                )
            )

        # 4. Fan airflow (counter-evidence dominant -> lower confidence).
        causes.append(
            CauseData(
                id="cause-4",
                label="风机风量不足",
                confidence=0.21,
                triage_order=4,
                evidence=[
                    EvidenceData(
                        "ev-4a",
                        "counter",
                        "风机运行正常，送风均匀，风量无明显异常" if fan_ok else "风机送风偏低",
                        "devicelog.query",
                    )
                ],
                recommended_checks=["暂无需处理，可排除"],
            )
        )

        return DiagnosisSynthesis(
            understanding="分析 1 号辣椒库温度持续高于目标区间的原因，并给出安全、节能的处理方向。",
            data_sources=["实时传感器", "库门记录", "设备日志", "冷库知识库", "历史案例"],
            causes=causes,
            uncertainties=["传感器上次校准时间未知，需人工确认", "入库货物初始温度未记录"],
        )


class LlmAgent(Agent):
    """OpenAI-compatible LLM agent.

    Requires LLM_BASE_URL / LLM_API_KEY / LLM_MODEL. The LLM's output is parsed
    into ``LlmDiagnosis`` (Pydantic-validated); on any failure the task fails
    rather than emitting unvalidated output. The LLM never decides safety.
    """

    agent_mode = "llm"

    def __init__(self, base_url: str, api_key: str, model: str, timeout: float = 30.0) -> None:
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.model = model
        self.timeout = timeout
        self.model_id = model
        self.prompt_template_id = "llm-v1"
        self.prompt_template_version = "1"

    def plan(self, context: AgentContext) -> list[AgentStep]:
        # Same tool plan as deterministic; the LLM interprets results.
        return DeterministicAgent().plan(context)

    def synthesize(
        self, context: AgentContext, results: list[tuple[AgentStep, ToolResult]]
    ) -> DiagnosisSynthesis:
        tool_dump = [
            {"tool": step.tool_name, "output": res.output_json, "summary": res.output_summary}
            for step, res in results
        ]
        prompt = (
            "你是冷库异常诊断助手。仅基于以下工具结果推断原因，禁止给出安全/审批/执行建议。\n"
            f"事件：{context.event_title}\n"
            f"工具结果（JSON）：{json.dumps(tool_dump, ensure_ascii=False)}"
        )
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": "输出严格 JSON：{understanding, data_sources[], causes[{label,confidence,triage_order,evidence[{kind,summary,source_ref}],recommended_checks[]}], uncertainties[]}"},
                {"role": "user", "content": prompt},
            ],
            "temperature": 0,
        }
        with httpx.Client(timeout=self.timeout) as client:
            resp = client.post(
                f"{self.base_url}/chat/completions",
                headers={"Authorization": f"Bearer {self.api_key}"},
                json=payload,
            )
            resp.raise_for_status()
            content = resp.json()["choices"][0]["message"]["content"]

        parsed = LlmDiagnosis.model_validate_json(content)
        causes = [
            CauseData(
                id=f"cause-{i + 1}",
                label=c.label,
                confidence=max(0.0, min(1.0, c.confidence)),
                triage_order=c.triage_order,
                evidence=[
                    EvidenceData(
                        id=f"ev-{i + 1}-{j + 1}",
                        kind=e.get("kind", "supporting"),
                        summary=e.get("summary", ""),
                        source_ref=e.get("source_ref", ""),
                    )
                    for j, e in enumerate(c.evidence)
                ],
                recommended_checks=list(c.recommended_checks),
            )
            for i, c in enumerate(parsed.causes)
        ]
        return DiagnosisSynthesis(
            understanding=parsed.understanding,
            data_sources=list(parsed.data_sources),
            causes=causes,
            uncertainties=list(parsed.uncertainties),
        )


def now_iso() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def recent_inbound_window(hours: int = 6) -> datetime:
    return datetime.now(UTC) - timedelta(hours=hours)

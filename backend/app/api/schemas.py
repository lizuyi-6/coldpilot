"""Pydantic response schemas mirroring the frozen OpenAPI contract (camelCase).

These models ARE the contract surface. Field names, types and enums match
``docs/contracts/openapi.frontend-draft.yaml`` exactly. Datetimes serialize as
ISO-8601 UTC with a trailing ``Z``.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict


def to_z(value: datetime | str | None) -> str | None:
    """Serialize a datetime (or ISO string) to ISO-8601 UTC with trailing 'Z'."""
    if value is None:
        return None
    if isinstance(value, str):
        return value.replace("+00:00", "Z")
    if value.tzinfo is None:
        value = value.replace(tzinfo=UTC)
    return value.astimezone(UTC).isoformat().replace("+00:00", "Z")


class SchemaModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")


# --------------------------------------------------------------------------- #
# Primitives
# --------------------------------------------------------------------------- #

TargetMetric = Literal["temperature", "humidity", "o2", "co2", "pressureDiff"]


class TargetRange(SchemaModel):
    metric: TargetMetric
    min: float
    max: float
    unit: str


class SensorReading(SchemaModel):
    t: str
    value: float


class SensorSeries(SchemaModel):
    roomId: str
    metric: TargetMetric
    unit: str
    points: list[SensorReading]
    target: TargetRange | None = None
    status: Literal["online", "offline", "drifting", "stale"]
    lastSampleAt: str


class ColdRoom(SchemaModel):
    id: str
    name: str
    location: str
    volumeM3: float
    controlMode: Literal["ai_assisted", "manual", "safe_fallback"]
    targetRange: TargetRange
    deviceIds: list[str]
    sensorIds: list[str]
    safetyParams: dict[str, Any]


class Device(SchemaModel):
    id: str
    roomId: str
    kind: Literal["compressor", "fan", "valve", "door", "meter"]
    name: str
    status: Literal["running", "idle", "fault", "offline"]
    metrics: dict[str, float] | None = None


class InventoryBatch(SchemaModel):
    id: str
    roomId: str
    category: str
    quantityKg: float
    inboundAt: str
    maturity: str
    source: str
    recommendedRange: TargetRange
    maxStorageHours: int
    risk: Literal["none", "watch", "high"]


class RoomEventMarker(SchemaModel):
    id: str
    roomId: str
    kind: Literal["door_open", "door_close", "inbound", "compressor_start", "compressor_stop"]
    at: str
    label: str
    detail: str | None = None


# --------------------------------------------------------------------------- #
# Anomaly events
# --------------------------------------------------------------------------- #


class AnomalyEventSummary(SchemaModel):
    id: str
    roomId: str
    roomName: str
    type: str
    title: str
    severity: Literal["notice", "warning", "critical", "emergency"]
    startedAt: str
    durationMinutes: int
    stage: str
    awaitingApproval: bool


class AnomalyEventDetail(AnomalyEventSummary):
    room: ColdRoom
    devices: list[Device]
    inventory: list[InventoryBatch]
    telemetry: list[SensorSeries]
    roomEvents: list[RoomEventMarker]


# --------------------------------------------------------------------------- #
# Diagnosis (defined here, used in B3)
# --------------------------------------------------------------------------- #


class ToolInvocation(SchemaModel):
    id: str
    name: str
    label: str
    inputSummary: str
    outputSummary: str
    durationMs: int
    status: Literal["succeeded", "failed"]


class AgentTask(SchemaModel):
    id: str
    eventId: str
    goal: str
    status: Literal["queued", "running", "succeeded", "failed"]
    tools: list[ToolInvocation]
    startedAt: str
    finishedAt: str | None = None


class DiagnosticEvidence(SchemaModel):
    id: str
    kind: Literal["supporting", "counter"]
    summary: str
    sourceRef: str


class DiagnosticCause(SchemaModel):
    id: str
    label: str
    confidence: float
    evidence: list[DiagnosticEvidence]
    triageOrder: int
    recommendedChecks: list[str]


class DiagnosisResult(SchemaModel):
    eventId: str
    understanding: str
    dataSources: list[str]
    causes: list[DiagnosticCause]
    uncertainties: list[str]


# --------------------------------------------------------------------------- #
# Control plans / simulation
# --------------------------------------------------------------------------- #


class ControlParam(SchemaModel):
    key: str
    label: str
    value: float | str
    unit: str | None = None
    bound: dict[str, float] | None = None


class ControlPlan(SchemaModel):
    id: str
    eventId: str
    name: str
    kind: Literal["recommended", "alternative"]
    approvalLevel: Literal["L2"]
    approach: str
    params: list[ControlParam]
    rollbackConditions: list[str]
    version: int


class SimulationResult(SchemaModel):
    planId: str
    planVersion: int
    recoveryHours: float
    energyKWh: float
    overshootRisk: Literal["low", "medium", "high"]
    frostRisk: Literal["low", "medium", "high"]
    compressorCycles: int
    predictedSeries: list[SensorReading]
    provenance: Literal["simulated"]


# --------------------------------------------------------------------------- #
# Approval
# --------------------------------------------------------------------------- #


class SafetyCheckItem(SchemaModel):
    key: Literal["whitelist", "bounds", "rate", "conflict", "permission"]
    label: str
    passed: bool
    detail: str | None = None


class ApprovalDecision(SchemaModel):
    decision: Literal["approved", "rejected"]
    approverId: str
    reason: str | None = None


class ApprovalRequest(SchemaModel):
    id: str
    planId: str
    planVersion: int
    level: str
    safetyChecks: list[SafetyCheckItem]
    status: Literal["pending", "approved", "rejected"]
    createdAt: str
    decidedBy: str | None = None
    decidedAt: str | None = None
    reason: str | None = None


class ApprovalResult(SchemaModel):
    requestId: str
    decision: Literal["approved", "rejected"]
    decidedBy: str
    decidedAt: str


# --------------------------------------------------------------------------- #
# Execution
# --------------------------------------------------------------------------- #


class ExecutionTask(SchemaModel):
    id: str
    planId: str
    planVersion: int
    status: Literal["queued", "executing", "verifying", "recovered", "failed"]
    observedSeries: list[SensorReading]
    startedAt: str
    finishedAt: str | None = None
    recoveryMinutes: int | None = None
    triggeredRollback: str | None = None
    provenance: Literal["simulated"]


# --------------------------------------------------------------------------- #
# Reports / security audit
# --------------------------------------------------------------------------- #


class EventReportApproval(SchemaModel):
    level: str
    decision: str
    approver: str


class EventReport(SchemaModel):
    id: str
    eventId: str
    generatedAt: str
    summary: str
    causeSummary: list[str]
    toolsUsed: list[str]
    approval: EventReportApproval
    outcome: str
    followUps: list[str]
    provenance: Literal["demo"]


class SecurityAuditEntry(SchemaModel):
    id: str
    eventId: str
    category: Literal["blocked_action"]
    action: str
    source: Literal["agent", "user", "external"]
    attemptedAt: str
    approvalLevel: Literal["L3"]
    triggeredRule: str
    reason: str
    outcome: Literal["blocked"]

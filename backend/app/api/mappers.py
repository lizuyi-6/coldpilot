"""ORM -> API schema mappers.

Pure functions that turn ORM rows into the frozen contract response models.
Derived-only fields (roomName, awaitingApproval, deviceIds, sensorIds) are
computed here, never read from a persisted column.
"""

from __future__ import annotations

from app.api.schemas import (
    AnomalyEventDetail,
    AnomalyEventSummary,
    ApprovalRequest,
    ApprovalResult,
    ColdRoom,
    ControlParam,
    ControlPlan,
    Device,
    DiagnosisResult,
    DiagnosticCause,
    DiagnosticEvidence,
    EventReport,
    EventReportApproval,
    ExecutionTask,
    InventoryBatch,
    RoomEventMarker,
    SecurityAuditEntry,
    SensorReading,
    SensorSeries,
    SimulationResult,
    TargetRange,
    ToolInvocation,
    to_z,
)
from app.domain.constants import awaiting_approval_from_stage
from app.infrastructure.db.models import (
    AnomalyEvent,
    ControlPlanVersion,
    RoomEvent,
    TelemetrySeries,
)
from app.infrastructure.db.models import (
    ApprovalRequest as ApprovalRequestModel,
)
from app.infrastructure.db.models import (
    ControlPlan as ControlPlanModel,
)
from app.infrastructure.db.models import (
    Device as DeviceModel,
)
from app.infrastructure.db.models import (
    DiagnosisResult as DiagnosisResultModel,
)
from app.infrastructure.db.models import (
    EventReport as EventReportModel,
)
from app.infrastructure.db.models import (
    ExecutionTask as ExecutionTaskModel,
)
from app.infrastructure.db.models import (
    InventoryBatch as InventoryBatchModel,
)
from app.infrastructure.db.models import (
    SecurityAuditEntry as SecurityAuditEntryModel,
)
from app.infrastructure.db.models import (
    SimulationResult as SimulationResultModel,
)
from app.infrastructure.db.models import (
    ToolInvocation as ToolInvocationModel,
)


def _target_range(data: dict) -> TargetRange:
    return TargetRange(
        metric=data["metric"], min=data["min"], max=data["max"], unit=data["unit"]
    )


def _readings(points: list[dict]) -> list[SensorReading]:
    return [SensorReading(t=to_z(p["t"]), value=p["value"]) for p in points]


def map_cold_room(room, devices: list, sensors: list) -> ColdRoom:  # noqa: ANN001
    return ColdRoom(
        id=room.id,
        name=room.name,
        location=room.location,
        volumeM3=room.volume_m3,
        controlMode=room.control_mode,
        targetRange=_target_range(room.target_range),
        deviceIds=[d.id for d in devices],
        sensorIds=[s.id for s in sensors],
        safetyParams=room.safety_params,
    )


def map_device(device: DeviceModel) -> Device:
    return Device(
        id=device.id,
        roomId=device.room_id,
        kind=device.kind,
        name=device.name,
        status=device.status,
        metrics=device.metrics,
    )


def map_inventory(batch: InventoryBatchModel) -> InventoryBatch:
    return InventoryBatch(
        id=batch.id,
        roomId=batch.room_id,
        category=batch.category,
        quantityKg=batch.quantity_kg,
        inboundAt=to_z(batch.inbound_at),
        maturity=batch.maturity,
        source=batch.source,
        recommendedRange=_target_range(batch.recommended_range),
        maxStorageHours=batch.max_storage_hours,
        risk=batch.risk,
    )


def map_telemetry(series: TelemetrySeries) -> SensorSeries:
    return SensorSeries(
        roomId=series.room_id,
        metric=series.metric,
        unit=series.unit,
        points=_readings(series.points),
        target=_target_range(series.target) if series.target else None,
        status=series.status,
        lastSampleAt=to_z(series.last_sample_at),
    )


def map_room_event(event: RoomEvent) -> RoomEventMarker:
    return RoomEventMarker(
        id=event.id,
        roomId=event.room_id,
        kind=event.kind,
        at=to_z(event.at),
        label=event.label,
        detail=event.detail,
    )


def map_event_summary(event: AnomalyEvent, room_name: str) -> AnomalyEventSummary:
    return AnomalyEventSummary(
        id=event.id,
        roomId=event.room_id,
        roomName=room_name,
        type=event.type,
        title=event.title,
        severity=event.severity,
        startedAt=to_z(event.started_at),
        durationMinutes=event.duration_minutes,
        stage=event.stage,
        awaitingApproval=awaiting_approval_from_stage(event.stage),
    )


def map_event_detail(event: AnomalyEvent) -> AnomalyEventDetail:
    room = event.room
    devices = [map_device(d) for d in room.devices]
    sensors = room.sensors  # SensorModel list, used only for ids here
    summary = map_event_summary(event, room.name)
    return AnomalyEventDetail(
        **summary.model_dump(),
        room=map_cold_room(room, room.devices, sensors),
        devices=devices,
        inventory=[map_inventory(b) for b in room.inventory],
        telemetry=[map_telemetry(t) for t in room.telemetry],
        roomEvents=[map_room_event(re) for re in room.room_events],
    )


def _control_params(version: ControlPlanVersion) -> list[ControlParam]:
    return [
        ControlParam(
            key=p["key"],
            label=p["label"],
            value=p["value"],
            unit=p.get("unit"),
            bound=p.get("bound"),
        )
        for p in version.params
    ]


def map_control_plan(plan: ControlPlanModel, version: ControlPlanVersion) -> ControlPlan:
    return ControlPlan(
        id=plan.id,
        eventId=plan.event_id,
        name=plan.name,
        kind=plan.kind,
        approvalLevel=plan.approval_level,
        approach=plan.approach,
        params=_control_params(version),
        rollbackConditions=list(plan.rollback_conditions),
        version=version.version,
    )


def map_tool_invocation(tool: ToolInvocationModel) -> ToolInvocation:
    return ToolInvocation(
        id=tool.id,
        name=tool.name,
        label=tool.label,
        inputSummary=tool.input_summary,
        outputSummary=tool.output_summary,
        durationMs=tool.duration_ms,
        status=tool.status,
    )


def map_diagnosis_result(result: DiagnosisResultModel) -> DiagnosisResult:
    return DiagnosisResult(
        eventId=result.event_id,
        understanding=result.understanding,
        dataSources=list(result.data_sources),
        causes=[
            DiagnosticCause(
                id=cause.id,
                label=cause.label,
                confidence=cause.confidence,
                triageOrder=cause.triage_order,
                recommendedChecks=list(cause.recommended_checks),
                evidence=[
                    DiagnosticEvidence(
                        id=e.id, kind=e.kind, summary=e.summary, sourceRef=e.source_ref
                    )
                    for e in cause.evidence
                ],
            )
            for cause in result.causes
        ],
        uncertainties=list(result.uncertainties),
    )


def map_simulation_result(result: SimulationResultModel) -> SimulationResult:
    return SimulationResult(
        planId=result.plan_id,
        planVersion=result.plan_version,
        recoveryHours=result.recovery_hours,
        energyKWh=result.energy_kwh,
        overshootRisk=result.overshoot_risk,
        frostRisk=result.frost_risk,
        compressorCycles=result.compressor_cycles,
        predictedSeries=_readings(result.predicted_series),
        provenance=result.provenance,
    )


def map_approval_request(req: ApprovalRequestModel) -> ApprovalRequest:
    return ApprovalRequest(
        id=req.id,
        planId=req.plan_id,
        planVersion=req.plan_version,
        level=req.level,
        safetyChecks=req.safety_checks,
        status=req.status,
        createdAt=to_z(req.created_at),
        decidedBy=req.decided_by,
        decidedAt=to_z(req.decided_at),
        reason=req.reason,
    )


def map_approval_result(req: ApprovalRequestModel) -> ApprovalResult:
    return ApprovalResult(
        requestId=req.id,
        decision=req.status,
        decidedBy=req.decided_by or "",
        decidedAt=to_z(req.decided_at) or "",
    )


def map_execution_task(task: ExecutionTaskModel) -> ExecutionTask:
    return ExecutionTask(
        id=task.id,
        planId=task.plan_id,
        planVersion=task.plan_version,
        status=task.status,
        observedSeries=_readings(task.observed_series),
        startedAt=to_z(task.started_at),
        finishedAt=to_z(task.finished_at),
        recoveryMinutes=task.recovery_minutes,
        triggeredRollback=task.triggered_rollback,
        provenance=task.provenance,
    )


def map_event_report(report: EventReportModel) -> EventReport:
    approval = report.approval or {}
    return EventReport(
        id=report.id,
        eventId=report.event_id,
        generatedAt=to_z(report.generated_at),
        summary=report.summary,
        causeSummary=list(report.cause_summary),
        toolsUsed=list(report.tools_used),
        approval=EventReportApproval(
            level=approval.get("level", "L2"),
            decision=approval.get("decision", ""),
            approver=approval.get("approver", ""),
        ),
        outcome=report.outcome,
        followUps=list(report.follow_ups),
        provenance=report.provenance,
    )


def map_security_audit(entry: SecurityAuditEntryModel) -> SecurityAuditEntry:
    return SecurityAuditEntry(
        id=entry.id,
        eventId=entry.event_id,
        category=entry.category,
        action=entry.action,
        source=entry.source,
        attemptedAt=to_z(entry.attempted_at),
        approvalLevel=entry.approval_level,
        triggeredRule=entry.triggered_rule,
        reason=entry.reason,
        outcome=entry.outcome,
    )

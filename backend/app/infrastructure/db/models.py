"""SQLAlchemy ORM models.

Design notes (per backend data-modeling decisions):
- ``anomaly_events`` stores ONLY ``stage`` (single source of truth).
  ``awaitingApproval`` is derived from ``stage`` at the API layer.
- Relations (room<->device, room<->sensor) are expressed via foreign keys only.
  ``deviceIds`` / ``sensorIds`` are derived from relation queries, never stored
  as arrays alongside the relation tables.
- Telemetry is stored as JSON time series (MVP); supports demo / simulated /
  pilot / real provenance.
- Audit entries form an append-only hash chain (NOT cryptographic non-repudiation).

Status strings deliberately mirror the frozen frontend enums. ``queued`` (not
``pending``) is the external contract value.
"""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import (
    Boolean,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy.types import JSON, TypeDecorator


def utcnow() -> datetime:
    return datetime.now(UTC)


class UTCDateTime(TypeDecorator):
    """Store datetimes as exact UTC ISO strings.

    SQLite has no native timezone-aware datetime; the default dialect strips
    tzinfo on bind, which would make audit hash computation inconsistent
    between insert and read-back. Storing an explicit ISO string guarantees an
    exact, timezone-aware round-trip (always read back as UTC-aware).
    """

    impl = String
    cache_ok = True

    def process_bind_param(self, value, dialect):  # noqa: ANN001
        if value is None:
            return None
        if isinstance(value, str):
            return value
        if value.tzinfo is None:
            value = value.replace(tzinfo=UTC)
        return value.astimezone(UTC).isoformat()

    def process_result_value(self, value, dialect):  # noqa: ANN001
        if value is None:
            return None
        dt = datetime.fromisoformat(value)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=UTC)
        return dt


class Base(DeclarativeBase):
    """Declarative base for all ORM models."""


# --------------------------------------------------------------------------- #
# Cold-chain topology
# --------------------------------------------------------------------------- #


class ColdRoom(Base):
    __tablename__ = "cold_rooms"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    location: Mapped[str] = mapped_column(String(128), nullable=False)
    volume_m3: Mapped[float] = mapped_column(Float, nullable=False)
    control_mode: Mapped[str] = mapped_column(String(32), nullable=False, default="ai_assisted")
    # {metric, min, max, unit}
    target_range: Mapped[dict] = mapped_column(JSON, nullable=False)
    # {minTempC, maxTempC, maxRatePerHour}
    safety_params: Mapped[dict] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    devices: Mapped[list[Device]] = relationship(
        back_populates="room", cascade="all, delete-orphan", lazy="selectin"
    )
    sensors: Mapped[list[Sensor]] = relationship(
        back_populates="room", cascade="all, delete-orphan", lazy="selectin"
    )
    inventory: Mapped[list[InventoryBatch]] = relationship(
        back_populates="room", cascade="all, delete-orphan", lazy="selectin"
    )
    telemetry: Mapped[list[TelemetrySeries]] = relationship(
        back_populates="room", cascade="all, delete-orphan", lazy="selectin"
    )
    room_events: Mapped[list[RoomEvent]] = relationship(
        back_populates="room", cascade="all, delete-orphan", lazy="selectin"
    )


class Device(Base):
    __tablename__ = "devices"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    room_id: Mapped[str] = mapped_column(ForeignKey("cold_rooms.id"), nullable=False, index=True)
    kind: Mapped[str] = mapped_column(String(32), nullable=False)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="running")
    # free-form running metrics, e.g. {efficiencyPct, dischargeTempC}
    metrics: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    room: Mapped[ColdRoom] = relationship(back_populates="devices")


class Sensor(Base):
    __tablename__ = "sensors"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    room_id: Mapped[str] = mapped_column(ForeignKey("cold_rooms.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    metric: Mapped[str] = mapped_column(String(32), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="online")

    room: Mapped[ColdRoom] = relationship(back_populates="sensors")


class InventoryBatch(Base):
    __tablename__ = "inventory_batches"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    room_id: Mapped[str] = mapped_column(ForeignKey("cold_rooms.id"), nullable=False, index=True)
    category: Mapped[str] = mapped_column(String(64), nullable=False)
    quantity_kg: Mapped[float] = mapped_column(Float, nullable=False)
    inbound_at: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False)
    maturity: Mapped[str] = mapped_column(String(64), nullable=False)
    source: Mapped[str] = mapped_column(String(128), nullable=False)
    recommended_range: Mapped[dict] = mapped_column(JSON, nullable=False)
    max_storage_hours: Mapped[int] = mapped_column(Integer, nullable=False)
    risk: Mapped[str] = mapped_column(String(16), nullable=False, default="none")

    room: Mapped[ColdRoom] = relationship(back_populates="inventory")


class TelemetrySeries(Base):
    """One metric time series for a room (supports SensorSeries + sim start state)."""

    __tablename__ = "telemetry_series"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    room_id: Mapped[str] = mapped_column(ForeignKey("cold_rooms.id"), nullable=False, index=True)
    sensor_id: Mapped[str | None] = mapped_column(ForeignKey("sensors.id"), nullable=True)
    metric: Mapped[str] = mapped_column(String(32), nullable=False)
    unit: Mapped[str] = mapped_column(String(32), nullable=False)
    # {metric, min, max, unit} for the main controlled metric only
    target: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="online")
    last_sample_at: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False)
    # [{t, value}, ...]
    points: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    # demo | simulated | pilot | real
    provenance: Mapped[str] = mapped_column(String(16), nullable=False, default="demo")

    room: Mapped[ColdRoom] = relationship(back_populates="telemetry")


class RoomEvent(Base):
    """Marker overlaid on the trend chart (door open/close, inbound, compressor...)."""

    __tablename__ = "room_events"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    room_id: Mapped[str] = mapped_column(ForeignKey("cold_rooms.id"), nullable=False, index=True)
    kind: Mapped[str] = mapped_column(String(32), nullable=False)
    at: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False)
    label: Mapped[str] = mapped_column(String(128), nullable=False)
    detail: Mapped[str | None] = mapped_column(Text, nullable=True)

    room: Mapped[ColdRoom] = relationship(back_populates="room_events")


# --------------------------------------------------------------------------- #
# Anomaly events (stage is the single source of truth)
# --------------------------------------------------------------------------- #


class AnomalyEvent(Base):
    __tablename__ = "anomaly_events"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    room_id: Mapped[str] = mapped_column(ForeignKey("cold_rooms.id"), nullable=False, index=True)
    type: Mapped[str] = mapped_column(String(64), nullable=False)
    title: Mapped[str] = mapped_column(String(256), nullable=False)
    severity: Mapped[str] = mapped_column(String(16), nullable=False)
    started_at: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False)
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # ONLY stage is persisted; awaitingApproval/isApproved/... are all derived.
    stage: Mapped[str] = mapped_column(String(32), nullable=False, default="detected")
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    room: Mapped[ColdRoom] = relationship(lazy="selectin")
    agent_tasks: Mapped[list[AgentTask]] = relationship(
        back_populates="event", cascade="all, delete-orphan", lazy="selectin"
    )
    control_plans: Mapped[list[ControlPlan]] = relationship(
        back_populates="event", cascade="all, delete-orphan", lazy="selectin"
    )


# --------------------------------------------------------------------------- #
# Diagnosis (agent task + tool invocations + structured result)
# --------------------------------------------------------------------------- #


class AgentTask(Base):
    __tablename__ = "agent_tasks"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    event_id: Mapped[str] = mapped_column(ForeignKey("anomaly_events.id"), nullable=False, index=True)
    goal: Mapped[str] = mapped_column(Text, nullable=False)
    # queued | running | succeeded | failed  (external contract value is queued)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="queued")
    started_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)

    # --- Agent run provenance metadata (required by backend decisions) ---
    agent_mode: Mapped[str] = mapped_column(String(16), nullable=False, default="deterministic")
    model_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    prompt_template_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    prompt_template_version: Mapped[str | None] = mapped_column(String(32), nullable=True)
    knowledge_version: Mapped[str | None] = mapped_column(String(32), nullable=True)
    tool_registry_version: Mapped[str | None] = mapped_column(String(32), nullable=True)
    failure_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    event: Mapped[AnomalyEvent] = relationship(back_populates="agent_tasks")
    tool_invocations: Mapped[list[ToolInvocation]] = relationship(
        back_populates="task", cascade="all, delete-orphan", lazy="selectin",
        order_by="ToolInvocation.seq",
    )
    diagnosis_result: Mapped[DiagnosisResult | None] = relationship(
        back_populates="task", cascade="all, delete-orphan", uselist=False, lazy="selectin"
    )


class ToolInvocation(Base):
    """A single tool call. Stores full structured input/output, not just summaries."""

    __tablename__ = "tool_invocations"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    task_id: Mapped[str] = mapped_column(ForeignKey("agent_tasks.id"), nullable=False, index=True)
    seq: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    name: Mapped[str] = mapped_column(String(64), nullable=False)
    label: Mapped[str] = mapped_column(String(128), nullable=False)
    input_summary: Mapped[str] = mapped_column(Text, nullable=False, default="")
    output_summary: Mapped[str] = mapped_column(Text, nullable=False, default="")
    # full structured IO
    input_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    output_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    duration_ms: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="succeeded")
    error_code: Mapped[str | None] = mapped_column(String(64), nullable=True)
    # {fields: [...]} describing what was redacted/sanitized
    redaction_metadata: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    task: Mapped[AgentTask] = relationship(back_populates="tool_invocations")


class DiagnosisResult(Base):
    __tablename__ = "diagnosis_results"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    event_id: Mapped[str] = mapped_column(ForeignKey("anomaly_events.id"), nullable=False, index=True)
    task_id: Mapped[str] = mapped_column(ForeignKey("agent_tasks.id"), nullable=False, index=True)
    understanding: Mapped[str] = mapped_column(Text, nullable=False)
    data_sources: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    uncertainties: Mapped[list] = mapped_column(JSON, nullable=False, default=list)

    task: Mapped[AgentTask] = relationship(back_populates="diagnosis_result")
    causes: Mapped[list[DiagnosticCause]] = relationship(
        back_populates="diagnosis", cascade="all, delete-orphan", lazy="selectin",
        order_by="DiagnosticCause.triage_order",
    )


class DiagnosticCause(Base):
    __tablename__ = "diagnostic_causes"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    diagnosis_id: Mapped[str] = mapped_column(
        ForeignKey("diagnosis_results.id"), nullable=False, index=True
    )
    label: Mapped[str] = mapped_column(String(256), nullable=False)
    confidence: Mapped[float] = mapped_column(Float, nullable=False)
    triage_order: Mapped[int] = mapped_column(Integer, nullable=False)
    recommended_checks: Mapped[list] = mapped_column(JSON, nullable=False, default=list)

    diagnosis: Mapped[DiagnosisResult] = relationship(back_populates="causes")
    evidence: Mapped[list[DiagnosticEvidence]] = relationship(
        back_populates="cause", cascade="all, delete-orphan", lazy="selectin"
    )


class DiagnosticEvidence(Base):
    __tablename__ = "diagnostic_evidence"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    cause_id: Mapped[str] = mapped_column(
        ForeignKey("diagnostic_causes.id"), nullable=False, index=True
    )
    kind: Mapped[str] = mapped_column(String(16), nullable=False)  # supporting | counter
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    source_ref: Mapped[str] = mapped_column(String(128), nullable=False)

    cause: Mapped[DiagnosticCause] = relationship(back_populates="evidence")


# --------------------------------------------------------------------------- #
# Control plans (immutable versions)
# --------------------------------------------------------------------------- #


class ControlPlan(Base):
    __tablename__ = "control_plans"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    event_id: Mapped[str] = mapped_column(ForeignKey("anomaly_events.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    kind: Mapped[str] = mapped_column(String(32), nullable=False)  # recommended | alternative
    approval_level: Mapped[str] = mapped_column(String(8), nullable=False, default="L2")
    approach: Mapped[str] = mapped_column(Text, nullable=False)
    rollback_conditions: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    # current active version (binds approval / simulation / execution)
    current_version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    event: Mapped[AnomalyEvent] = relationship(back_populates="control_plans")
    versions: Mapped[list[ControlPlanVersion]] = relationship(
        back_populates="plan", cascade="all, delete-orphan", lazy="selectin",
        order_by="ControlPlanVersion.version",
    )


class ControlPlanVersion(Base):
    """Immutable snapshot of a plan's params for a given version."""

    __tablename__ = "control_plan_versions"
    __table_args__ = (UniqueConstraint("plan_id", "version", name="uq_plan_version"),)

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    plan_id: Mapped[str] = mapped_column(ForeignKey("control_plans.id"), nullable=False, index=True)
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    # [{key, label, value, unit, bound:{min,max}}, ...]
    params: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    plan: Mapped[ControlPlan] = relationship(back_populates="versions")


# --------------------------------------------------------------------------- #
# Simulation (internal run record; external interface is synchronous)
# --------------------------------------------------------------------------- #


class SimulationRun(Base):
    __tablename__ = "simulation_runs"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    plan_id: Mapped[str] = mapped_column(ForeignKey("control_plans.id"), nullable=False, index=True)
    plan_version: Mapped[int] = mapped_column(Integer, nullable=False)
    # running | succeeded | failed
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="running")
    started_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    finished_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)
    failure_reason: Mapped[str | None] = mapped_column(Text, nullable=True)


class SimulationResult(Base):
    """Immutable simulation output, keyed by (plan_id, plan_version) for reuse."""

    __tablename__ = "simulation_results"
    __table_args__ = (
        UniqueConstraint("plan_id", "plan_version", name="uq_sim_plan_version"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    plan_id: Mapped[str] = mapped_column(ForeignKey("control_plans.id"), nullable=False, index=True)
    plan_version: Mapped[int] = mapped_column(Integer, nullable=False)
    run_id: Mapped[str | None] = mapped_column(ForeignKey("simulation_runs.id"), nullable=True)
    recovery_hours: Mapped[float] = mapped_column(Float, nullable=False)
    energy_kwh: Mapped[float] = mapped_column(Float, nullable=False)
    overshoot_risk: Mapped[str] = mapped_column(String(16), nullable=False)
    frost_risk: Mapped[str] = mapped_column(String(16), nullable=False)
    compressor_cycles: Mapped[int] = mapped_column(Integer, nullable=False)
    # [{t, value}, ...] predicted temperature series
    predicted_series: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    provenance: Mapped[str] = mapped_column(String(16), nullable=False, default="simulated")
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)


# --------------------------------------------------------------------------- #
# Approval
# --------------------------------------------------------------------------- #


class ApprovalRequest(Base):
    __tablename__ = "approval_requests"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    plan_id: Mapped[str] = mapped_column(ForeignKey("control_plans.id"), nullable=False, index=True)
    plan_version: Mapped[int] = mapped_column(Integer, nullable=False)
    level: Mapped[str] = mapped_column(String(8), nullable=False, default="L2")
    # [{key,label,passed,detail}, ...]
    safety_checks: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    # pending | approved | rejected
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="pending")
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    decided_by: Mapped[str | None] = mapped_column(String(128), nullable=True)
    decided_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)


# --------------------------------------------------------------------------- #
# Execution + verification
# --------------------------------------------------------------------------- #


class ControlCommand(Base):
    """Structured, immutable command generated from an approved plan version."""

    __tablename__ = "control_commands"
    __table_args__ = (
        UniqueConstraint(
            "plan_id", "plan_version", "approval_request_id",
            name="uq_command_plan_version_approval",
        ),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    plan_id: Mapped[str] = mapped_column(ForeignKey("control_plans.id"), nullable=False, index=True)
    plan_version: Mapped[int] = mapped_column(Integer, nullable=False)
    approval_request_id: Mapped[str] = mapped_column(
        ForeignKey("approval_requests.id"), nullable=False, index=True
    )
    # structured payload only (no free-text PLC instructions)
    payload: Mapped[dict] = mapped_column(JSON, nullable=False)
    # pending | sent | accepted | applied | rejected | timeout
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="pending")
    generated_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)


class ExecutionTask(Base):
    __tablename__ = "execution_tasks"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    plan_id: Mapped[str] = mapped_column(ForeignKey("control_plans.id"), nullable=False, index=True)
    command_id: Mapped[str] = mapped_column(ForeignKey("control_commands.id"), nullable=False, index=True)
    plan_version: Mapped[int] = mapped_column(Integer, nullable=False)
    approval_request_id: Mapped[str] = mapped_column(
        ForeignKey("approval_requests.id"), nullable=False, index=True
    )
    # queued | executing | verifying | recovered | failed
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="queued")
    started_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)
    recovery_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    triggered_rollback: Mapped[str | None] = mapped_column(Text, nullable=True)
    # progressively filled observation series [{t, value}, ...]
    observed_series: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    provenance: Mapped[str] = mapped_column(String(16), nullable=False, default="simulated")
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    # heartbeat used by the worker to detect stale running tasks
    last_advanced_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)


class VerificationResult(Base):
    __tablename__ = "verification_results"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    execution_task_id: Mapped[str] = mapped_column(
        ForeignKey("execution_tasks.id"), nullable=False, unique=True, index=True
    )
    criteria: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    passed: Mapped[bool] = mapped_column(Boolean, nullable=False)
    decided_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    observed_tail: Mapped[list] = mapped_column(JSON, nullable=False, default=list)


# --------------------------------------------------------------------------- #
# Reports
# --------------------------------------------------------------------------- #


class EventReport(Base):
    __tablename__ = "event_reports"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    event_id: Mapped[str] = mapped_column(
        ForeignKey("anomaly_events.id"), nullable=False, unique=True, index=True
    )
    generated_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    cause_summary: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    tools_used: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    approval: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    outcome: Mapped[str] = mapped_column(Text, nullable=False)
    follow_ups: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    provenance: Mapped[str] = mapped_column(String(16), nullable=False, default="demo")


# --------------------------------------------------------------------------- #
# Security audit (append-only hash chain)
# --------------------------------------------------------------------------- #


class SecurityAuditEntry(Base):
    """Append-only audit entry forming a simple hash chain.

    NOTE: this provides auditability, traceability and basic tamper-evidence.
    It is NOT cryptographic non-repudiation.
    """

    __tablename__ = "security_audit_entries"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    event_id: Mapped[str | None] = mapped_column(
        ForeignKey("anomaly_events.id"), nullable=True, index=True
    )
    category: Mapped[str] = mapped_column(String(32), nullable=False, default="blocked_action")
    action: Mapped[str] = mapped_column(Text, nullable=False)
    source: Mapped[str] = mapped_column(String(16), nullable=False)  # agent | user | external
    attempted_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    approval_level: Mapped[str] = mapped_column(String(8), nullable=False, default="L3")
    triggered_rule: Mapped[str] = mapped_column(String(128), nullable=False)
    rule_version: Mapped[str | None] = mapped_column(String(32), nullable=True)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    outcome: Mapped[str] = mapped_column(String(16), nullable=False, default="blocked")

    # hash chain
    sequence_number: Mapped[int] = mapped_column(Integer, nullable=False, unique=True)
    previous_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)
    entry_hash: Mapped[str] = mapped_column(String(128), nullable=False)
    correlation_id: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)


# --------------------------------------------------------------------------- #
# Safety rules (versioned)
# --------------------------------------------------------------------------- #


class SafetyRule(Base):
    __tablename__ = "safety_rules"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    rule_code: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    version: Mapped[str] = mapped_column(String(32), nullable=False)
    level: Mapped[str] = mapped_column(String(8), nullable=False)  # L0 | L1 | L2 | L3
    definition: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    effective_from: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

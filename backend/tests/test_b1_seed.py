"""B1 tests: schema, seed data, audit hash chain, stage single-source-of-truth."""

from __future__ import annotations

from sqlalchemy import select

from app.domain.constants import awaiting_approval_from_stage, can_transition
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
    Sensor,
    TelemetrySeries,
)
from app.seed.demo_data import is_seeded, seed_database


async def _seed(db) -> None:  # noqa: ANN001
    async with db.session_factory() as session:
        await seed_database(session)


async def test_seed_populates_core_entities(db) -> None:  # noqa: ANN001
    await _seed(db)
    async with db.session_factory() as session:
        rooms = (await session.execute(select(ColdRoom))).scalars().all()
        assert len([r for r in rooms]) == 3

        devices = (await session.execute(select(Device))).scalars().all()
        assert len(devices) == 11

        sensors = (await session.execute(select(Sensor))).scalars().all()
        assert len(sensors) == 9

        inventory = (await session.execute(select(InventoryBatch))).scalars().all()
        assert len(inventory) == 4

        events = (await session.execute(select(AnomalyEvent))).scalars().all()
        assert len(events) == 3

        plans = (
            await session.execute(select(ControlPlan).where(ControlPlan.event_id == "evt-1"))
        ).scalars().all()
        assert {p.id for p in plans} == {"plan-a", "plan-b"}

        versions = (
            await session.execute(select(ControlPlanVersion).where(ControlPlanVersion.plan_id == "plan-a"))
        ).scalars().all()
        assert len(versions) == 1
        assert versions[0].version == 1
        assert versions[0].active is True
        assert any(p["key"] == "targetTemp" for p in versions[0].params)

        telemetry = (await session.execute(select(TelemetrySeries))).scalars().all()
        assert len(telemetry) == 9
        temp_room1 = next(t for t in telemetry if t.room_id == "room-1" and t.metric == "temperature")
        assert temp_room1.provenance == "demo"
        assert len(temp_room1.points) > 0

        room_events = (await session.execute(select(RoomEvent))).scalars().all()
        assert len(room_events) == 6

        reports = (await session.execute(select(EventReport))).scalars().all()
        assert len(reports) == 1
        assert reports[0].provenance == "demo"


async def test_seed_is_idempotent(db) -> None:  # noqa: ANN001
    await _seed(db)
    await _seed(db)  # second run must be a no-op
    async with db.session_factory() as session:
        rooms = (await session.execute(select(ColdRoom))).scalars().all()
        assert len(rooms) == 3
    async with db.session_factory() as session:
        assert await is_seeded(session) is True


async def test_audit_hash_chain_verifies_after_seed(db) -> None:  # noqa: ANN001
    await _seed(db)
    async with db.session_factory() as session:
        repo = SecurityAuditRepository(session)
        assert await repo.count() == 1
        assert await repo.verify_chain() is True
        entries = await repo.list_for_event("evt-1")
        assert len(entries) == 1
        assert entries[0].outcome == "blocked"
        assert entries[0].approval_level == "L3"
        assert entries[0].entry_hash is not None
        assert entries[0].previous_hash is None  # first entry


async def test_audit_chain_grows_consistently(db) -> None:  # noqa: ANN001
    await _seed(db)
    async with db.session_factory() as session:
        repo = SecurityAuditRepository(session)
        await repo.append(
            event_id="evt-1", category="blocked_action", action="test action",
            source="user", approval_level="L3", triggered_rule="RULE-X",
            reason="x", outcome="blocked",
        )
        await session.commit()
        assert await repo.count() == 2
        assert await repo.verify_chain() is True
        entries = await repo.list_for_event("evt-1")
        assert entries[1].sequence_number == 2
        assert entries[1].previous_hash == entries[0].entry_hash


async def test_awaiting_approval_derived_from_stage() -> None:
    assert awaiting_approval_from_stage("awaitingApproval") is True
    assert awaiting_approval_from_stage("detected") is False
    assert awaiting_approval_from_stage("approved") is False


async def test_anomaly_events_stage_is_single_source(db) -> None:  # noqa: ANN001
    """No awaiting_approval/isApproved columns exist; only stage is persisted."""
    from app.infrastructure.db.models import AnomalyEvent as AE

    columns = {c.name for c in AE.__table__.columns}
    assert "stage" in columns
    for forbidden in ("awaiting_approval", "is_diagnosing", "is_approved", "is_executing", "is_recovered"):
        assert forbidden not in columns, f"anomaly_events must not persist {forbidden}"


async def test_stage_transition_machine_invariants() -> None:
    # Core invariants required by the contract.
    assert can_transition("diagnosisCompleted", "simulating") is True
    assert can_transition("simulationCompleted", "awaitingApproval") is True
    assert can_transition("awaitingApproval", "approved") is True
    assert can_transition("approved", "executing") is True
    assert can_transition("executing", "verifying") is True
    assert can_transition("verifying", "recovered") is True
    # Forbidden transitions.
    assert can_transition("diagnosisCompleted", "awaitingApproval") is False  # no sim -> no approval
    assert can_transition("simulationCompleted", "executing") is False  # no approval -> no exec
    assert can_transition("rejected", "executing") is False
    assert can_transition("executionFailed", "recovered") is False  # must not skip verifying
    assert can_transition("executing", "recovered") is False  # must pass verifying

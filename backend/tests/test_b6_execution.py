"""B6 tests: execution, verification, rollback, report, command idempotency."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from httpx import AsyncClient
from sqlalchemy import select

from app.application.execution import ExecutionHandler
from app.infrastructure.db.models import ControlCommand, ExecutionTask


async def _to_approved(seeded_client: AsyncClient, worker, plan: str = "plan-a") -> str:  # noqa: ANN001
    await seeded_client.post("/api/v1/anomaly-events/evt-1/diagnosis")
    for _ in range(8):
        await worker.run_once()
    await seeded_client.post(f"/api/v1/control-plans/{plan}/simulation")
    req = (await seeded_client.post(f"/api/v1/control-plans/{plan}/approval-requests")).json()
    await seeded_client.post(
        f"/api/v1/approval-requests/{req['id']}/decision",
        json={"decision": "approved", "approverId": "x"},
    )
    return req["id"]


async def _drive(worker, times: int = 12) -> None:  # noqa: ANN001
    for _ in range(times):
        await worker.run_once()


async def test_start_execution_blocked_without_approval(
    seeded_client: AsyncClient, worker  # noqa: ANN001
) -> None:
    await seeded_client.post("/api/v1/anomaly-events/evt-1/diagnosis")
    for _ in range(8):
        await worker.run_once()
    await seeded_client.post("/api/v1/control-plans/plan-a/simulation")
    response = await seeded_client.post("/api/v1/control-plans/plan-a/execution")
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "INVALID_STATE"


async def test_execution_recovers_through_verifying(
    seeded_client: AsyncClient, worker  # noqa: ANN001
) -> None:
    await _to_approved(seeded_client, worker)
    started = await seeded_client.post("/api/v1/control-plans/plan-a/execution")
    assert started.status_code == 202
    task_id = started.json()["id"]

    # Mid-run: status passes through executing/verifying; observed series grows.
    await _drive(worker, 3)
    mid = (await seeded_client.get(f"/api/v1/execution-tasks/{task_id}")).json()
    assert mid["status"] in ("executing", "verifying")
    assert len(mid["observedSeries"]) > 0

    # Drive to terminal.
    await _drive(worker, 10)
    done = (await seeded_client.get(f"/api/v1/execution-tasks/{task_id}")).json()
    assert done["status"] == "recovered"
    assert done["recoveryMinutes"] is not None and done["recoveryMinutes"] > 0
    assert done["finishedAt"] is not None
    events = (await seeded_client.get("/api/v1/anomaly-events")).json()
    assert next(e for e in events if e["id"] == "evt-1")["stage"] == "recovered"


async def test_execution_generates_one_command_only(
    seeded_client: AsyncClient, worker  # noqa: ANN001
) -> None:
    from app.infrastructure.db.session import get_database

    await _to_approved(seeded_client, worker)
    await seeded_client.post("/api/v1/control-plans/plan-a/execution")
    # Calling start again returns the SAME execution task (idempotent).
    second = await seeded_client.post("/api/v1/control-plans/plan-a/execution")
    assert second.status_code == 202

    database = get_database()
    async with database.session_factory() as session:
        commands = (await session.execute(select(ControlCommand))).scalars().all()
        execs = (await session.execute(select(ExecutionTask))).scalars().all()
    assert len(commands) == 1   # no second command
    assert len(execs) == 1      # no second execution task


async def _seed_command_and_approval(session, plan_id: str, version: int) -> tuple[str, str]:  # noqa: ANN001
    """Insert a real approved ApprovalRequest + ControlCommand for FK targets."""
    from app.infrastructure.db.models import ApprovalRequest, ControlCommand

    approval = ApprovalRequest(
        id="apr-test",
        plan_id=plan_id,
        plan_version=version,
        level="L2",
        safety_checks=[],
        status="approved",
        decided_by="冷库管理员",
    )
    command = ControlCommand(
        id="cmd-test",
        plan_id=plan_id,
        plan_version=version,
        approval_request_id="apr-test",
        payload={"params": [], "planVersion": version},
        status="sent",
    )
    session.add_all([approval, command])
    await session.flush()
    return "cmd-test", "apr-test"


async def test_execution_failed_rolls_back(seeded, worker) -> None:  # noqa: ANN001
    """A verifying task whose final value is outside target -> failed + rollback."""
    from app.infrastructure.db.models import AnomalyEvent, ControlPlan

    async with seeded.session_factory() as session:
        evt = (await session.execute(select(AnomalyEvent).where(AnomalyEvent.id == "evt-1"))).scalar_one()
        evt.stage = "verifying"
        plan = (await session.execute(select(ControlPlan).where(ControlPlan.id == "plan-a"))).scalar_one()
        cmd_id, apr_id = await _seed_command_and_approval(session, "plan-a", plan.current_version)
        task = ExecutionTask(
            id="exec-fail",
            plan_id="plan-a",
            command_id=cmd_id,
            plan_version=plan.current_version,
            approval_request_id=apr_id,
            status="verifying",
            started_at=datetime.now(UTC),
            last_advanced_at=datetime.now(UTC),
            observed_series=[{"t": "2026-07-23T10:35:00Z", "value": 99.0}],  # outside [8,10]
            provenance="simulated",
        )
        session.add(task)
        await session.commit()

    handler = ExecutionHandler()
    async with seeded.session_factory() as session:
        n = await handler.claim_and_process(session)
        assert n == 1
    async with seeded.session_factory() as session:
        row = await session.get(ExecutionTask, "exec-fail")
        assert row.status == "failed"
        assert row.triggered_rollback
        evt2 = await session.get(AnomalyEvent, "evt-1")
        assert evt2.stage == "executionFailed"


async def test_stale_execution_task_fails(seeded, worker) -> None:  # noqa: ANN001
    from app.infrastructure.db.models import AnomalyEvent, ControlPlan

    async with seeded.session_factory() as session:
        evt = (await session.execute(select(AnomalyEvent).where(AnomalyEvent.id == "evt-1"))).scalar_one()
        evt.stage = "executing"
        plan = (await session.execute(select(ControlPlan).where(ControlPlan.id == "plan-a"))).scalar_one()
        cmd_id, apr_id = await _seed_command_and_approval(session, "plan-a", plan.current_version)
        task = ExecutionTask(
            id="exec-stale",
            plan_id="plan-a",
            command_id=cmd_id,
            plan_version=plan.current_version,
            approval_request_id=apr_id,
            status="executing",
            started_at=datetime.now(UTC) - timedelta(seconds=9999),
            last_advanced_at=datetime.now(UTC) - timedelta(seconds=9999),
            observed_series=[],
            provenance="simulated",
        )
        session.add(task)
        await session.commit()

    handler = ExecutionHandler()
    async with seeded.session_factory() as session:
        affected = await handler.recover_stale(session, stale_timeout_seconds=120.0)
        assert affected == 1
    async with seeded.session_factory() as session:
        row = await session.get(ExecutionTask, "exec-stale")
        assert row.status == "failed"
        assert row.triggered_rollback


async def test_recovered_report_available(seeded_client: AsyncClient, worker) -> None:  # noqa: ANN001
    await _to_approved(seeded_client, worker)
    await seeded_client.post("/api/v1/control-plans/plan-a/execution")
    await _drive(worker, 14)
    report = await seeded_client.get("/api/v1/anomaly-events/evt-1/report")
    assert report.status_code == 200
    assert report.json()["eventId"] == "evt-1"

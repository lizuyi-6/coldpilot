"""B5 tests: L2 approval flow, idempotency, version binding, L3 interception."""

from __future__ import annotations

from httpx import AsyncClient
from sqlalchemy import select


async def _to_simulated(seeded_client: AsyncClient, worker, plan: str = "plan-a") -> None:  # noqa: ANN001
    await seeded_client.post("/api/v1/anomaly-events/evt-1/diagnosis")
    for _ in range(8):
        await worker.run_once()
    await seeded_client.post(f"/api/v1/control-plans/{plan}/simulation")


async def test_request_approval_requires_simulation(seeded_client: AsyncClient, worker) -> None:  # noqa: ANN001
    await seeded_client.post("/api/v1/anomaly-events/evt-1/diagnosis")
    for _ in range(8):
        await worker.run_once()
    response = await seeded_client.post("/api/v1/control-plans/plan-a/approval-requests")
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "INVALID_STATE"


async def test_request_approval_returns_safety_checks(
    seeded_client: AsyncClient, worker  # noqa: ANN001
) -> None:
    await _to_simulated(seeded_client, worker)
    response = await seeded_client.post("/api/v1/control-plans/plan-a/approval-requests")
    assert response.status_code == 201
    req = response.json()
    assert req["planId"] == "plan-a"
    assert req["planVersion"] == 1
    assert req["level"] == "L2"
    assert req["status"] == "pending"
    keys = {c["key"] for c in req["safetyChecks"]}
    assert keys == {"whitelist", "bounds", "rate", "conflict", "permission"}
    assert all(c["passed"] for c in req["safetyChecks"])


async def test_request_approval_idempotent_while_pending(
    seeded_client: AsyncClient, worker  # noqa: ANN001
) -> None:
    await _to_simulated(seeded_client, worker)
    first = await seeded_client.post("/api/v1/control-plans/plan-a/approval-requests")
    second = await seeded_client.post("/api/v1/control-plans/plan-a/approval-requests")
    assert first.status_code == 201
    assert second.status_code == 201
    assert first.json()["id"] == second.json()["id"]


async def test_submit_approval_approved(seeded_client: AsyncClient, worker) -> None:  # noqa: ANN001
    await _to_simulated(seeded_client, worker)
    req = (await seeded_client.post("/api/v1/control-plans/plan-a/approval-requests")).json()
    response = await seeded_client.post(
        f"/api/v1/approval-requests/{req['id']}/decision",
        json={"decision": "approved", "approverId": "whoever", "reason": "ok"},
    )
    assert response.status_code == 200
    result = response.json()
    assert result["decision"] == "approved"
    # decidedBy is the server-injected demo operator, NOT the body's approverId.
    assert result["decidedBy"] == "冷库管理员"
    events = (await seeded_client.get("/api/v1/anomaly-events")).json()
    assert next(e for e in events if e["id"] == "evt-1")["stage"] == "approved"


async def test_submit_approval_rejected(seeded_client: AsyncClient, worker) -> None:  # noqa: ANN001
    await _to_simulated(seeded_client, worker)
    req = (await seeded_client.post("/api/v1/control-plans/plan-a/approval-requests")).json()
    response = await seeded_client.post(
        f"/api/v1/approval-requests/{req['id']}/decision",
        json={"decision": "rejected", "approverId": "x", "reason": "no"},
    )
    assert response.status_code == 200
    events = (await seeded_client.get("/api/v1/anomaly-events")).json()
    assert next(e for e in events if e["id"] == "evt-1")["stage"] == "rejected"


async def test_repeat_same_decision_is_idempotent(seeded_client: AsyncClient, worker) -> None:  # noqa: ANN001
    await _to_simulated(seeded_client, worker)
    req = (await seeded_client.post("/api/v1/control-plans/plan-a/approval-requests")).json()
    first = await seeded_client.post(
        f"/api/v1/approval-requests/{req['id']}/decision",
        json={"decision": "approved", "approverId": "x"},
    )
    second = await seeded_client.post(
        f"/api/v1/approval-requests/{req['id']}/decision",
        json={"decision": "approved", "approverId": "x"},
    )
    assert first.status_code == 200 and second.status_code == 200
    assert first.json() == second.json()


async def test_conflicting_decision_returns_409(seeded_client: AsyncClient, worker) -> None:  # noqa: ANN001
    await _to_simulated(seeded_client, worker)
    req = (await seeded_client.post("/api/v1/control-plans/plan-a/approval-requests")).json()
    await seeded_client.post(
        f"/api/v1/approval-requests/{req['id']}/decision",
        json={"decision": "approved", "approverId": "x"},
    )
    conflict_resp = await seeded_client.post(
        f"/api/v1/approval-requests/{req['id']}/decision",
        json={"decision": "rejected", "approverId": "x"},
    )
    assert conflict_resp.status_code == 409
    assert conflict_resp.json()["error"]["code"] == "CONFLICT"


async def test_l3_block_creates_only_audit(seeded, worker) -> None:  # noqa: ANN001
    """An L3 action produces ONLY a SecurityAuditEntry (no plan/approval/command/exec)."""
    from app.application.approval import record_l3_block
    from app.infrastructure.db.models import (
        ApprovalRequest,
        ControlCommand,
        ControlPlan,
        ExecutionTask,
    )

    db = seeded
    before_plans = 2  # seeded plan-a, plan-b
    async with db.session_factory() as session:
        await record_l3_block(
            session, event_id="evt-1", action="关闭压缩机联锁保护以强制满负荷降温"
        )

    async with db.session_factory() as session:
        plans = (await session.execute(select(ControlPlan))).scalars().all()
        approvals = (await session.execute(select(ApprovalRequest))).scalars().all()
        commands = (await session.execute(select(ControlCommand))).scalars().all()
        execs = (await session.execute(select(ExecutionTask))).scalars().all()
    assert len(plans) == before_plans  # no new plan
    assert len(approvals) == 0          # no approval request
    assert len(commands) == 0           # no command
    assert len(execs) == 0              # no execution

    # Audit entries now include the seeded one + this new L3 block.
    assert await _audit_count(seeded) >= 2


async def _audit_count(db) -> int:  # noqa: ANN001
    from app.infrastructure.audit.repository import SecurityAuditRepository

    async with db.session_factory() as session:
        return await SecurityAuditRepository(session).count()


async def test_classify_action_detects_l3() -> None:
    from app.domain.safety import classify_action

    assert classify_action("关闭压缩机联锁保护以强制满负荷降温") == "L3"
    assert classify_action("将目标温度调整为 8℃") == "L2"

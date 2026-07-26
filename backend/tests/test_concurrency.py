"""Concurrent request regression tests for idempotent write operations."""

from __future__ import annotations

import asyncio
from collections import Counter

from httpx import AsyncClient
from sqlalchemy import func, select

from app.infrastructure.db.models import (
    AgentTask,
    AnomalyEvent,
    ApprovalRequest,
    ControlCommand,
    ExecutionTask,
    SimulationResult,
    SimulationRun,
)
from app.infrastructure.db.session import get_database

CONCURRENT_REQUEST_COUNT = 8


async def _drive_diagnosis_to_completion(
    seeded_client: AsyncClient,
    worker,  # noqa: ANN001
) -> None:
    response = await seeded_client.post("/api/v1/anomaly-events/evt-1/diagnosis")
    assert response.status_code == 202

    for _ in range(8):
        await worker.run_once()


async def _drive_simulation_to_completion(
    seeded_client: AsyncClient,
    worker,  # noqa: ANN001
) -> None:
    await _drive_diagnosis_to_completion(seeded_client, worker)
    response = await seeded_client.post("/api/v1/control-plans/plan-a/simulation")
    assert response.status_code == 200


async def _create_pending_approval(
    seeded_client: AsyncClient,
    worker,  # noqa: ANN001
) -> str:
    await _drive_simulation_to_completion(seeded_client, worker)
    response = await seeded_client.post(
        "/api/v1/control-plans/plan-a/approval-requests"
    )
    assert response.status_code == 201
    return str(response.json()["id"])


async def test_concurrent_diagnosis_requests_reuse_one_task(
    seeded_client: AsyncClient,
) -> None:
    responses = await asyncio.gather(
        *[
            seeded_client.post("/api/v1/anomaly-events/evt-1/diagnosis")
            for _ in range(CONCURRENT_REQUEST_COUNT)
        ]
    )

    assert {response.status_code for response in responses} == {202}
    response_task_ids = {response.json()["id"] for response in responses}
    assert len(response_task_ids) == 1

    database = get_database()
    async with database.session_factory() as session:
        active_task_count = int(
            (
                await session.execute(
                    select(func.count(AgentTask.id)).where(
                        AgentTask.event_id == "evt-1",
                        AgentTask.status.in_(("queued", "running")),
                    )
                )
            ).scalar_one()
        )
    assert active_task_count == 1


async def test_concurrent_simulations_reuse_one_result(
    seeded_client: AsyncClient,
    worker,  # noqa: ANN001
) -> None:
    await _drive_diagnosis_to_completion(seeded_client, worker)

    responses = await asyncio.gather(
        *[
            seeded_client.post("/api/v1/control-plans/plan-a/simulation")
            for _ in range(CONCURRENT_REQUEST_COUNT)
        ]
    )

    assert {response.status_code for response in responses} == {200}
    response_payloads = [response.json() for response in responses]
    assert all(payload == response_payloads[0] for payload in response_payloads)

    database = get_database()
    async with database.session_factory() as session:
        result_count = int(
            (
                await session.execute(
                    select(func.count(SimulationResult.id)).where(
                        SimulationResult.plan_id == "plan-a"
                    )
                )
            ).scalar_one()
        )
        run_count = int(
            (
                await session.execute(
                    select(func.count(SimulationRun.id)).where(
                        SimulationRun.plan_id == "plan-a"
                    )
                )
            ).scalar_one()
        )
    assert result_count == 1
    assert run_count == 1


async def test_concurrent_approval_requests_reuse_one_pending_request(
    seeded_client: AsyncClient,
    worker,  # noqa: ANN001
) -> None:
    await _drive_simulation_to_completion(seeded_client, worker)

    responses = await asyncio.gather(
        *[
            seeded_client.post("/api/v1/control-plans/plan-a/approval-requests")
            for _ in range(CONCURRENT_REQUEST_COUNT)
        ]
    )

    assert {response.status_code for response in responses} == {201}
    response_request_ids = {response.json()["id"] for response in responses}
    assert len(response_request_ids) == 1

    database = get_database()
    async with database.session_factory() as session:
        pending_request_count = int(
            (
                await session.execute(
                    select(func.count(ApprovalRequest.id)).where(
                        ApprovalRequest.plan_id == "plan-a",
                        ApprovalRequest.plan_version == 1,
                        ApprovalRequest.status == "pending",
                    )
                )
            ).scalar_one()
        )
    assert pending_request_count == 1


async def test_concurrent_conflicting_approval_decisions_have_one_winner(
    seeded_client: AsyncClient,
    worker,  # noqa: ANN001
) -> None:
    approval_request_id = await _create_pending_approval(seeded_client, worker)

    responses = await asyncio.gather(
        *[
            seeded_client.post(
                f"/api/v1/approval-requests/{approval_request_id}/decision",
                json={
                    "decision": "approved" if request_number % 2 == 0 else "rejected",
                    "approverId": "concurrency-regression-test",
                },
            )
            for request_number in range(CONCURRENT_REQUEST_COUNT)
        ]
    )

    status_counts = Counter(response.status_code for response in responses)
    assert status_counts == Counter({200: 4, 409: 4})

    successful_decisions = {
        response.json()["decision"]
        for response in responses
        if response.status_code == 200
    }
    assert len(successful_decisions) == 1
    winning_decision = successful_decisions.pop()

    database = get_database()
    async with database.session_factory() as session:
        approval_request = await session.get(ApprovalRequest, approval_request_id)
        event = await session.get(AnomalyEvent, "evt-1")

    assert approval_request is not None
    assert event is not None
    assert approval_request.status == winning_decision
    assert event.stage == winning_decision


async def test_concurrent_execution_requests_reuse_one_command_and_task(
    seeded_client: AsyncClient,
    worker,  # noqa: ANN001
) -> None:
    approval_request_id = await _create_pending_approval(seeded_client, worker)
    approval_response = await seeded_client.post(
        f"/api/v1/approval-requests/{approval_request_id}/decision",
        json={"decision": "approved", "approverId": "concurrency-regression-test"},
    )
    assert approval_response.status_code == 200

    responses = await asyncio.gather(
        *[
            seeded_client.post("/api/v1/control-plans/plan-a/execution")
            for _ in range(CONCURRENT_REQUEST_COUNT)
        ]
    )

    assert {response.status_code for response in responses} == {202}
    response_task_ids = {response.json()["id"] for response in responses}
    assert len(response_task_ids) == 1

    database = get_database()
    async with database.session_factory() as session:
        command_count = int(
            (
                await session.execute(
                    select(func.count(ControlCommand.id)).where(
                        ControlCommand.plan_id == "plan-a"
                    )
                )
            ).scalar_one()
        )
        execution_task_count = int(
            (
                await session.execute(
                    select(func.count(ExecutionTask.id)).where(
                        ExecutionTask.plan_id == "plan-a"
                    )
                )
            ).scalar_one()
        )
    assert command_count == 1
    assert execution_task_count == 1

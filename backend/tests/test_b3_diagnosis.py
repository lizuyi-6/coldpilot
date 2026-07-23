"""B3 tests: diagnosis tasks, worker progressive tool reveal, deterministic agent."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from httpx import AsyncClient
from sqlalchemy import select

from app.infrastructure.db.models import AgentTask


async def _drive(worker, times: int = 8) -> None:  # noqa: ANN001
    for _ in range(times):
        await worker.run_once()


async def test_start_diagnosis_creates_queued_task(seeded_client: AsyncClient) -> None:
    response = await seeded_client.post("/api/v1/anomaly-events/evt-1/diagnosis")
    assert response.status_code == 202
    task = response.json()
    assert task["eventId"] == "evt-1"
    assert task["status"] in ("queued", "running")
    assert task["tools"] == []
    # agent metadata is persisted internally (not part of the contract body)


async def test_agent_metadata_persisted(seeded_client: AsyncClient) -> None:
    from app.infrastructure.db.session import get_database

    created = await seeded_client.post("/api/v1/anomaly-events/evt-1/diagnosis")
    task_id = created.json()["id"]
    db = get_database()
    async with db.session_factory() as session:
        row = await session.get(AgentTask, task_id)
        assert row.agent_mode == "deterministic"
        assert row.tool_registry_version == "1"
        assert row.prompt_template_id is not None


async def test_start_diagnosis_idempotent_while_active(seeded_client: AsyncClient) -> None:
    first = await seeded_client.post("/api/v1/anomaly-events/evt-1/diagnosis")
    second = await seeded_client.post("/api/v1/anomaly-events/evt-1/diagnosis")
    assert first.status_code == 202
    assert second.status_code == 202
    assert first.json()["id"] == second.json()["id"]  # same active task returned


async def test_diagnosis_progressive_tool_reveal_then_succeeded(
    seeded_client: AsyncClient, worker  # noqa: ANN001
) -> None:
    created = await seeded_client.post("/api/v1/anomaly-events/evt-1/diagnosis")
    task_id = created.json()["id"]

    # After a couple of ticks, some (not all) tools should be revealed.
    await _drive(worker, 2)
    partial = (await seeded_client.get(f"/api/v1/agent-tasks/{task_id}")).json()
    assert partial["status"] == "running"
    assert 0 < len(partial["tools"]) < 5

    # Drive to completion (5 tools + finalize).
    await _drive(worker, 6)
    done = (await seeded_client.get(f"/api/v1/agent-tasks/{task_id}")).json()
    assert done["status"] == "succeeded"
    assert len(done["tools"]) == 5
    tool_names = [t["name"] for t in done["tools"]]
    assert tool_names == [
        "telemetry.query", "doorlog.query", "devicelog.query", "knowledge.search", "cases.search"
    ]
    # Full structured IO was persisted (returned summaries are non-empty).
    assert all(t["outputSummary"] for t in done["tools"])


async def test_diagnosis_result_has_ranked_causes_with_evidence(
    seeded_client: AsyncClient, worker  # noqa: ANN001
) -> None:
    created = await seeded_client.post("/api/v1/anomaly-events/evt-1/diagnosis")
    task_id = created.json()["id"]
    await _drive(worker, 8)

    response = await seeded_client.get(f"/api/v1/agent-tasks/{task_id}/diagnosis-result")
    assert response.status_code == 200
    result = response.json()
    assert result["eventId"] == "evt-1"
    labels = [c["label"] for c in result["causes"]]
    assert "入库热量负荷" in labels
    assert "库门长时间开启" in labels
    assert "压缩机效率下降" in labels
    # triageOrder ascending + confidence in [0,1]
    orders = [c["triageOrder"] for c in result["causes"]]
    assert orders == sorted(orders)
    assert all(0.0 <= c["confidence"] <= 1.0 for c in result["causes"])
    # every cause has at least one evidence with a tool sourceRef
    assert all(c["evidence"] for c in result["causes"])
    assert all(e["sourceRef"] for c in result["causes"] for e in c["evidence"])


async def test_get_diagnosis_result_before_completion_is_409(
    seeded_client: AsyncClient, worker  # noqa: ANN001
) -> None:
    created = await seeded_client.post("/api/v1/anomaly-events/evt-1/diagnosis")
    task_id = created.json()["id"]
    await _drive(worker, 1)
    response = await seeded_client.get(f"/api/v1/agent-tasks/{task_id}/diagnosis-result")
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "INVALID_STATE"


async def test_diagnosis_advances_event_stage(seeded_client: AsyncClient, worker) -> None:  # noqa: ANN001
    await seeded_client.post("/api/v1/anomaly-events/evt-1/diagnosis")
    await _drive(worker, 8)
    events = (await seeded_client.get("/api/v1/anomaly-events")).json()
    evt1 = next(e for e in events if e["id"] == "evt-1")
    assert evt1["stage"] == "diagnosisCompleted"


async def test_deterministic_agent_is_deterministic(seeded_client: AsyncClient, worker) -> None:  # noqa: ANN001
    """Same input -> same semantic output across two independent diagnosis runs."""
    from app.application.diagnosis import get_diagnosis_result
    from app.infrastructure.db.session import get_database

    def signature(result):  # noqa: ANN001
        return {
            "understanding": result.understanding,
            "dataSources": list(result.dataSources),
            "uncertainties": list(result.uncertainties),
            "causes": sorted(
                (
                    {
                        "label": c.label,
                        "confidence": c.confidence,
                        "triageOrder": c.triageOrder,
                        "evidence": sorted((e.kind, e.summary, e.sourceRef) for e in c.evidence),
                        "checks": list(c.recommendedChecks),
                    }
                    for c in result.causes
                ),
                key=lambda c: c["triageOrder"],
            ),
        }

    created = await seeded_client.post("/api/v1/anomaly-events/evt-1/diagnosis")
    first_id = created.json()["id"]
    await _drive(worker, 8)

    db = get_database()
    async with db.session_factory() as session:
        first = signature(await get_diagnosis_result(session, first_id))

    # Second run (previous task is terminal -> new task allowed).
    created2 = await seeded_client.post("/api/v1/anomaly-events/evt-1/diagnosis")
    second_id = created2.json()["id"]
    assert second_id != first_id
    await _drive(worker, 8)
    async with db.session_factory() as session:
        second = signature(await get_diagnosis_result(session, second_id))

    assert first == second


async def test_queued_task_recovers_after_restart(seeded, worker) -> None:  # noqa: ANN001
    """A queued task left unprocessed is picked up by a fresh worker (restart)."""
    from app.application.diagnosis import start_diagnosis
    from app.infrastructure.tasks.runtime import reset_worker

    db = seeded
    async with db.session_factory() as session:
        task = await start_diagnosis(session, "evt-1")
        task_id = task.id
    # Simulate process restart: drop the worker, build a new one, run ticks.
    await worker.stop()
    reset_worker()
    from app.infrastructure.tasks.handlers import register_all
    from app.infrastructure.tasks.runtime import get_worker

    new_worker = get_worker()
    register_all(new_worker)
    await _drive(new_worker, 8)
    await new_worker.stop()

    async with db.session_factory() as session:
        row = (await session.execute(select(AgentTask).where(AgentTask.id == task_id))).scalar_one()
        assert row.status == "succeeded"


async def test_stale_running_task_is_requeued(seeded, worker) -> None:  # noqa: ANN001
    """A running task older than the stale timeout is reset to queued."""
    from app.application.diagnosis import DiagnosisHandler
    from app.infrastructure.tools.tools import build_tool_registry

    db = seeded
    # Manually insert a running task with an old started_at.
    async with db.session_factory() as session:
        from sqlalchemy import select as _select

        from app.infrastructure.db.models import AnomalyEvent

        evt = (await session.execute(_select(AnomalyEvent).where(AnomalyEvent.id == "evt-1"))).scalar_one()
        evt.stage = "diagnosing"
        task = AgentTask(
            id="task-stale",
            event_id="evt-1",
            goal="x",
            status="running",
            started_at=datetime.now(UTC) - timedelta(seconds=9999),
        )
        session.add(task)
        await session.commit()

    handler = DiagnosisHandler(build_tool_registry())
    async with db.session_factory() as session:
        affected = await handler.recover_stale(session, stale_timeout_seconds=120.0)
        assert affected == 1
    async with db.session_factory() as session:
        row = await session.get(AgentTask, "task-stale")
        assert row.status == "queued"
        assert row.started_at is None

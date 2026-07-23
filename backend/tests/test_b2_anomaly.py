"""B2 tests: anomaly event query endpoints (5 read endpoints) over seeded data."""

from __future__ import annotations

from httpx import AsyncClient


async def test_list_anomaly_events(seeded_client: AsyncClient) -> None:
    response = await seeded_client.get("/api/v1/anomaly-events")
    assert response.status_code == 200
    events = response.json()
    assert len(events) == 3
    evt1 = next(e for e in events if e["id"] == "evt-1")
    assert evt1["roomName"] == "1号辣椒库"
    assert evt1["stage"] == "detected"
    # awaitingApproval is derived from stage (detected -> False)
    assert evt1["awaitingApproval"] is False


async def test_get_anomaly_event_detail(seeded_client: AsyncClient) -> None:
    response = await seeded_client.get("/api/v1/anomaly-events/evt-1")
    assert response.status_code == 200
    detail = response.json()
    assert detail["id"] == "evt-1"
    assert detail["room"]["id"] == "room-1"
    # deviceIds / sensorIds are derived from relations, not stored arrays
    assert set(detail["room"]["deviceIds"]) >= {"dev-compressor-1", "dev-fan-1"}
    assert set(detail["room"]["sensorIds"]) >= {"sen-temp-1", "sen-hum-1"}
    assert len(detail["devices"]) == 5
    assert len(detail["inventory"]) == 2
    assert len(detail["telemetry"]) == 5
    temp_series = next(t for t in detail["telemetry"] if t["metric"] == "temperature")
    assert temp_series["target"]["min"] == 8
    assert len(temp_series["points"]) > 0
    assert temp_series["points"][0]["t"].endswith("Z")
    assert len(detail["roomEvents"]) == 5


async def test_get_anomaly_event_not_found(seeded_client: AsyncClient) -> None:
    response = await seeded_client.get("/api/v1/anomaly-events/nope")
    assert response.status_code == 404
    body = response.json()
    assert body["error"]["code"] == "NOT_FOUND"
    assert body["error"]["requestId"]


async def test_list_control_plans(seeded_client: AsyncClient) -> None:
    response = await seeded_client.get("/api/v1/anomaly-events/evt-1/control-plans")
    assert response.status_code == 200
    plans = response.json()
    ids = {p["id"] for p in plans}
    assert ids == {"plan-a", "plan-b"}
    plan_a = next(p for p in plans if p["id"] == "plan-a")
    assert plan_a["approvalLevel"] == "L2"
    assert plan_a["version"] == 1
    keys = {p["key"] for p in plan_a["params"]}
    assert "targetTemp" in keys
    assert plan_a["rollbackConditions"]


async def test_get_event_report(seeded_client: AsyncClient) -> None:
    response = await seeded_client.get("/api/v1/anomaly-events/evt-1/report")
    assert response.status_code == 200
    report = response.json()
    assert report["eventId"] == "evt-1"
    assert report["provenance"] == "demo"
    assert report["approval"]["level"] == "L2"
    assert report["generatedAt"].endswith("Z")


async def test_get_event_report_not_found(seeded_client: AsyncClient) -> None:
    response = await seeded_client.get("/api/v1/anomaly-events/evt-2/report")
    assert response.status_code == 404


async def test_list_security_audit_includes_l3_block(seeded_client: AsyncClient) -> None:
    response = await seeded_client.get("/api/v1/anomaly-events/evt-1/security-audit")
    assert response.status_code == 200
    entries = response.json()
    assert len(entries) == 1
    entry = entries[0]
    assert entry["approvalLevel"] == "L3"
    assert entry["outcome"] == "blocked"
    assert entry["category"] == "blocked_action"


async def test_awaiting_approval_true_when_stage_awaiting(db) -> None:  # noqa: ANN001

    from app.infrastructure.db.models import AnomalyEvent
    from app.seed.demo_data import seed_database

    async with db.session_factory() as session:
        await seed_database(session)
    async with db.session_factory() as session:
        evt = await session.get(AnomalyEvent, "evt-1")
        evt.stage = "awaitingApproval"
        await session.commit()
    # Derived via query layer
    from app.application.queries import list_anomaly_events

    async with db.session_factory() as session:
        events = await list_anomaly_events(session)
    evt1 = next(e for e in events if e.id == "evt-1")
    assert evt1.awaitingApproval is True

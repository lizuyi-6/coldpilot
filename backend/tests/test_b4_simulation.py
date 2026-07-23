"""B4 tests: control plan simulation (synchronous), version binding, reuse, guards."""

from __future__ import annotations

from httpx import AsyncClient


async def _diagnose(seeded_client: AsyncClient, worker) -> str:  # noqa: ANN001
    created = await seeded_client.post("/api/v1/anomaly-events/evt-1/diagnosis")
    task_id = created.json()["id"]
    for _ in range(8):
        await worker.run_once()
    return task_id


async def test_run_simulation_succeeds_after_diagnosis(
    seeded_client: AsyncClient, worker  # noqa: ANN001
) -> None:
    await _diagnose(seeded_client, worker)
    response = await seeded_client.post("/api/v1/control-plans/plan-a/simulation")
    assert response.status_code == 200
    result = response.json()
    assert result["planId"] == "plan-a"
    assert result["planVersion"] == 1
    assert result["provenance"] == "simulated"
    assert result["recoveryHours"] > 0
    assert result["energyKWh"] > 0
    assert result["overshootRisk"] in ("low", "medium", "high")
    assert result["frostRisk"] in ("low", "medium", "high")
    assert result["compressorCycles"] >= 1
    assert len(result["predictedSeries"]) > 1
    assert result["predictedSeries"][0]["t"].endswith("Z")
    # series trends from start toward target (monotonic-ish decrease for cooling)
    first, last = result["predictedSeries"][0]["value"], result["predictedSeries"][-1]["value"]
    assert last < first


async def test_simulation_blocked_before_diagnosis(seeded_client: AsyncClient) -> None:
    response = await seeded_client.post("/api/v1/control-plans/plan-a/simulation")
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "INVALID_STATE"


async def test_simulation_reuse_same_plan_version(
    seeded_client: AsyncClient, worker  # noqa: ANN001
) -> None:
    await _diagnose(seeded_client, worker)
    first = await seeded_client.post("/api/v1/control-plans/plan-a/simulation")
    second = await seeded_client.post("/api/v1/control-plans/plan-a/simulation")
    assert first.status_code == 200 and second.status_code == 200
    # Identical result reused (same immutable row).
    assert first.json() == second.json()


async def test_simulation_ab_binds_to_version_and_advances_stage(
    seeded_client: AsyncClient, worker  # noqa: ANN001
) -> None:
    await _diagnose(seeded_client, worker)
    a = (await seeded_client.post("/api/v1/control-plans/plan-a/simulation")).json()
    events = (await seeded_client.get("/api/v1/anomaly-events")).json()
    assert next(e for e in events if e["id"] == "evt-1")["stage"] == "simulationCompleted"
    # Simulate plan B as well (A/B comparison). Stage stays simulationCompleted.
    b = (await seeded_client.post("/api/v1/control-plans/plan-b/simulation")).json()
    assert a["planId"] != b["planId"]
    assert a["planVersion"] == 1 and b["planVersion"] == 1


async def test_simulation_plan_not_found(seeded_client: AsyncClient, worker) -> None:  # noqa: ANN001
    await _diagnose(seeded_client, worker)
    response = await seeded_client.post("/api/v1/control-plans/nope/simulation")
    assert response.status_code == 404


async def test_simulator_is_deterministic() -> None:
    from app.infrastructure.simulator.thermal import simulate

    kwargs = dict(
        start_temp=10.6, target_temp=8.0, rate_cap=0.5,
        fan_mode="中速", valve_opening=60, min_temp_c=5,
    )
    out1 = simulate(**kwargs)
    out2 = simulate(**kwargs)
    assert out1.recovery_hours == out2.recovery_hours
    assert out1.energy_kwh == out2.energy_kwh
    assert out1.predicted_series[0]["value"] == out2.predicted_series[0]["value"]
    # more aggressive plan recovers faster
    fast = simulate(start_temp=10.6, target_temp=7.5, rate_cap=1.5, fan_mode="高速",
                    valve_opening=85, min_temp_c=5)
    assert fast.recovery_hours < out1.recovery_hours
    assert fast.compressor_cycles >= 1

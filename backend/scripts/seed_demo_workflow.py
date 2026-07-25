"""Reset the demo database and drive the full workflow so every contract
endpoint returns coherent demo data for documentation and screenshots.

What it does, end to end:

  1. Stops any in-process worker / DB engine, deletes the SQLite file, and
     re-creates the schema via Alembic (`alembic upgrade head`).
  2. Loads the frozen demo seed (rooms, sensors, devices, inventory, telemetry,
     events, plans, L3 audit entry, evt-1 demo report).
  3. Drives a complete happy-path for ``evt-1`` (1号辣椒库 · 持续高温):
       diagnosis -> simulation(plan-a) -> approval request -> approve
       -> execution -> verifying -> recovered (auto-generates a fresh report).
     Also simulates the alternative ``plan-b`` so the strategy page can show
     a comparison.
  4. Drives a partial flow for ``evt-2`` (2号芒果库 · 湿度偏高): only the
     diagnosis runs, so the event stays at ``diagnosisCompleted`` and gives
     the docs a non-terminal example.

``evt-3`` (3号葡萄库 · 压差波动) is intentionally left in its seeded
``recovered`` state with no report, which is the documented "unavailable"
case for ``GET /anomaly-events/{eventId}/report``.

Idempotent: each step uses the contract endpoint semantics (idempotency keys,
pending-checks, version guards), so re-running on an already-driven database
is a no-op for the workflow portion. To get a fully fresh dataset, delete
``data/coldpilot.db`` before running (or pass ``--reset``).

Usage (from backend/):

    .venv\\Scripts\\python scripts\\seed_demo_workflow.py
    .venv\\Scripts\\python scripts\\seed_demo_workflow.py --reset
"""

from __future__ import annotations

import argparse
import asyncio
import os
import sys
from pathlib import Path
from typing import Any

# Ensure backend/ is importable as the project root when running this script.
BACKEND_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_ROOT))

# Force deterministic agent (no external LLM calls) before importing the app.
os.environ.setdefault("AGENT_MODE", "deterministic")

from httpx import ASGITransport, AsyncClient  # noqa: E402

from app.config import get_settings  # noqa: E402
from app.infrastructure.db.session import get_database  # noqa: E402
from app.infrastructure.logging import configure_logging, get_logger  # noqa: E402
from app.infrastructure.tasks.handlers import register_all  # noqa: E402
from app.infrastructure.tasks.runtime import get_worker, reset_worker  # noqa: E402

log = get_logger("seed_demo_workflow")

API = "/api/v1"

# How many worker ticks to wait between workflow steps. Diagnosis needs ~8 ticks
# (one per tool invocation); execution needs ~7 (5 executing + verifying +
# finalize). We poll generously and break early on terminal states.
DIAGNOSIS_TICKS = 12
EXECUTION_TICKS = 16


# --------------------------------------------------------------------------- #
# Reset helpers
# --------------------------------------------------------------------------- #


def _resolve_db_path() -> Path:
    """Resolve the SQLite file path from the configured DATABASE_URL."""
    url = get_settings().database_url
    marker = ":///"
    if marker not in url:
        raise SystemExit(f"DATABASE_URL is not a file-based SQLite URL: {url}")
    relative = url.split(marker, 1)[1]
    return (BACKEND_ROOT / relative).resolve()


def reset_database() -> None:
    """Delete the SQLite file (and WAL/shm sidecars), then recreate the schema."""
    import subprocess  # noqa: PLC0415

    db_path = _resolve_db_path()
    for suffix in ("", "-wal", "-shm"):
        candidate = db_path.with_suffix(db_path.suffix + suffix) if suffix else db_path
        if candidate.exists():
            log.info("reset.removing_db_file", path=str(candidate))
            candidate.unlink()

    # Shell out to the alembic CLI (same path as the README / DELIVERY_REPORT)
    # so the script never drifts from the documented setup steps. Must run from
    # backend/ so the relative SQLite URL resolves correctly.
    venv_python = str(BACKEND_ROOT / ".venv" / "Scripts" / "python.exe")
    if not Path(venv_python).exists():
        venv_python = sys.executable
    log.info("reset.alembic_upgrade_head")
    result = subprocess.run(
        [venv_python, "-m", "alembic", "upgrade", "head"],
        cwd=str(BACKEND_ROOT),
        check=False,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        sys.stderr.write(result.stdout)
        sys.stderr.write(result.stderr)
        raise SystemExit(f"alembic upgrade head failed (exit {result.returncode})")


# --------------------------------------------------------------------------- #
# Workflow driver
# --------------------------------------------------------------------------- #


async def _drain_worker(rounds: int) -> None:
    """Run the worker synchronously for ``rounds`` ticks so async tasks
    (diagnosis / execution) progress to a terminal state."""
    worker = get_worker()
    for _ in range(rounds):
        await worker.run_once()


async def _seed_demo_data() -> None:
    """Idempotently load the frozen demo seed into the current database."""
    from app.seed.demo_data import seed_database  # noqa: PLC0415

    db = get_database()
    async with db.session_factory() as session:
        await seed_database(session)


async def _get(client: AsyncClient, path: str) -> Any:
    response = await client.get(f"{API}{path}")
    response.raise_for_status()
    return response.json()


async def _post(client: AsyncClient, path: str, **kwargs: Any) -> Any:
    response = await client.post(f"{API}{path}", **kwargs)
    if response.status_code not in (200, 201, 202):
        raise RuntimeError(
            f"POST {path} failed: {response.status_code} {response.text}"
        )
    return response.json()


async def drive_evt1_happy_path(client: AsyncClient) -> dict[str, str]:
    """Drive evt-1 from `detected` through `recovered`."""
    summary: dict[str, str] = {}

    # 1. Diagnosis ---------------------------------------------------------
    task = await _post(client, "/anomaly-events/evt-1/diagnosis")
    summary["agent_task_id"] = task["id"]
    await _drain_worker(DIAGNOSIS_TICKS)
    task = await _get(client, f"/agent-tasks/{summary['agent_task_id']}")
    if task["status"] != "succeeded":
        raise RuntimeError(f"evt-1 diagnosis did not succeed: {task}")
    result = await _get(client, f"/agent-tasks/{summary['agent_task_id']}/diagnosis-result")
    summary["diagnosis_causes"] = str(len(result.get("causes", [])))

    # 2. Simulation on both plans -----------------------------------------
    sim_a = await _post(client, "/control-plans/plan-a/simulation")
    summary["sim_a_recovery_hours"] = f"{sim_a['recoveryHours']:.1f}"
    # plan-b can simulate after plan-a because the event-level guard only
    # requires diagnosis to have completed; each plan keeps its own sim result.
    sim_b = await _post(client, "/control-plans/plan-b/simulation")
    summary["sim_b_recovery_hours"] = f"{sim_b['recoveryHours']:.1f}"

    # 3. Approval ----------------------------------------------------------
    approval_request = await _post(client, "/control-plans/plan-a/approval-requests")
    summary["approval_request_id"] = approval_request["id"]
    decision = await _post(
        client,
        f"/approval-requests/{summary['approval_request_id']}/decision",
        json={
            "decision": "approved",
            "approverId": "demo-cold-room-admin",
            "reason": "方案 A 仿真指标安全，准予执行",
        },
    )
    summary["approval_decided_by"] = decision["decidedBy"]

    # 4. Execution ---------------------------------------------------------
    execution = await _post(client, "/control-plans/plan-a/execution")
    summary["execution_task_id"] = execution["id"]
    await _drain_worker(EXECUTION_TICKS)
    execution = await _get(client, f"/execution-tasks/{summary['execution_task_id']}")
    summary["execution_status"] = execution["status"]
    if execution["status"] != "recovered":
        raise RuntimeError(f"evt-1 execution did not recover: {execution}")
    summary["recovery_minutes"] = str(execution["recoveryMinutes"])

    # 5. Report should now exist ------------------------------------------
    report = await _get(client, "/anomaly-events/evt-1/report")
    summary["report_id"] = report["id"]
    return summary


async def drive_evt2_diagnosis_only(client: AsyncClient) -> dict[str, str]:
    """Drive evt-2 only through diagnosis, so it stays in a non-terminal
    stage (`diagnosisCompleted`) for the docs' "in-progress" example."""
    summary: dict[str, str] = {}
    task = await _post(client, "/anomaly-events/evt-2/diagnosis")
    summary["agent_task_id"] = task["id"]
    await _drain_worker(DIAGNOSIS_TICKS)
    task = await _get(client, f"/agent-tasks/{summary['agent_task_id']}")
    summary["final_status"] = task["status"]
    if task["status"] != "succeeded":
        raise RuntimeError(f"evt-2 diagnosis did not succeed: {task}")
    result = await _get(client, f"/agent-tasks/{summary['agent_task_id']}/diagnosis-result")
    summary["diagnosis_causes"] = str(len(result.get("causes", [])))
    return summary


async def verify_all_endpoints(client: AsyncClient) -> None:
    """Hit every contract endpoint one more time to confirm they answer 200."""
    checks = [
        ("GET", "/anomaly-events", None),
        ("GET", "/anomaly-events/evt-1", None),
        ("GET", "/anomaly-events/evt-1/control-plans", None),
        ("GET", "/anomaly-events/evt-1/report", None),
        ("GET", "/anomaly-events/evt-1/security-audit", None),
        ("GET", "/anomaly-events/evt-2", None),
        ("GET", "/anomaly-events/evt-3", None),
    ]
    for method, path, _ in checks:
        response = await client.get(f"{API}{path}")
        status = response.status_code
        flag = "OK" if status == 200 else "!!"
        log.info("verify.endpoint", method=method, path=path, status=status, flag=flag)


# --------------------------------------------------------------------------- #
# Entry point
# --------------------------------------------------------------------------- #


async def amain(reset: bool) -> None:
    configure_logging(json_logs=False, level="INFO")

    if reset:
        reset_database()
    else:
        log.info("reset.skipped (use --reset for a fresh database)")

    # Seed always (idempotent).
    await _seed_demo_data()

    # Build a worker with all handlers; we drive it deterministically here so
    # the script does not depend on the uvicorn lifespan being up.
    reset_worker()
    worker = get_worker()
    register_all(worker)

    try:
        from app.main import app  # noqa: PLC0415

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://seed") as client:
            log.info("workflow.evt1.start")
            evt1 = await drive_evt1_happy_path(client)
            log.info("workflow.evt1.done", **evt1)

            log.info("workflow.evt2.start")
            evt2 = await drive_evt2_diagnosis_only(client)
            log.info("workflow.evt2.done", **evt2)

            log.info("verify.start")
            await verify_all_endpoints(client)
    finally:
        await worker.stop()
        await get_database().dispose()

    print()
    print("=" * 60)
    print("Demo workflow seeded successfully.")
    print("=" * 60)
    print(f"  evt-1 (1号辣椒库 · 持续高温):")
    for key, value in evt1.items():
        print(f"    {key:<22} = {value}")
    print(f"  evt-2 (2号芒果库 · 湿度偏高):")
    for key, value in evt2.items():
        print(f"    {key:<22} = {value}")
    print()
    print("evt-3 (3号葡萄库 · 压差波动) stays in seeded `recovered` with no report.")
    print("Start uvicorn for screenshots:")
    print("  cd X:\\xianniu\\backend")
    print("  .venv\\Scripts\\python -m uvicorn app.main:app --port 8000")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Delete the SQLite file and re-run alembic upgrade head before seeding.",
    )
    args = parser.parse_args()
    asyncio.run(amain(reset=args.reset))


if __name__ == "__main__":
    main()

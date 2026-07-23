"""B8 contract tests: FastAPI implementation matches the frozen OpenAPI.

- Path/method parity: every frozen contract path+method is served under /api/v1,
  and the internal health endpoint is excluded from the business contract set.
- Response conformance: seeded GET responses validate against the frozen
  response JSON schemas (jsonschema with $ref resolution against the contract).
"""

from __future__ import annotations

from pathlib import Path

import jsonschema
import yaml
from fastapi.routing import APIRoute
from httpx import AsyncClient

CONTRACT_PATH = Path(__file__).resolve().parents[2] / "docs" / "contracts" / "openapi.frontend-draft.yaml"


def _load_contract() -> dict:
    with CONTRACT_PATH.open(encoding="utf-8") as handle:
        return yaml.safe_load(handle)


def _fastapi_business_routes(app) -> set[tuple[str, str]]:  # noqa: ANN001
    routes: set[tuple[str, str]] = set()
    for route in app.routes:
        if not isinstance(route, APIRoute):
            continue
        path = route.path
        if not path.startswith("/api/v1"):
            continue  # exclude /internal/health and docs
        contract_path = path[len("/api/v1"):]
        for method in route.methods:
            if method == "HEAD":
                continue
            routes.add((contract_path, method.lower()))
    return routes


def test_fastapi_serves_all_contract_paths() -> None:
    from app.main import app

    contract = _load_contract()
    expected: set[tuple[str, str]] = set()
    for path, item in contract["paths"].items():
        for method in item:
            expected.add((path, method.lower()))

    actual = _fastapi_business_routes(app)
    missing = expected - actual
    assert not missing, f"contract paths missing from FastAPI: {sorted(missing)}"


def test_internal_health_is_not_a_contract_path() -> None:
    from app.main import app

    paths = {route.path for route in app.routes if isinstance(route, APIRoute)}
    assert "/internal/health" in paths
    assert all(not p.startswith("/api/v1/internal") for p in paths)


def _response_schema(contract: dict, path: str, method: str, status: str) -> dict:
    return contract["paths"][path][method]["responses"][str(status)]["content"]["application/json"]["schema"]


async def _assert_valid(contract: dict, response_json: object, path: str, method: str, status: str) -> None:
    schema = _response_schema(contract, path, method, status)
    resolver = jsonschema.RefResolver.from_schema(contract)
    jsonschema.validate(instance=response_json, schema=schema, resolver=resolver)


async def test_get_list_anomaly_events_conforms(seeded_client: AsyncClient) -> None:  # noqa: ANN001
    contract = _load_contract()
    response = await seeded_client.get("/api/v1/anomaly-events")
    assert response.status_code == 200
    await _assert_valid(contract, response.json(), "/anomaly-events", "get", 200)


async def test_get_anomaly_event_detail_conforms(seeded_client: AsyncClient) -> None:  # noqa: ANN001
    contract = _load_contract()
    response = await seeded_client.get("/api/v1/anomaly-events/evt-1")
    assert response.status_code == 200
    await _assert_valid(contract, response.json(), "/anomaly-events/{eventId}", "get", 200)


async def test_get_control_plans_conforms(seeded_client: AsyncClient) -> None:  # noqa: ANN001
    contract = _load_contract()
    response = await seeded_client.get("/api/v1/anomaly-events/evt-1/control-plans")
    assert response.status_code == 200
    await _assert_valid(contract, response.json(), "/anomaly-events/{eventId}/control-plans", "get", 200)


async def test_get_event_report_conforms(seeded_client: AsyncClient) -> None:  # noqa: ANN001
    contract = _load_contract()
    response = await seeded_client.get("/api/v1/anomaly-events/evt-1/report")
    assert response.status_code == 200
    await _assert_valid(contract, response.json(), "/anomaly-events/{eventId}/report", "get", 200)


async def test_get_security_audit_conforms(seeded_client: AsyncClient) -> None:  # noqa: ANN001
    contract = _load_contract()
    response = await seeded_client.get("/api/v1/anomaly-events/evt-1/security-audit")
    assert response.status_code == 200
    await _assert_valid(contract, response.json(), "/anomaly-events/{eventId}/security-audit", "get", 200)

"""Domain enums / constants mirroring the frozen frontend contract.

These are the SSOT for string values used across the backend. They MUST stay
in sync with the frozen OpenAPI enum values. ``queued`` (not ``pending``) is the
external contract value for queued task state.
"""

from __future__ import annotations

# --- Anomaly / workflow stage (the single source of truth on anomaly_events) ---
TASK_STATUSES = frozenset(
    {
        "detected",
        "diagnosing",
        "diagnosisCompleted",
        "simulating",
        "simulationCompleted",
        "awaitingApproval",
        "approved",
        "rejected",
        "executing",
        "verifying",
        "recovered",
        "diagnosisFailed",
        "simulationFailed",
        "executionFailed",
        "safeFallback",
    }
)

# Stages in which approval is actively pending -> awaitingApproval == True.
AWAITING_APPROVAL_STAGES = frozenset({"awaitingApproval"})


def awaiting_approval_from_stage(stage: str) -> bool:
    """Derive the ``awaitingApproval`` flag from the persisted ``stage``."""
    return stage in AWAITING_APPROVAL_STAGES


# --- Severity / risk / approval level / provenance ---
SEVERITIES = frozenset({"notice", "warning", "critical", "emergency"})
RISK_LEVELS = frozenset({"low", "medium", "high"})
APPROVAL_LEVELS = frozenset({"L0", "L1", "L2", "L3"})
PROVENANCES = frozenset({"demo", "simulated", "pilot", "real"})

# --- Agent task status (queued is the external contract value) ---
AGENT_TASK_STATUSES = frozenset({"queued", "running", "succeeded", "failed"})

# --- Execution task status ---
EXECUTION_STATUSES = frozenset({"queued", "executing", "verifying", "recovered", "failed"})

# --- Metrics ---
METRIC_KEYS = frozenset({"temperature", "humidity", "o2", "co2", "pressureDiff"})

# --- Safety check keys (frozen) ---
SAFETY_CHECK_KEYS = frozenset({"whitelist", "bounds", "rate", "conflict", "permission"})


# --- Workflow stage machine (backend mirror of the frontend workbench machine) ---
# Maps each stage to the set of stages it may legally transition to. This mirrors
# the guards in workbenchMachine.ts so the backend independently enforces the
# same impossible-state invariants. The API/state services consult this.
ALLOWED_TRANSITIONS: dict[str, frozenset[str]] = {
    "detected": frozenset({"diagnosing", "safeFallback"}),
    "diagnosing": frozenset(
        {"diagnosisCompleted", "diagnosisFailed", "safeFallback"}
    ),
    "diagnosisFailed": frozenset({"diagnosing", "safeFallback"}),
    "diagnosisCompleted": frozenset(
        {"simulating", "diagnosing", "safeFallback"}
    ),
    "simulating": frozenset(
        {"simulationCompleted", "simulationFailed", "safeFallback"}
    ),
    "simulationFailed": frozenset(
        {"simulating", "safeFallback"}
    ),
    "simulationCompleted": frozenset(
        {"awaitingApproval", "simulating", "safeFallback"}
    ),
    "awaitingApproval": frozenset(
        {"approved", "rejected", "safeFallback"}
    ),
    "approved": frozenset({"executing", "safeFallback"}),
    "rejected": frozenset({"simulating", "safeFallback"}),
    "executing": frozenset({"verifying", "executionFailed", "safeFallback"}),
    "verifying": frozenset({"recovered", "executionFailed", "safeFallback"}),
    "executionFailed": frozenset({"simulating", "safeFallback"}),
    "recovered": frozenset(),
    "safeFallback": frozenset(),
}


def can_transition(from_stage: str, to_stage: str) -> bool:
    return to_stage in ALLOWED_TRANSITIONS.get(from_stage, frozenset())

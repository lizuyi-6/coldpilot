"""Append-only security audit hash chain.

Provides auditability, traceability and basic tamper-evidence by chaining each
entry's ``entry_hash`` to the previous entry's hash. This is NOT cryptographic
non-repudiation — it only makes tampering detectable.

The repository exposes append + verify only (no update/delete), see
``app.infrastructure.audit.repository``.
"""

from __future__ import annotations

import hashlib
import json
from typing import Any


def _canonical(payload: dict[str, Any]) -> str:
    return json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def compute_entry_hash(
    *,
    sequence_number: int,
    previous_hash: str | None,
    event_id: str | None,
    category: str,
    action: str,
    source: str,
    attempted_at: str,
    approval_level: str,
    triggered_rule: str,
    rule_version: str | None,
    reason: str,
    outcome: str,
    correlation_id: str | None,
) -> str:
    """SHA-256 over the canonical JSON of the entry's immutable fields."""
    payload = {
        "sequence_number": sequence_number,
        "previous_hash": previous_hash,
        "event_id": event_id,
        "category": category,
        "action": action,
        "source": source,
        "attempted_at": attempted_at,
        "approval_level": approval_level,
        "triggered_rule": triggered_rule,
        "rule_version": rule_version,
        "reason": reason,
        "outcome": outcome,
        "correlation_id": correlation_id,
    }
    return hashlib.sha256(_canonical(payload).encode("utf-8")).hexdigest()

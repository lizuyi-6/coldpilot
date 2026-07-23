"""Append-only security audit repository.

Deliberately exposes ONLY ``append`` / ``list_for_event`` / ``verify_chain``.
There is no update or delete path here; tampering is detectable via the hash
chain but this is not cryptographic non-repudiation.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.audit.hashchain import compute_entry_hash
from app.infrastructure.db.models import SecurityAuditEntry
from app.infrastructure.logging import get_logger

log = get_logger(__name__)


def _iso(value: datetime | None) -> str | None:
    return value.astimezone(UTC).isoformat().replace("+00:00", "Z") if value else None


class SecurityAuditRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def append(
        self,
        *,
        event_id: str | None,
        category: str,
        action: str,
        source: str,
        approval_level: str,
        triggered_rule: str,
        reason: str,
        outcome: str,
        rule_version: str | None = None,
        correlation_id: str | None = None,
        attempted_at: datetime | None = None,
    ) -> SecurityAuditEntry:
        attempted_at = attempted_at or datetime.now(UTC)

        # Next sequence number + previous hash under a row lock to keep the chain
        # consistent under concurrency (single worker, but be safe).
        last_seq = (
            await self.session.execute(select(func.max(SecurityAuditEntry.sequence_number)))
        ).scalar_one()
        sequence_number = (last_seq or 0) + 1
        previous_hash = None
        if sequence_number > 1:
            prev = (
                await self.session.execute(
                    select(SecurityAuditEntry.entry_hash).where(
                        SecurityAuditEntry.sequence_number == sequence_number - 1
                    )
                )
            ).scalar_one_or_none()
            previous_hash = prev

        entry_hash = compute_entry_hash(
            sequence_number=sequence_number,
            previous_hash=previous_hash,
            event_id=event_id,
            category=category,
            action=action,
            source=source,
            attempted_at=_iso(attempted_at) or "",
            approval_level=approval_level,
            triggered_rule=triggered_rule,
            rule_version=rule_version,
            reason=reason,
            outcome=outcome,
            correlation_id=correlation_id,
        )

        entry = SecurityAuditEntry(
            id=f"audit-{sequence_number}",
            event_id=event_id,
            category=category,
            action=action,
            source=source,
            attempted_at=attempted_at,
            approval_level=approval_level,
            triggered_rule=triggered_rule,
            rule_version=rule_version,
            reason=reason,
            outcome=outcome,
            sequence_number=sequence_number,
            previous_hash=previous_hash,
            entry_hash=entry_hash,
            correlation_id=correlation_id,
        )
        self.session.add(entry)
        await self.session.flush()
        log.info(
            "audit.appended",
            sequence=sequence_number,
            event_id=event_id,
            category=category,
            outcome=outcome,
        )
        return entry

    async def list_for_event(self, event_id: str) -> list[SecurityAuditEntry]:
        result = await self.session.execute(
            select(SecurityAuditEntry)
            .where(SecurityAuditEntry.event_id == event_id)
            .order_by(SecurityAuditEntry.sequence_number)
        )
        return list(result.scalars().all())

    async def verify_chain(self) -> bool:
        """Recompute every entry hash + linkage; return True iff consistent."""
        result = await self.session.execute(
            select(SecurityAuditEntry).order_by(SecurityAuditEntry.sequence_number)
        )
        entries = list(result.scalars().all())
        expected_prev: str | None = None
        for idx, entry in enumerate(entries):
            if entry.sequence_number != idx + 1:
                return False
            if entry.previous_hash != expected_prev:
                return False
            recomputed = compute_entry_hash(
                sequence_number=entry.sequence_number,
                previous_hash=entry.previous_hash,
                event_id=entry.event_id,
                category=entry.category,
                action=entry.action,
                source=entry.source,
                attempted_at=_iso(entry.attempted_at) or "",
                approval_level=entry.approval_level,
                triggered_rule=entry.triggered_rule,
                rule_version=entry.rule_version,
                reason=entry.reason,
                outcome=entry.outcome,
                correlation_id=entry.correlation_id,
            )
            if recomputed != entry.entry_hash:
                return False
            expected_prev = entry.entry_hash
        return True

    async def count(self) -> int:
        total: Any = (
            await self.session.execute(select(func.count(SecurityAuditEntry.id)))
        ).scalar_one()
        return int(total)

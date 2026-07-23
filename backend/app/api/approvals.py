"""Approval routes. Implements: requestApproval, submitApproval."""

from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.api_deps import get_session
from app.api.schemas import ApprovalDecision, ApprovalRequest, ApprovalResult
from app.application import approval

router = APIRouter()


@router.post(
    "/control-plans/{planId}/approval-requests",
    response_model=ApprovalRequest,
    status_code=status.HTTP_201_CREATED,
)
async def request_approval(
    planId: str, session: AsyncSession = Depends(get_session)
) -> ApprovalRequest:
    return await approval.request_approval(session, planId)


@router.post(
    "/approval-requests/{requestId}/decision", response_model=ApprovalResult
)
async def submit_approval(
    requestId: str,
    decision: ApprovalDecision,
    session: AsyncSession = Depends(get_session),
) -> ApprovalResult:
    # approverId from the body is NOT trusted; identity is server-injected.
    return await approval.submit_approval(session, requestId, decision.decision, decision.reason)

"""Unified error model and FastAPI exception handlers.

The error ``code`` MUST stay within the 6-value enum frozen in the frontend
contract (``NOT_FOUND | CONFLICT | INVALID_STATE | VALIDATION | FORBIDDEN | INTERNAL``).
Richer semantics are carried by the additive ``details`` / ``requestId`` /
``retryable`` fields, which the frontend ignores without breaking.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Any

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

# Frozen enum (mirrors frontend ApiErrorCode). Do NOT extend.
VALID_CODES = frozenset(
    {"NOT_FOUND", "CONFLICT", "INVALID_STATE", "VALIDATION", "FORBIDDEN", "INTERNAL"}
)

DEFAULT_STATUS = {
    "NOT_FOUND": 404,
    "CONFLICT": 409,
    "INVALID_STATE": 409,
    "VALIDATION": 400,
    "FORBIDDEN": 403,
    "INTERNAL": 500,
}


class DomainError(Exception):
    """Domain-level error mapped to the unified API error envelope."""

    def __init__(
        self,
        code: str,
        message: str,
        *,
        status: int | None = None,
        details: dict[str, Any] | None = None,
        retryable: bool = False,
    ) -> None:
        super().__init__(message)
        if code not in VALID_CODES:
            # Internal bug: coerce rather than break the contract enum.
            code = "INTERNAL"
        self.code = code
        self.message = message
        self.status = status or DEFAULT_STATUS[code]
        self.details = details or {}
        self.retryable = retryable


def not_found(message: str, **details: Any) -> DomainError:
    return DomainError("NOT_FOUND", message, details=details or None)


def invalid_state(message: str, **details: Any) -> DomainError:
    return DomainError("INVALID_STATE", message, details=details or None)


def conflict(message: str, **details: Any) -> DomainError:
    return DomainError("CONFLICT", message, details=details or None)


def forbidden(message: str, **details: Any) -> DomainError:
    return DomainError("FORBIDDEN", message, details=details or None)


def validation_error(message: str, **details: Any) -> DomainError:
    return DomainError("VALIDATION", message, details=details or None)


def internal_error(message: str, *, retryable: bool = True, **details: Any) -> DomainError:
    return DomainError("INTERNAL", message, details=details or None, retryable=retryable)


def _build_envelope(request: Request, err: DomainError) -> dict[str, Any]:
    request_id = getattr(request.state, "request_id", None)
    return {
        "error": {
            "code": err.code,
            "message": err.message,
            "details": err.details,
            "requestId": request_id,
            "retryable": err.retryable,
        }
    }


def install_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(DomainError)
    async def _domain_error_handler(request: Request, exc: DomainError) -> JSONResponse:
        return JSONResponse(status_code=exc.status, content=_build_envelope(request, exc))

    @app.exception_handler(Exception)
    async def _unhandled_handler(request: Request, exc: Exception) -> JSONResponse:
        err = internal_error("服务内部错误，请重试", retryable=True)
        return JSONResponse(status_code=err.status, content=_build_envelope(request, err))


# Type alias for dependency functions that may raise.
AsyncHandler = Callable[..., Awaitable[Any]]

"""Domain errors and their HTTP mapping. Raise these anywhere; `install_error_handlers` maps them
to `{code, message, retryable}` (schemas.common.ErrorResponse)."""

import logging

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.schemas.common import ErrorResponse

log = logging.getLogger(__name__)


class AppError(Exception):
    status_code: int = 500
    code: str = "internal_error"
    retryable: bool = False

    def __init__(self, message: str = "", *, code: str | None = None) -> None:
        super().__init__(message or self.code)
        self.message = message or self.code
        if code is not None:
            self.code = code

    def to_response(self) -> ErrorResponse:
        return ErrorResponse(code=self.code, message=self.message, retryable=self.retryable)


class NotFoundError(AppError):
    status_code = 404
    code = "not_found"


class ConflictError(AppError):
    status_code = 409
    code = "conflict"
    retryable = True


class TurnBusyError(ConflictError):
    code = "turn_busy"


class InvalidInputError(AppError):
    status_code = 422
    code = "invalid_input"


class EncodingError(AppError):
    """A document is not Firestore-safe (nested arrays, too large)."""

    status_code = 500
    code = "encoding_error"


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error(_request: Request, exc: AppError) -> JSONResponse:
        if exc.status_code >= 500:
            log.error("app_error", extra={"code": exc.code, "error": exc.message})
        return JSONResponse(status_code=exc.status_code, content=exc.to_response().model_dump())

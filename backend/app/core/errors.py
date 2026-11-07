"""Domain errors and their HTTP mapping. Raise these anywhere; `install_error_handlers` maps them
to `{code, message, retryable}` (schemas.common.ErrorResponse). Request validation failures
become 422 `invalid_input` (plus `details`), and any unhandled exception becomes 500 `internal`."""

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.schemas.common import ErrorDetail, ErrorResponse

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

    def to_json(self) -> JSONResponse:
        return _json(self.status_code, self.to_response())


def _json(status_code: int, body: ErrorResponse) -> JSONResponse:
    return JSONResponse(status_code=status_code, content=body.model_dump(exclude_none=True))


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


def _validation_details(exc: RequestValidationError) -> list[ErrorDetail]:
    # Only loc/msg/type: the raw `input` and `ctx` may echo user data or hold exception objects.
    return [
        ErrorDetail(
            loc=[p if isinstance(p, int) else str(p) for p in err.get("loc", ())],
            msg=str(err.get("msg", "")),
            type=str(err.get("type", "")),
        )
        for err in exc.errors()
    ]


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error(_request: Request, exc: AppError) -> JSONResponse:
        if exc.status_code >= 500:
            log.error("app_error", extra={"code": exc.code, "error": exc.message})
        return exc.to_json()

    @app.exception_handler(RequestValidationError)
    async def _validation_error(_request: Request, exc: RequestValidationError) -> JSONResponse:
        details = _validation_details(exc)
        summary = "; ".join(f"{'.'.join(map(str, d.loc))}: {d.msg}" for d in details)
        error = InvalidInputError(summary or "invalid request")
        return _json(error.status_code, error.to_response().model_copy(update={"details": details}))

    # Starlette runs this from ServerErrorMiddleware (outermost), then re-raises for the server log.
    @app.exception_handler(Exception)
    async def _unhandled(request: Request, exc: Exception) -> JSONResponse:
        log.exception("unhandled_error", extra={"path": request.url.path})
        body = ErrorResponse(code="internal", message="internal server error", retryable=True)
        return _json(500, body)

"""`GET /api/sessions/{session_id}/stock-advice` (plan §3.6, Issue #123): nearest stock advisor."""

from fastapi import APIRouter
from starlette.concurrency import run_in_threadpool

from app.api.deps import SessionDep
from app.core.errors import InvalidInputError
from app.fitting.stock_advice import nearest_stock
from app.schemas.fit import StockAdvice

router = APIRouter(tags=["fit"])


@router.get("/api/sessions/{session_id}/stock-advice")
async def get_stock_advice(session: SessionDep) -> StockAdvice:
    """Return nearest stock build, flight deltas, and stock recommendation."""
    if session.state.best is None:
        raise InvalidInputError("Run the fit first.", code="missing_inputs")
    return await run_in_threadpool(nearest_stock, session)

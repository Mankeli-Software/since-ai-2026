"""`POST /api/flight` (plan §3.8, Issue #26): simulate ball flight and dispersion."""

from fastapi import APIRouter
from starlette.concurrency import run_in_threadpool

from app.api.deps import StoreDep
from app.fitting.flight import simulate_session_flight
from app.schemas.fit import FlightRequest, FlightResult

router = APIRouter(tags=["fit"])


@router.post("/api/flight")
async def flight_endpoint(body: FlightRequest, store: StoreDep) -> FlightResult:
    """Flight for the session's recommended spec (its head, lie error and the current-clubs
    verdict against its lie). Read-only: the verdict reaches state through the fit routes."""
    session = await store.load(body.session_id)
    return await run_in_threadpool(simulate_session_flight, session, body.heads or None)

"""`POST /api/flight` (plan §3.8, Issue #26): simulate ball flight and dispersion."""

import contextlib

from fastapi import APIRouter
from starlette.concurrency import run_in_threadpool

from app import pack
from app.api.deps import StoreDep
from app.fitting.flight import simulate_flight
from app.fitting.mapping import build_answers
from app.fitting.session_inputs import evidence_of, intake_of
from app.schemas.fit import FlightRequest, FlightResult

router = APIRouter(tags=["fit"])


@router.post("/api/flight")
async def flight_endpoint(body: FlightRequest, store: StoreDep) -> FlightResult:
    session = await store.load(body.session_id)
    intake = intake_of(session)
    evidence = evidence_of(session)
    heads = body.heads or None
    rec_head = session.state.best.head if session.state.best else None

    # lie error from best rec or evidence
    lie_error_deg = 0.0
    with contextlib.suppress(Exception):
        answers = build_answers(intake, evidence)
        lie_need = (
            answers.lie_override_deg
            if answers.lie_override_deg is not None
            else pack.static_lie_deg(answers.height_cm, answers.wrist_to_floor_cm)
        )
        rec_lie = session.state.best.lie_deg if session.state.best else round(lie_need)
        lie_error_deg = float(rec_lie - lie_need)

    return await run_in_threadpool(
        simulate_flight,
        intake,
        evidence,
        heads,
        recommended_head=rec_head,
        lie_error_deg=lie_error_deg,
        session_id=session.id,
        evidence_version=session.evidence_version,
    )

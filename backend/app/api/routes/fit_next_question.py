"""`GET /api/sessions/{id}/next-question` (plan §3.8): what to ask next, ready to render.
Read-only: answering it goes through `PATCH .../profile` (form) or the turn (chat)."""

from fastapi import APIRouter
from starlette.concurrency import run_in_threadpool

from app.api.deps import SessionDep
from app.confidence.analysis import analyze
from app.confidence.next_question import next_question
from app.fitting.session_inputs import answered, evidence_of, intake_of
from app.schemas.confidence import NextQuestionResponse
from app.schemas.session import FitSession

router = APIRouter(tags=["fit"])


def _next(session: FitSession) -> NextQuestionResponse:
    intake, evidence = intake_of(session), evidence_of(session)
    a = analyze(intake, evidence, session_id=session.id, evidence_version=session.evidence_version)
    return next_question(
        intake,
        evidence,
        a,
        answered=answered(session),
        offered=session.state.precision_offered,
    )


@router.get("/api/sessions/{session_id}/next-question")
async def get_next_question(session: SessionDep) -> NextQuestionResponse:
    # Monte Carlo is CPU work (a few ms): keep it off the event loop.
    return await run_in_threadpool(_next, session)

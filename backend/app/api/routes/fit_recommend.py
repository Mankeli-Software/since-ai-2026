"""`GET /api/sessions/{session_id}/fit` (plan §3.8, Issue #28): full fit recommendation."""

from fastapi import APIRouter, Query
from starlette.concurrency import run_in_threadpool

from app.api.deps import SessionDep, StoreDep
from app.confidence.analysis import Analysis, analyze, refresh_state
from app.core.errors import InvalidInputError
from app.fitting.explain import explain_fit
from app.fitting.recommend import recommend_fit
from app.fitting.session_inputs import evidence_of, intake_of
from app.schemas.common import Depth
from app.schemas.fit import FitResult, IntakeAnswers
from app.schemas.session import FitSession
from app.schemas.state import FittingState

router = APIRouter(tags=["fit"])


def _compute_fit(
    session: FitSession, depth: Depth | None
) -> tuple[FitResult, Analysis, FittingState]:
    intake: IntakeAnswers = intake_of(session)
    evidence = evidence_of(session)
    a: Analysis = analyze(
        intake, evidence, session_id=session.id, evidence_version=session.evidence_version
    )
    if a.answers is None:
        raise InvalidInputError("Not enough answers to run a fit yet.", code="missing_inputs")
    fit = recommend_fit(a.answers, top_n=2)
    fit.confidence = a.confidence
    fit.close_calls = a.close_calls
    fit.current_clubs_verdict = a.current_clubs_verdict
    fit.why = explain_fit(
        a.answers,
        fit.recs[0],
        fit.ranking,
        a.close_calls,
        intake=intake,
        depth=depth,
    )
    new_state = refresh_state(session.state, a)
    return fit, a, new_state


@router.get("/api/sessions/{session_id}/fit")
async def get_fit(
    session: SessionDep,
    store: StoreDep,
    depth: Depth | None = Query(default=None),
) -> FitResult:
    fit, _, new_state = await run_in_threadpool(_compute_fit, session, depth)
    fit_json = fit.model_dump_json()
    if session.recommendation_json != fit_json or session.state != new_state:
        expected = session.state.version
        session.recommendation_json = fit_json
        session.state = new_state
        session.state = await store.save(session, expected_version=expected)
    return fit

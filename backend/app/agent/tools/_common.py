"""Shared helpers for domain tools (underscore: skipped by tool autodiscovery)."""

import contextlib
from typing import Any

from app.confidence.analysis import Analysis, analyze, refresh_state
from app.confidence.next_question import next_question as compute_next_question
from app.core.tooling import ToolContext
from app.fitting.explain import explain_fit
from app.fitting.flight import simulate_session_flight
from app.fitting.mapping import missing_inputs
from app.fitting.recommend import recommend_fit
from app.fitting.session_inputs import answered, evidence_of
from app.fitting.session_inputs import intake_of as session_intake_of
from app.schemas.chat import StateEvent
from app.schemas.common import ProvenancedValue
from app.schemas.fit import FitResult, IntakeAnswers
from app.schemas.session import FitSession
from app.schemas.state import FittingState

# Neutral status for parts another lane has not landed yet. Tools return it instead of numbers.
NOT_AVAILABLE = "not_available_yet"


def intake_of(ctx: ToolContext) -> IntakeAnswers:
    """The golfer's answers so far, rebuilt from `session.profile`."""
    return session_intake_of(ctx.session)


def missing_of(ctx: ToolContext) -> list[str]:
    intake = intake_of(ctx)
    evidence = evidence_of(ctx.session)
    return missing_inputs(intake, evidence)


def set_profile(ctx: ToolContext, fields: dict[str, Any]) -> None:
    for k, v in fields.items():
        ctx.session.profile[k] = ProvenancedValue(source="questionnaire", value=v)


def recompute_session_state(session: FitSession) -> FittingState:
    """Recomputes confidence analysis, next question hint, recommendation, why, and flight."""
    intake = session_intake_of(session)
    evidence = evidence_of(session)
    a: Analysis = analyze(
        intake, evidence, session_id=session.id, evidence_version=session.evidence_version
    )
    nq = compute_next_question(
        intake, evidence, a, answered=answered(session), offered=session.state.precision_offered
    )
    session.state = refresh_state(session.state, a, nq)

    if a.answers is not None:
        fit = recommend_fit(a.answers, top_n=2)
        fit.confidence = a.confidence
        fit.close_calls = a.close_calls
        if fit.recs:
            fit.why = explain_fit(
                a.answers,
                fit.recs[0],
                fit.ranking,
                a.close_calls,
                intake=intake,
            )
        with contextlib.suppress(Exception):
            fit.flight = simulate_session_flight(session)
        session.recommendation_json = fit.model_dump_json()

    return session.state


async def commit_state(ctx: ToolContext, **updates: Any) -> None:
    """Replace the frozen state with a copy (version + 1) and push it to the client."""
    st = ctx.session.state
    ctx.session.state = st.model_copy(update={**updates, "version": st.version + 1})
    await ctx.emit(StateEvent(seq=0, state=ctx.session.state))


def last_fit(ctx: ToolContext) -> FitResult | None:
    raw = ctx.session.recommendation_json
    return FitResult.model_validate_json(raw) if raw else None

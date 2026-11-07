"""`PATCH /api/sessions/{id}/profile` (plan §3.8, form fallback #3): save answers, refresh the
meter, close calls, best spec and next-question hint, and return the new state.

Units are converted to the profile's own (cm, yd, mph). A value of null means "I don't know":
the field counts as asked. Answering an offer (`ball_line_offer`, `precision_offer`, any choice
including "I'm happy with this") records it, so it is not offered again (§5.5).
"""

from typing import Any

from fastapi import APIRouter
from pydantic import ValidationError
from starlette.concurrency import run_in_threadpool

from app.api.deps import SessionDep, StoreDep
from app.api.routes.evidence_confirm import fit_flags
from app.confidence.analysis import analyze, refresh_state
from app.confidence.next_question import next_question
from app.core.errors import InvalidInputError
from app.evidence import session_flags
from app.fitting.session_inputs import PROFILE_FIELDS, answered, evidence_of, intake_of
from app.schemas.common import ProvenancedValue
from app.schemas.confidence import NextQuestionResponse, ProfilePatch, ProfilePatchResponse
from app.schemas.session import FitSession
from app.schemas.state import FittingState

router = APIRouter(tags=["fit"])

# field -> {unit: factor to the profile's unit}
UNITS: dict[str, dict[str, float]] = {
    "height_cm": {"cm": 1.0, "in": 2.54, "m": 100.0},
    "wrist_to_floor_cm": {"cm": 1.0, "in": 2.54},
    "height_photo_cm": {"cm": 1.0, "in": 2.54},
    "wrist_to_floor_photo_cm": {"cm": 1.0, "in": 2.54},
    "hand_length_photo_cm": {"cm": 1.0, "in": 2.54, "mm": 0.1},
    "reported_7i_carry_yd": {"yd": 1.0, "m": 1.0936133},
    "reported_7i_speed_mph": {"mph": 1.0, "km/h": 0.6213712},
}


def _convert(name: str, value: Any, unit: str | None) -> Any:
    if unit is None or value is None or name not in UNITS:
        return value
    factor = UNITS[name].get(unit)
    if factor is None:
        raise InvalidInputError(f"{name}: unit {unit!r} not one of {sorted(UNITS[name])}")
    try:
        return round(float(value) * factor, 2)
    except (TypeError, ValueError) as e:
        raise InvalidInputError(f"{name}: {value!r} is not a number") from e


def _current_offer(session: FitSession) -> NextQuestionResponse:
    intake, evidence = intake_of(session), evidence_of(session)
    a = analyze(intake, evidence, session_id=session.id, evidence_version=session.evidence_version)
    return next_question(
        intake, evidence, a, answered=answered(session), offered=session.state.precision_offered
    )


def _apply(session: FitSession, body: ProfilePatch) -> FittingState:
    unknown = sorted(set(body.fields) - PROFILE_FIELDS)
    if unknown:
        raise InvalidInputError(f"unknown profile fields: {', '.join(unknown)}")

    offered = list(session.state.precision_offered)
    if {"precision_offer", "ball_line_offer"} & set(body.fields):
        current = _current_offer(session)
        if current.part is not None and current.part not in offered:
            offered.append(current.part)

    for name, fv in body.fields.items():
        value = _convert(name, fv.value, fv.unit)
        session.profile[name] = ProvenancedValue(source=fv.source, value=value)
    try:
        intake, evidence = intake_of(session), evidence_of(session)
    except ValidationError as e:
        raise InvalidInputError(str(e.errors()[0]["msg"])) from e

    # v1 golfer rules (G2 -> G1 -> G3, G11) on the new values, before the meter reads the flags.
    session.flags, pending = session_flags.refresh(session)
    session.state = session.state.model_copy(
        update={"precision_offered": offered, "pending_flags": pending}
    )
    a = analyze(intake, evidence, session_id=session.id, evidence_version=session.evidence_version)
    nq = next_question(intake, evidence, a, answered=answered(session), offered=offered)
    session.state = refresh_state(session.state, a, nq)
    session.flags = fit_flags(session)
    return session.state


@router.patch("/api/sessions/{session_id}/profile")
async def patch_profile(
    body: ProfilePatch, session: SessionDep, store: StoreDep
) -> ProfilePatchResponse:
    expected = session.state.version
    session.state = await run_in_threadpool(_apply, session, body)
    state = await store.save(session, expected_version=expected)
    return ProfilePatchResponse(state=state, flags=list(state.pending_flags))

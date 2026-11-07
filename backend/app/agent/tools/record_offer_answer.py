from typing import Literal

from pydantic import BaseModel, Field

from app.agent.tools._common import commit_state, recompute_session_state
from app.confidence.analysis import analyze
from app.confidence.next_question import next_question
from app.core.tooling import ToolContext, fitter_tool
from app.fitting.session_inputs import answered, evidence_of, intake_of


class RecordOfferAnswerIn(BaseModel):
    answer: Literal["declined", "accepted"] = Field(
        default="declined",
        description="Whether the golfer declined or accepted the precision offer",
    )


class RecordOfferAnswerOut(BaseModel):
    recorded_part: str | None
    version: int


@fitter_tool("record_offer_answer")
async def record_offer_answer(ctx: ToolContext, args: RecordOfferAnswerIn) -> RecordOfferAnswerOut:
    """Record that a precision offer was answered or declined so it is not offered again."""
    session = ctx.session
    intake = intake_of(session)
    evidence = evidence_of(session)
    a = analyze(intake, evidence, session_id=session.id, evidence_version=session.evidence_version)
    current = next_question(
        intake, evidence, a, answered=answered(session), offered=session.state.precision_offered
    )
    offered = list(session.state.precision_offered)
    recorded_part = None
    if current.part is not None and current.part not in offered:
        offered.append(current.part)
        recorded_part = current.part
    session.state = session.state.model_copy(update={"precision_offered": offered})
    recompute_session_state(session)
    await commit_state(ctx)
    return RecordOfferAnswerOut(
        recorded_part=recorded_part,
        version=session.state.version,
    )

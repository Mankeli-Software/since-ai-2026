from typing import Literal

from pydantic import BaseModel, Field

from app.agent.tools._common import commit_state, recompute_session_state
from app.core.tooling import ToolContext, fitter_tool
from app.schemas.common import Part


class RecordOfferAnswerIn(BaseModel):
    answer: Literal["declined", "accepted"] = Field(
        default="declined",
        description="Whether the golfer declined or accepted the precision offer",
    )
    part: Part | None = Field(
        default=None,
        description="The part of the offer the golfer answered: `part` from next_question. "
        "Leave empty to use the offer shown last",
    )


class RecordOfferAnswerOut(BaseModel):
    recorded_part: str | None
    version: int
    part: Part | None = Field(default=None, description="The offer's part the answer was about")
    reason_code: str | None = Field(default=None, description="The offer's reason_code, if known")
    next: Literal["continue", "import"] = Field(
        default="continue",
        description='"import": show the data_import for this evidence; "continue": move on',
    )


@fitter_tool("record_offer_answer")
async def record_offer_answer(ctx: ToolContext, args: RecordOfferAnswerIn) -> RecordOfferAnswerOut:
    """Record the golfer's answer to a precision offer. Pass the offer's `part`. Declined:
    that part is never offered again. Accepted: show the import next; the part stays open so
    the next step of its evidence ladder can follow once the data is in. If the golfer then
    skips the import, call this again with answer "declined"."""
    session = ctx.session
    hint = session.state.next_question
    shown = hint if hint is not None and hint.kind == "precision" else None
    # The offer the golfer answered, never whatever would be offered now (#195).
    part = args.part or (shown.part if shown is not None else None)
    reason_code = shown.reason_code if shown is not None and shown.part == part else None

    if args.answer == "accepted" or part is None:
        return RecordOfferAnswerOut(
            recorded_part=None,
            version=session.state.version,
            part=part,
            reason_code=reason_code,
            next="import" if args.answer == "accepted" and part is not None else "continue",
        )

    offered = list(session.state.precision_offered)
    if part in offered:  # already recorded, e.g. by the form's profile PATCH
        return RecordOfferAnswerOut(
            recorded_part=None, version=session.state.version, part=part, reason_code=reason_code
        )
    offered.append(part)
    session.state = session.state.model_copy(update={"precision_offered": offered})
    recompute_session_state(session)
    await commit_state(ctx)
    return RecordOfferAnswerOut(
        recorded_part=part, version=session.state.version, part=part, reason_code=reason_code
    )

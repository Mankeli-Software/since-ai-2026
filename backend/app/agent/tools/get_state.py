from pydantic import BaseModel, Field

from app.agent.tools._common import intake_of, missing_of
from app.core.tooling import ToolContext, fitter_tool
from app.schemas.state import FittingState


class GetStateIn(BaseModel):
    pass


class GetStateOut(BaseModel):
    state: FittingState
    known: dict[str, object] = Field(description="Profile fields the golfer has given so far")
    missing: list[str]


@fitter_tool("get_state")
async def get_state(ctx: ToolContext, args: GetStateIn) -> GetStateOut:
    """Read the current fitting state: gate, confidence, best and runner-up spec, known profile
    fields and the inputs still missing. Read-only."""
    known = intake_of(ctx).model_dump(exclude_none=True, exclude_defaults=True)
    return GetStateOut(state=ctx.session.state, known=known, missing=missing_of(ctx))

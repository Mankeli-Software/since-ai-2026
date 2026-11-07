from pydantic import BaseModel, Field

from app.agent.tools._common import commit_state, recompute_session_state, set_profile
from app.core.tooling import ToolContext, fitter_tool
from app.schemas.fit import IntakeAnswers


class UpdateProfileIn(IntakeAnswers):
    """Only the fields you pass are saved; leave the others out."""

    reported_7i_carry_m: float | None = Field(
        default=None, description="7-iron carry in metres (the carry slider); saved as yards"
    )


class UpdateProfileOut(BaseModel):
    saved: list[str]
    missing: list[str]
    version: int


@fitter_tool("update_profile")
async def update_profile(ctx: ToolContext, args: UpdateProfileIn) -> UpdateProfileOut:
    """Save what the golfer told you (one or more profile fields) after they answer. Pass only
    the fields they gave. Buckets are integers 1-5. Returns the inputs still missing."""
    fields = {k: getattr(args, k) for k in args.model_fields_set if getattr(args, k) is not None}
    if (carry_m := fields.pop("reported_7i_carry_m", None)) is not None:
        fields["reported_7i_carry_yd"] = round(carry_m / 0.9144, 1)
    set_profile(ctx, fields)
    recompute_session_state(ctx.session)
    await commit_state(ctx)
    return UpdateProfileOut(
        saved=sorted(fields), missing=ctx.session.state.missing, version=ctx.session.state.version
    )

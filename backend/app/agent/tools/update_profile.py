from pydantic import BaseModel

from app.agent.tools._common import commit_state, missing_of, set_profile
from app.core.tooling import ToolContext, fitter_tool
from app.schemas.fit import IntakeAnswers


class UpdateProfileIn(IntakeAnswers):
    """Only the fields you pass are saved; leave the others out."""


class UpdateProfileOut(BaseModel):
    saved: list[str]
    missing: list[str]
    version: int


@fitter_tool("update_profile")
async def update_profile(ctx: ToolContext, args: UpdateProfileIn) -> UpdateProfileOut:
    """Save what the golfer told you (one or more profile fields) after they answer. Pass only
    the fields they gave. Buckets are integers 1-5. Returns the inputs still missing."""
    fields = {k: getattr(args, k) for k in args.model_fields_set if getattr(args, k) is not None}
    set_profile(ctx, fields)
    missing = missing_of(ctx)
    await commit_state(ctx, missing=missing)
    return UpdateProfileOut(
        saved=sorted(fields), missing=missing, version=ctx.session.state.version
    )

from pydantic import BaseModel

from app.core.tooling import ToolContext, fitter_tool
from app.schemas.chat import StageEvent
from app.schemas.common import Part


class StageFocusIn(BaseModel):
    part: Part


class StageFocusOut(BaseModel):
    focused: Part


@fitter_tool("stage_focus")
async def stage_focus(ctx: ToolContext, args: StageFocusIn) -> StageFocusOut:
    """Point the 3D club stage at one part (head, flex, length, lie, grip ...) while you explain
    it. Use it when you talk about that part."""
    await ctx.emit(StageEvent(seq=0, action="focus_part", part=args.part))
    return StageFocusOut(focused=args.part)

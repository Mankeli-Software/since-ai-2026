from pydantic import BaseModel, Field

from app.core.tooling import ToolContext, fitter_tool
from app.fitting.tinker import run_tinker
from app.schemas.chat import StageEvent
from app.schemas.common import HeadSlug
from app.schemas.tinker import TinkerResult, TinkerSpecPatch


class CompareSpecsIn(BaseModel):
    heads: list[HeadSlug] = Field(min_length=2, max_length=2)


class CompareSpecsOut(BaseModel):
    status: str
    heads: list[HeadSlug]
    diff_labels: list[str] = Field(default_factory=list)
    reasons: list[str] = Field(default_factory=list)
    result: TinkerResult | None = None


@fitter_tool("compare_specs")
async def compare_specs(ctx: ToolContext, args: CompareSpecsIn) -> CompareSpecsOut:
    """Compare two heads on carry, apex, landing angle, and spin deltas using the tinker engine."""
    try:
        patch = TinkerSpecPatch(head=args.heads[1])
        res = run_tinker(ctx.session, patch)
        await ctx.emit(StageEvent(seq=0, action="show_flight", heads=list(args.heads)))
        return CompareSpecsOut(
            status="ok",
            heads=args.heads,
            diff_labels=res.diff_labels,
            reasons=res.reasons,
            result=res,
        )
    except Exception:
        return CompareSpecsOut(status="error", heads=args.heads)

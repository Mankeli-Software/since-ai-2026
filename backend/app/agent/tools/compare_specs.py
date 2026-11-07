from pydantic import BaseModel, Field

from app.agent.tools._common import NOT_AVAILABLE
from app.core.tooling import ToolContext, fitter_tool
from app.schemas.common import HeadSlug


class CompareSpecsIn(BaseModel):
    heads: list[HeadSlug] = Field(min_length=2, max_length=2)


class CompareSpecsOut(BaseModel):
    status: str
    heads: list[HeadSlug]


@fitter_tool("compare_specs")
async def compare_specs(ctx: ToolContext, args: CompareSpecsIn) -> CompareSpecsOut:
    """Compare two heads on carry, apex, landing angle and spin deltas. Not available yet: say
    you cannot compare numbers in this version and do not guess any."""
    # shortcut: stub. TODO(FIT tinker, plan 3.6): return deltas and emit stage set_spec.
    return CompareSpecsOut(status=NOT_AVAILABLE, heads=args.heads)

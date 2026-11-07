from pydantic import BaseModel, Field

from app.agent.tools._common import NOT_AVAILABLE, last_fit
from app.core.tooling import ToolContext, fitter_tool
from app.schemas.common import Depth, Part


class ExplainPartIn(BaseModel):
    part: Part
    depth: Depth = "standard"


class ExplainPartOut(BaseModel):
    status: str
    part: Part
    score: float | None = Field(default=None, description="The pack's score for this part")
    trace: list[str] = Field(default_factory=list, description="The rules' own trace lines")


@fitter_tool("explain_part")
async def explain_part(ctx: ToolContext, args: ExplainPartIn) -> ExplainPartOut:
    """Explain why one part of the best spec was chosen, from the rules' own trace. Quote only
    what it returns. Needs run_fit first."""
    fit = last_fit(ctx)
    if fit is None or not fit.recs:
        return ExplainPartOut(status="needs_fit", part=args.part)
    best = fit.recs[0]
    # shortcut: raw pack trace lines, not plain-language WhyItems. TODO(FIT #explain, plan 3.7):
    # build real explanations with provenance, close calls and depth.
    prefix = "shaft" if args.part in ("flex", "material", "shaft_model") else args.part
    trace = [t for t in best.trace if t.lower().startswith(prefix)]
    return ExplainPartOut(
        status="partial" if trace else NOT_AVAILABLE,
        part=args.part,
        score=best.score_parts.get(args.part),
        trace=trace,
    )

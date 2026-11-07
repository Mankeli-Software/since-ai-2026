from pydantic import BaseModel, Field

from app.agent.tools._common import NOT_AVAILABLE, last_fit, recompute_session_state
from app.core.tooling import ToolContext, fitter_tool
from app.schemas.common import Depth, Part
from app.schemas.fit import WhyItem


class ExplainPartIn(BaseModel):
    part: Part
    depth: Depth = "standard"


class ExplainPartOut(BaseModel):
    status: str
    part: Part
    score: float | None = Field(default=None, description="The pack's score for this part")
    trace: list[str] = Field(default_factory=list, description="The rules' own trace lines")
    plain: str | None = Field(default=None, description="Plain language explanation")
    why: WhyItem | None = Field(default=None, description="Full WhyItem explanation")


@fitter_tool("explain_part")
async def explain_part(ctx: ToolContext, args: ExplainPartIn) -> ExplainPartOut:
    """Explain why one part of the best spec was chosen, from the rules' own trace. Quote only
    what it returns. Needs run_fit first."""
    fit = last_fit(ctx)
    if fit is None or not fit.recs:
        recompute_session_state(ctx.session)
        fit = last_fit(ctx)
    if fit is None or not fit.recs:
        return ExplainPartOut(status="needs_fit", part=args.part)

    best = fit.recs[0]
    prefix = "shaft" if args.part in ("flex", "material", "shaft_model") else args.part
    trace = [t for t in best.trace if t.lower().startswith(prefix)]

    target_part = args.part
    matching_why = next((w for w in fit.why if w.part == target_part), None)
    if matching_why is None and args.part in ("flex", "material"):
        matching_why = next((w for w in fit.why if w.part == "shaft_model"), None)

    plain = matching_why.plain if matching_why else None
    return ExplainPartOut(
        status="ok" if (trace or plain) else NOT_AVAILABLE,
        part=args.part,
        score=best.score_parts.get(args.part),
        trace=trace,
        plain=plain,
        why=matching_why,
    )

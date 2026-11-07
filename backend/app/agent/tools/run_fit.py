from typing import Literal

from pydantic import BaseModel, Field

from app.agent.tools._common import (
    NOT_AVAILABLE,
    commit_state,
    intake_of,
    last_fit,
    missing_of,
    recompute_session_state,
)
from app.core.tooling import ToolContext, fitter_tool
from app.fitting.mapping import build_answers
from app.fitting.session_inputs import evidence_of
from app.schemas.chat import StageEvent
from app.schemas.common import Depth, Provenance
from app.schemas.fit import HeadScore, Recommendation


class RunFitIn(BaseModel):
    depth: Depth = "standard"


class RunFitOut(BaseModel):
    status: Literal["needs_info", "ok"]
    missing: list[str] = Field(default_factory=list)
    best: Recommendation | None = None
    runner_up: Recommendation | None = None
    ranking: list[HeadScore] = Field(default_factory=list)
    provenance: dict[str, Provenance] = Field(default_factory=dict)
    confidence: str = Field(
        default=NOT_AVAILABLE, description="Overall confidence score if available"
    )


@fitter_tool("run_fit")
async def run_fit(ctx: ToolContext, args: RunFitIn) -> RunFitOut:
    """Run the fit on everything known: best and runner-up iron spec, the 5-head ranking and
    where each input came from. If inputs are missing it returns status "needs_info" and the
    list: ask for those first. Every spec number you quote comes from here."""
    missing = missing_of(ctx)
    if missing:
        return RunFitOut(status="needs_info", missing=missing)

    recompute_session_state(ctx.session)
    fit = last_fit(ctx)
    best = fit.recs[0] if fit and fit.recs else None
    runner = fit.recs[1] if fit and len(fit.recs) > 1 else None
    ranking = fit.ranking if fit else []

    await commit_state(ctx)
    if ranking:
        await ctx.emit(StageEvent(seq=0, action="show_row", heads=[h.head for h in ranking]))

    intake = intake_of(ctx)
    evidence = evidence_of(ctx.session)
    answers = build_answers(intake, evidence)

    conf_str = (
        f"{ctx.session.state.confidence:.2f}"
        if ctx.session.state.confidence is not None
        else NOT_AVAILABLE
    )

    return RunFitOut(
        status="ok",
        best=best,
        runner_up=runner,
        ranking=ranking,
        provenance=answers.provenance,
        confidence=conf_str,
    )

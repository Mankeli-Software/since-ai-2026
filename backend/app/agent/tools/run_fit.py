from typing import Literal

from pydantic import BaseModel, Field

from app.agent.tools._common import NOT_AVAILABLE, commit_state, intake_of, missing_of
from app.core.tooling import ToolContext, fitter_tool
from app.fitting.mapping import build_answers
from app.fitting.recommend import recommend_fit
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
        default=NOT_AVAILABLE, description="No confidence number exists yet; do not state one"
    )


@fitter_tool("run_fit")
async def run_fit(ctx: ToolContext, args: RunFitIn) -> RunFitOut:
    """Run the fit on everything known: best and runner-up iron spec, the 5-head ranking and
    where each input came from. If inputs are missing it returns status "needs_info" and the
    list: ask for those first. Every spec number you quote comes from here."""
    missing = missing_of(ctx)
    if missing:
        return RunFitOut(status="needs_info", missing=missing)
    answers = build_answers(intake_of(ctx))  # shortcut: no evidence yet, see missing_of
    result = recommend_fit(answers, top_n=2)
    ctx.session.recommendation_json = result.model_dump_json()
    best, runner = result.recs[0], result.recs[1] if len(result.recs) > 1 else None
    # shortcut: no Monte Carlo confidence yet. TODO(FIT confidence): set confidence, per_part,
    # close_calls and the real gate. Until then the gate is the honest low one.
    await commit_state(
        ctx, missing=[], best=best, runner_up=runner, gate="provisional", strength="low"
    )
    await ctx.emit(StageEvent(seq=0, action="show_row", heads=[h.head for h in result.ranking]))
    return RunFitOut(
        status="ok",
        best=best,
        runner_up=runner,
        ranking=result.ranking,
        provenance=answers.provenance,
    )

from typing import Literal

from pydantic import BaseModel, Field

from app.agent.tools._common import last_fit, recompute_session_state
from app.core.tooling import ToolContext, fitter_tool
from app.fitting.explain import HEAD_NAMES
from app.schemas.common import Part, SpecValue


class GetCloseCallIn(BaseModel):
    part: Part


class GetCloseCallOut(BaseModel):
    status: Literal["ok", "not_close", "needs_fit"]
    part: Part
    ours: SpecValue | None = None
    alt: SpecValue | None = None
    ours_label: str | None = Field(default=None, description="Display name of our pick")
    alt_label: str | None = Field(default=None, description="Display name of the alternative")
    ours_share: int | None = Field(default=None, description="Our pick's side of the split, 0-100")
    alt_share: int | None = Field(
        default=None,
        description="The other side, 0-100 (100 - ours_share; for monte_carlo it is every draw "
        "that does not keep our pick, mostly the alternative)",
    )
    basis: Literal["head_score", "monte_carlo"] | None = Field(
        default=None,
        description="head_score: the split of the two heads' score points; monte_carlo: the share "
        "of confidence draws that keep our pick",
    )
    ours_points: float | None = Field(default=None, description="Head close calls: our score")
    alt_points: float | None = Field(default=None, description="Head close calls: the alt's score")
    gap_points: float | None = Field(default=None, description="Head close calls: score gap")
    next_step: str | None = Field(default=None, description="What would settle it, plain text")


def _label(part: Part, value: SpecValue | None) -> str | None:
    if value is None:
        return None
    if part == "head":
        return HEAD_NAMES.get(str(value), str(value).upper())
    if part in ("lie", "length") and isinstance(value, (int, float)):
        unit = "°" if part == "lie" else " in"
        return f"{value:+g}{unit}" if value else f"0{unit}"
    return str(value).capitalize()


@fitter_tool("get_close_call")
async def get_close_call(ctx: ToolContext, args: GetCloseCallIn) -> GetCloseCallOut:
    """The close call on one part, ready for `ui_close_call`: both options with display labels
    and an integer split (our pick vs the alternative). Head calls split the two heads' score
    points (they are close on score); other parts use the confidence share. Status
    "not_close" means the fit does not call this part close: show no close-call card."""
    fit = last_fit(ctx)
    if fit is None or not fit.recs:
        recompute_session_state(ctx.session)
        fit = last_fit(ctx)
    if fit is None or not fit.recs:
        return GetCloseCallOut(status="needs_fit", part=args.part)
    call = next((c for c in fit.close_calls if c.part == args.part), None)
    if call is None or call.alt is None:
        return GetCloseCallOut(status="not_close", part=args.part)

    out = GetCloseCallOut(
        status="ok",
        part=args.part,
        ours=call.ours,
        alt=call.alt,
        ours_label=_label(args.part, call.ours),
        alt_label=_label(args.part, call.alt),
        next_step=call.next_step,
    )
    scores = {h.head: h.total for h in fit.ranking}
    if args.part == "head" and call.ours in scores and call.alt in scores:
        a, b = scores[str(call.ours)], scores[str(call.alt)]
        ours_share = round(100 * a / (a + b)) if a + b > 0 else 50
        return out.model_copy(
            update={
                "basis": "head_score",
                "ours_share": ours_share,
                "alt_share": 100 - ours_share,
                "ours_points": a,
                "alt_points": b,
                "gap_points": a - b,
            }
        )
    ours_share = round(100 * call.share)
    return out.model_copy(
        update={"basis": "monte_carlo", "ours_share": ours_share, "alt_share": 100 - ours_share}
    )

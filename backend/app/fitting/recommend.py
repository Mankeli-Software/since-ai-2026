"""`recommend_fit` and `head_ranking` (plan §3.2): Takomo's rules on the mapped answers, plus the
evidence lie override. Pure: reaches the rules only through `app.pack`.
"""

from __future__ import annotations

from app import pack
from app.schemas.fit import FitResult, HeadScore, MappedAnswers, Recommendation

LIE_MIN, LIE_MAX = -3, 3


def lie_from_need(x: float) -> int:
    """Continuous lie need -> a buildable lie option: `int(np.clip(round(x), -3, 3))`.
    Python's round is banker's rounding (round(2.5) == 2), as in the pack's own chart."""
    return int(max(LIE_MIN, min(LIE_MAX, round(x))))


def _with_lie(rec: Recommendation, need: float) -> Recommendation:
    lie = lie_from_need(need)
    # A non-standard lie makes the club custom, so stock/custom is decided again.
    purchase = pack.get_engine().purchase_for(rec.head, rec.shaft, rec.length_in, lie, rec.grip)
    trace = [*rec.trace, f"lie: evidence {need:+.1f} -> {lie:+d}"]
    if purchase != rec.purchase:
        trace.append(f"purchase: {purchase}")
    return rec.model_copy(update={"lie_deg": lie, "purchase": purchase, "trace": trace})


def recommend_fit(
    answers: MappedAnswers, top_n: int = 2, lie_override_deg: float | None = None
) -> FitResult:
    """The top `top_n` specs and the ranking of all 5 heads.

    The lie comes from `lie_override_deg` if given, else from `answers.lie_override_deg`
    (evidence), else from the pack's static chart.
    """
    engine = pack.get_engine()
    need = lie_override_deg if lie_override_deg is not None else answers.lie_override_deg
    recs = engine.recommend(answers, top_n=top_n)
    if need is not None:
        recs = [_with_lie(r, need) for r in recs]
    return FitResult(recs=recs, ranking=engine.score_heads(answers))


def head_ranking(answers: MappedAnswers) -> list[HeadScore]:
    """All 5 heads with total and score parts, best first (club row, head close calls)."""
    return pack.get_engine().score_heads(answers)

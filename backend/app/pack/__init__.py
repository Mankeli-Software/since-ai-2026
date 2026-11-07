"""The RulesEngine boundary: the only module in `app` that imports `takomo_fit` (plan §3.2).

Everything above talks to the `RulesEngine` Protocol (`recommend`, `score_heads`, `purchase_for`,
`catalog`) through `get_engine()`, so Takomo's next rules version, or a call to their live tool,
is a one-file swap. Never reimplement a rule here; wrap it.

Everything returned is plain Python / `schemas` models: no numpy scalars, and catalog records are
deep copies with the pack's private `_heads` / `_shafts` indexes stripped.
"""

from __future__ import annotations

import copy
from functools import lru_cache
from typing import Any, Protocol

import numpy as np
from takomo_fit import baseline as _bl
from takomo_fit import products as _pr

from app.schemas.common import GripSize, HeadSlug, Purchase
from app.schemas.fit import HeadScore, MappedAnswers, Recommendation

# A copy of takomo_fit.score.WEIGHTS (import-linter forbids takomo_fit.score: it imports pandas).
# Re-copy it if the pack changes.
WEIGHTS: dict[str, int] = {
    "head": 20,
    "flex": 20,
    "material": 10,
    "shaft_model": 5,
    "length": 12,
    "lie": 15,
    "grip": 8,
    "purchase": 5,
    "handedness": 5,
}

HEAD_ORDER: tuple[str, ...] = tuple(_pr.HEAD_ORDER)
FLEX_ORDER: tuple[str, ...] = tuple(_pr.FLEX_ORDER)
GRIP_ORDER: tuple[str, ...] = tuple(_pr.GRIP_ORDER)
GLOVE_ORDER: tuple[str, ...] = tuple(_pr.GLOVE_ORDER)
GLOVE_EDGES_CM: tuple[float, ...] = tuple(float(x) for x in _pr.GLOVE_EDGES_CM)
STOCK_GRIPS: tuple[str, ...] = tuple(_bl.STOCK_GRIPS)
HANDEDNESS: tuple[str, ...] = ("right", "left")
PURCHASES: tuple[str, ...] = ("stock", "custom")


# --------------------------------------------------------------------------- catalog data


@lru_cache(maxsize=1)
def _products() -> dict[str, Any]:
    """The pack's cached product data. Private: never hand this dict out (callers get deep
    copies), and never mutate it: the pack's own rules read the same object."""
    return _pr.load()


def _public(record: dict[str, Any]) -> dict[str, Any]:
    return copy.deepcopy(record)


def catalog_data() -> dict[str, Any]:
    """A deep copy of the product data without the pack's `_heads` / `_shafts` indexes."""
    return {k: copy.deepcopy(v) for k, v in _products().items() if not k.startswith("_")}


def head(slug: str) -> dict[str, Any] | None:
    rec = _products()["_heads"].get(slug)
    return _public(rec) if rec is not None else None


def shaft(slug: str) -> dict[str, Any] | None:
    rec = _products()["_shafts"].get(slug)
    return _public(rec) if rec is not None else None


def shafts_for_head(head_slug: str) -> list[dict[str, Any]]:
    return [_public(s) for s in _products()["shafts"] if head_slug in s["heads"]]


def length_options_in() -> tuple[float, ...]:
    return tuple(float(x) for x in _products()["length_options_in"])


def lie_options_deg() -> tuple[int, ...]:
    return tuple(int(x) for x in _products()["lie_options_deg"])


# --------------------------------------------------------------------------- rules


def _answers(a: MappedAnswers) -> _bl.Answers:
    """MappedAnswers (Literal-validated, so no KeyError in the pack) -> the pack's Answers."""
    return _bl.Answers(
        age=a.age,
        sex=a.sex,
        score_bucket=a.score_bucket,
        swing_bucket=a.swing_bucket,
        characteristics=list(a.characteristics[:3]),
        flight=a.flight,
        tempo=a.tempo,
        height_cm=float(a.height_cm),
        wrist_to_floor_cm=float(a.wrist_to_floor_cm),
        glove=a.glove,
        handedness=a.handedness,
        rounds_per_year=a.rounds_per_year,
    )


def _f(x: Any) -> float:
    return float(np.ravel(x)[0])


def _parts(parts: dict[str, Any]) -> dict[str, float]:
    return {k: _f(v) for k, v in parts.items()}


def _purchase(
    head_slug: str, shaft_rec: dict[str, Any], length: float, lie: int, grip: str
) -> Purchase:
    return (
        "stock"
        if _bl.purchase_for(head_slug, shaft_rec, length, lie, grip) == "stock"
        else "custom"
    )


class RulesEngine(Protocol):
    """The rules Takomo owns. Everything in `app` above `pack` goes through this."""

    def recommend(self, answers: MappedAnswers, top_n: int = 2) -> list[Recommendation]: ...

    def score_heads(self, answers: MappedAnswers) -> list[HeadScore]: ...

    def purchase_for(
        self, head: HeadSlug, shaft: str, length_in: float, lie_deg: int, grip: GripSize
    ) -> Purchase:
        """Raise KeyError for an unknown head or shaft slug."""
        ...

    def catalog(self) -> dict[str, Any]:
        """Product data as plain JSON: heads, shafts, grips, length/lie options, etc."""
        ...


class TakomoBaselineRules:
    """Takomo's current tool, from the organiser pack (`takomo_fit.baseline`, 5 Nov 2026)."""

    # model_validate (not the constructors): the pack returns plain strings, and validating them
    # against the schema Literals catches a rules version that starts returning new values.
    def recommend(self, answers: MappedAnswers, top_n: int = 2) -> list[Recommendation]:
        recs = _bl.recommend(_answers(answers), top_n=top_n)
        return [
            Recommendation.model_validate(
                {
                    **r.as_dict(),
                    "rank": int(r.rank),
                    "head_score": _f(r.head_score),
                    "score_parts": _parts(r.score_parts),
                    "length_in": _f(r.length_in),
                    "lie_deg": int(r.lie_deg),
                    "trace": [str(t) for t in r.trace],
                }
            )
            for r in recs
        ]

    def score_heads(self, answers: MappedAnswers) -> list[HeadScore]:
        return [
            HeadScore.model_validate({"head": slug, "total": _f(total), "parts": _parts(parts)})
            for slug, total, parts in _bl.score_heads(_answers(answers))
        ]

    def purchase_for(
        self, head: HeadSlug, shaft: str, length_in: float, lie_deg: int, grip: GripSize
    ) -> Purchase:
        if head not in _products()["_heads"]:
            raise KeyError(head)
        return _purchase(head, _products()["_shafts"][shaft], length_in, lie_deg, grip)

    def catalog(self) -> dict[str, Any]:
        return catalog_data()


_ENGINE: RulesEngine = TakomoBaselineRules()


def get_engine() -> RulesEngine:
    return _ENGINE


# --------------------------------------------------------------------------- input helpers


def swing_bucket_from_speed(mph: float) -> int:
    """7-iron club speed -> swing bucket 1..5."""
    return int(_bl.swing_bucket_from_speed(float(mph)))


def swing_bucket_from_carry(yd: float) -> int:
    """Self-reported 7-iron carry -> swing bucket. Never pass a bias-corrected carry here."""
    return int(_bl.swing_bucket_from_carry(float(yd)))


def score_bucket_from_score(score: float) -> int:
    return int(_bl.score_bucket_from_score(float(score)))


def glove_from_hand_length(cm: float) -> str:
    """Hand length from a photo -> glove size. An edge value lands in the upper size."""
    return GLOVE_ORDER[int(np.digitize(float(cm), GLOVE_EDGES_CM))]


def pick_shaft(head_slug: HeadSlug, answers: MappedAnswers) -> tuple[str, list[str]]:
    """The shaft the rules pick for this head: (shaft slug, trace lines). Re-run it when the head
    changes between the MKII and 301 families, since their shafts have different slugs."""
    trace: list[str] = []
    sh = _bl.pick_shaft(head_slug, _answers(answers), trace)
    return str(sh["slug"]), [str(t) for t in trace]


def static_lie_deg(height_cm: float, wrist_to_floor_cm: float) -> float:
    """The static lie chart before rounding (degrees from standard, + upright). The pack's
    `lie_for` rounds this; lie fusion needs the continuous value."""
    return _f(_bl.lie_continuous(float(height_cm), float(wrist_to_floor_cm)))

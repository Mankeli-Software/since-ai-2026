"""Close calls (plan §3.5): parts where the answer could honestly go either way.

A part is a close call when its Monte Carlo share is below 0.70, or when the pack's own cutoff
for it is within 1σ of our estimate:

| part   | cutoff                                                                 |
|--------|------------------------------------------------------------------------|
| flex   | swing-speed lines 60 / 70 / 80 / 90 mph                                |
| length | the length chart's height edges (155.5 ... 196.5 cm)                   |
| lie    | the rounding lines n ± 0.5 deg                                         |
| grip   | hand-length edges where the grip changes (18.59, 20.22 cm)             |
| head   | top two head scores within 1 point                                     |

Only what our evidence shows: never the scorer's `close_call_*` labels (they come from the
truth). Pure: no I/O, no LLM. Wording is plain and mild, with no swing tips (L18).
"""

from __future__ import annotations

import math

from app import pack
from app.confidence.montecarlo import PARTS
from app.fitting import priors
from app.fitting.mapping import InputEstimates
from app.schemas.common import Part
from app.schemas.fit import CloseCall, Cutoff, HeadScore, MappedAnswers, Recommendation
from app.schemas.state.confidence import PartConfidence

SHARE_BELOW = 0.70
SPEED_LINES_MPH = (60.0, 70.0, 80.0, 90.0)


def _shots_for(distance_mph: float, have_shots: bool) -> str:
    """Shot count rule (§3.5): min 3, 5 to trust, 8-10 within 2 mph of a flex line."""
    n = "8-10" if distance_mph < 2.0 else "5"
    return f"{n} more shots" if have_shots else f"a launch-monitor session ({n} shots)"


def _flex_cut(est: InputEstimates, answers: MappedAnswers, ours: Recommendation):
    if est.speed is None:
        return None
    speed, sd = est.speed.value, est.speed.sd
    line = min(SPEED_LINES_MPH, key=lambda x: abs(speed - x))
    # The other side of the nearest line is one bucket away (re-pick the shaft, ref_shaft_alt).
    alt_bucket = answers.swing_bucket + (1 if speed <= line else -1)
    if not 1 <= alt_bucket <= 5:
        return None
    alt_slug, _ = pack.pick_shaft(
        ours.head, answers.model_copy(update={"swing_bucket": alt_bucket})
    )
    alt_shaft = pack.shaft(alt_slug) or {}
    alt = alt_shaft.get("flex")
    d = abs(speed - line)
    have_shots = (est.swing_prov is not None) and est.swing_prov.source in ("trackman", "radar")
    step = (
        f"Your swing speed ({speed:.1f} mph) is {d:.1f} mph from the {line:g} mph line between "
        f"{ours.flex} and {alt}. {_shots_for(d, have_shots).capitalize()} would settle it."
    )
    return Cutoff(name="swing speed line (mph)", value=line, distance=d, sigma=sd), alt, step


def _length_cut(est: InputEstimates, ours: Recommendation):
    if est.height is None or "height_cm" in est.at_prior:
        return None
    h, sd = est.height.value, est.height.sd
    edge = min(pack.length_height_edges_cm(), key=lambda x: abs(h - x))
    alt = max(-1.5, min(1.5, ours.length_in + (0.5 if h < edge else -0.5)))
    if alt == ours.length_in:
        return None
    d = abs(h - edge)
    step = (
        f"You're {d:.1f} cm from the next length line ({edge:g} cm). Measuring your height "
        "again in golf shoes would settle it."
    )
    return Cutoff(name="length chart height edge (cm)", value=edge, distance=d, sigma=sd), alt, step


def _lie_need(est: InputEstimates) -> tuple[float, float, str]:
    """(continuous lie need, its σ, evidence kind)."""
    assert est.height and est.wrist_to_floor
    lie = est.lie
    if lie is None:
        need = pack.static_lie_deg(est.height.value, est.wrist_to_floor.value)
        return need, priors.LIE_DELIVERY_SD, "chart"
    if lie.kind == "test_club":
        return lie.value, lie.reading_sd, lie.kind
    sd = math.hypot(lie.weight * lie.reading_sd, (1 - lie.weight) * priors.LIE_DELIVERY_SD)
    return lie.value, sd, lie.kind


LIE_NEXT_STEP = {
    "chart": "A ball-line test shows which way to lean; a test-club session on a simulator gives "
    "the number.",
    "ball_line": "A test-club session on a simulator gives the number.",
    "own_7i": "Hitting a Takomo test club on a launch monitor gives the number.",
    "test_club": "A few more test-club shots would settle it.",
}


def _lie_cut(est: InputEstimates, ours: Recommendation):
    need, sd, kind = _lie_need(est)
    lines = [n + 0.5 for n in range(-3, 3)]  # between the -3 ... +3 options
    line = min(lines, key=lambda x: abs(need - x))
    alt = ours.lie_deg + (1 if need < line else -1)
    if not -3 <= alt <= 3:
        return None
    d = abs(need - line)
    step = (
        f"Your lie need ({need:+.1f} deg) is {d:.1f} deg from a rounding line. "
        + LIE_NEXT_STEP[kind]
    )
    return Cutoff(name="lie rounding line (deg)", value=line, distance=d, sigma=sd), alt, step


def _grip_cut(est: InputEstimates, ours: Recommendation):
    if est.hand is None or "glove" in est.at_prior:
        return None
    hand, sd = est.hand.value, est.hand.sd
    edge, below, above = min(pack.grip_change_edges_cm(), key=lambda e: abs(hand - e[0]))
    alt = above if hand < edge else below
    if alt == ours.grip:
        return None
    d = abs(hand - edge)
    step = f"You're {d:.1f} cm from the next grip size. Measuring your hand again would settle it."
    return Cutoff(name="grip hand-length edge (cm)", value=edge, distance=d, sigma=sd), alt, step


def _head_cut(ranking: list[HeadScore], ours: Recommendation):
    if len(ranking) < 2:
        return None
    gap = ranking[0].total - ranking[1].total
    alt = ranking[1].head if ranking[0].head == ours.head else ranking[0].head
    step = (
        f"{ours.head} and {alt} are {gap:g} point{'s' if gap != 1 else ''} apart on your answers, "
        "so either is a fair pick. Hitting both on a launch monitor would decide it."
    )
    return Cutoff(name="head score gap (points)", value=1.0, distance=gap, sigma=None), alt, step


def find_close_calls(
    est: InputEstimates,
    answers: MappedAnswers,
    ours: Recommendation,
    ranking: list[HeadScore],
    per_part: dict[Part, PartConfidence],
) -> tuple[list[CloseCall], dict[Part, PartConfidence]]:
    """The close calls, most important first (WEIGHTS × (1 − share)), and per_part with
    `close_call` / `next_step` filled in."""
    cuts = {
        "flex": _flex_cut(est, answers, ours),
        "length": _length_cut(est, ours),
        "lie": _lie_cut(est, ours),
        "grip": _grip_cut(est, ours),
        "head": _head_cut(ranking, ours),
    }
    calls: list[CloseCall] = []
    updated = dict(per_part)
    for part in PARTS:
        pc = per_part.get(part)
        if pc is None:
            continue
        cut = cuts.get(part)
        by_share = pc.share < SHARE_BELOW
        by_cutoff = False
        if cut is not None:
            c = cut[0]
            if part == "head":
                by_cutoff = c.distance <= 1.0
            elif c.sigma:
                by_cutoff = c.distance <= c.sigma
        if not (by_share or by_cutoff):
            continue
        alt = cut[1] if cut is not None else pc.alt
        step = cut[2] if cut is not None else None
        calls.append(
            CloseCall.model_validate(
                {
                    "part": part,
                    "ours": pc.ours,
                    "alt": alt,
                    "share": pc.share,
                    "nearest_cutoff": cut[0] if cut is not None else None,
                    "next_step": step,
                }
            )
        )
        updated[part] = pc.model_copy(update={"close_call": True, "alt": alt, "next_step": step})
    calls.sort(key=lambda c: -pack.WEIGHTS[c.part] * (1 - c.share))
    return calls, updated

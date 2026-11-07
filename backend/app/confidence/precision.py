"""Precision offers: "add more for precision" after every import (plan §5.5).

1. Offers run while something is uncertain: a close call (§3.5), a part with share < 0.70, or a
   gate below `confident`. Otherwise nothing is offered and the assistant moves on.
2. Every part not offered before proposes the next rung of its evidence ladder, with its
   expected gain: the rise in C when the meter is re-run as if that evidence were in (same seed,
   so only the input changes).
3. The rung with the largest gain (at least MIN_GAIN) is the offer. This differs from §5.5 step 2
   (rank by WEIGHTS × (1 − share)): ranking by gain offers the evidence that firms up the fit
   most, the same measure that ranks `missing` (§3.4).

A part whose uncertainty no offerable evidence can reduce is skipped rather than offered. In v1
that is the head: its spread comes from the self-reported score bucket, which test-club shots do
not change. Pure: no I/O, no LLM. Offers suggest evidence, never practice or swing changes (L18).
"""

from __future__ import annotations

import dataclasses
import math
from collections.abc import Iterable
from dataclasses import dataclass

import numpy as np

from app import pack
from app.confidence.montecarlo import simulate
from app.fitting import priors
from app.fitting.mapping import Choice, Estimate, InputEstimates, LieEvidence
from app.schemas.common import Part, Provenance
from app.schemas.fit import CloseCall, MappedAnswers, Recommendation
from app.schemas.state.confidence import PartConfidence

MIN_GAIN = 0.005  # below half a point of C, an offer is not worth the golfer's time
SHARE_BELOW = 0.70


@dataclass(frozen=True)
class Rung:
    """One step up a part's evidence ladder."""

    code: str  # reason_code, stable
    label: str  # the option the golfer taps
    reason: str  # one plain sentence on why
    needs_simulator: bool = False
    club_hint: str | None = None
    estimates: InputEstimates | None = None  # what the meter sees once the evidence is in


def _measured(note: str) -> Provenance:
    return Provenance(source="derived", note=note)


def _lie_rung(est: InputEstimates) -> Rung | None:
    """static chart -> ball-line (5) -> 5 more readings -> own-7i TrackMan -> test club."""
    assert est.height and est.wrist_to_floor
    lie = est.lie
    need = lie.value if lie else pack.static_lie_deg(est.height.value, est.wrist_to_floor.value)

    def with_lie(kind: str, sd: float, weight: float) -> InputEstimates:
        ev = LieEvidence(kind, need, sd, weight, need, _measured(f"offer: {kind}"))
        return dataclasses.replace(est, lie=ev)

    if lie is None:
        return Rung(
            "lie_ball_line",
            "Do the ball-line test (5 shots)",
            "Your lie comes from the static chart only. "
            "The ball-line test shows which way to lean.",
            estimates=with_lie("ball_line", priors.BALL_LINE_READING_SD, 0.5),
        )
    if lie.kind == "ball_line" and (lie.prov.n or 0) <= 5:
        return Rung(
            "lie_ball_line_more",
            "Add 5 more ball-line readings",
            "Your ball-line test is short. More readings pool into a steadier number.",
            estimates=with_lie("ball_line", priors.BALL_LINE_READING_SD / math.sqrt(2), 0.5),
        )
    if lie.kind in ("ball_line", "own_7i"):
        return Rung(
            "lie_test_club",
            "Import my Takomo test-club shots",
            "Your lie comes from your own club, whose lie we don't know. Shots with a Takomo test "
            "club give the number.",
            needs_simulator=True,
            club_hint="takomo_201-mkii_kbs-tour-regular_std",
            estimates=with_lie("test_club", 0.19, 1.0),
        )
    return None


def _flex_rung(est: InputEstimates) -> Rung | None:
    """self-reported speed or carry -> own-7i shots -> 8-10 shots near a flex line."""
    if est.speed is None:
        return None
    speed = est.speed.value
    from_shots = est.swing_prov is not None and est.swing_prov.source in ("trackman", "radar")
    if not from_shots:
        sd = 2.0 / math.sqrt(10)
        return Rung(
            "flex_own_7i_shots",
            "Import a 7-iron launch-monitor session",
            "Your flex comes from what you told us. Measured club speed settles it.",
            club_hint="own_7i",
            estimates=dataclasses.replace(est, speed=Estimate(speed, sd, _measured("offer"))),
        )
    n = est.speed.prov.n or 0
    near = min(abs(speed - x) for x in (60.0, 70.0, 80.0, 90.0)) < 2.0
    if near and n < 8:
        sd = 2.0 / math.sqrt(n + 5)
        return Rung(
            "flex_more_shots",
            "Add 5 more shots",
            f"You're within 2 mph of a flex line. 8-10 shots settle it (you have {n}).",
            club_hint="own_7i",
            estimates=dataclasses.replace(est, speed=Estimate(speed, sd, _measured("offer"))),
        )
    return None


def _flight_rung(est: InputEstimates) -> Rung | None:
    """questionnaire -> own-7i landing angle -> test-club shots."""
    f = est.flight
    if f is None or "flight" in est.at_prior:
        return None
    note = f.prov.note or ""
    # An own-7i landing angle too close to a line kept the golfer's answer: they already have
    # own-7i shots, so the next rung is the test club.
    own_shots_seen = "own 7-iron landing angle" in note
    if f.prov.source == "questionnaire" and not own_shots_seen:
        wrong, code, label, club = (
            priors.FLIGHT_WRONG["own_7i"],
            "flight_own_7i_shots",
            "Import a 7-iron launch-monitor session",
            "own_7i",
        )
    elif note.startswith("own 7-iron") or own_shots_seen:
        wrong, code, label, club = (
            priors.FLIGHT_WRONG["test_club"],
            "flight_test_club",
            "Import my Takomo test-club shots",
            "takomo_201-mkii_kbs-tour-regular_std",
        )
    else:
        return None
    return Rung(
        code,
        label,
        "Your flight decides the shaft model. Measured landing angles check it.",
        club_hint=club,
        estimates=dataclasses.replace(est, flight=Choice(f.value, _measured("offer"), wrong)),
    )


def _grip_rung(est: InputEstimates) -> Rung | None:
    """guessed or reported glove -> measured hand length."""
    if est.hand is not None or est.glove is None:
        return None
    i = pack.GLOVE_ORDER.index(str(est.glove.value))
    edges = (14.0, *pack.GLOVE_EDGES_CM, 23.0)
    mid = (edges[i] + edges[i + 1]) / 2  # a hand in the middle of the reported size
    hand = Estimate(mid, 0.35, _measured("offer"))
    return Rung(
        "grip_measure_hand",
        "Measure my hand",
        "Your grip comes from your glove size. Measuring your hand settles it.",
        estimates=dataclasses.replace(est, hand=hand),
    )


def _length_rung(est: InputEstimates) -> Rung | None:
    """height -> re-measured in golf shoes (when near a height line)."""
    h = est.height
    if h is None or "height_cm" in est.at_prior or h.prov.source != "questionnaire":
        return None
    sd = h.sd / math.sqrt(2)  # a second, careful measurement
    return Rung(
        "length_remeasure",
        "Measure my height again in golf shoes",
        "You're close to the next length. A careful measurement settles it.",
        estimates=dataclasses.replace(est, height=Estimate(h.value, sd, _measured("offer"))),
    )


LADDERS = {
    "lie": _lie_rung,
    "flex": _flex_rung,
    "shaft_model": _flight_rung,  # the model is matched on flight and tempo
    "grip": _grip_rung,
    "length": _length_rung,
}
# Parts with no ladder of their own share another part's evidence: an offer is named after the
# owner, and offering (or declining) it covers both, so the same evidence is never asked twice.
LADDER_OWNER: dict[Part, Part] = {
    "material": "flex",  # material follows flex (lady/senior -> graphite)
    "purchase": "lie",  # stock vs custom here is almost always the lie
}


def ladder_part(part: Part) -> Part:
    return LADDER_OWNER.get(part, part)


@dataclass(frozen=True)
class PrecisionOffer:
    part: Part
    rung: Rung
    expected_gain: float


def qualifying_parts(
    per_part: dict[Part, PartConfidence], close_calls: Iterable[CloseCall]
) -> list[Part]:
    """Close calls and parts with share < 0.70, most important first: WEIGHTS × (1 − share)."""
    called: set[Part] = {c.part for c in close_calls}
    parts: list[Part] = [p for p, pc in per_part.items() if p in called or pc.share < SHARE_BELOW]

    def importance(p: Part) -> float:
        return pack.WEIGHTS[p] * (1 - per_part[p].share)

    return sorted(parts, key=importance, reverse=True)


def best_offer(
    est: InputEstimates,
    answers: MappedAnswers,
    best: Recommendation,
    per_part: dict[Part, PartConfidence],
    close_calls: list[CloseCall],
    *,
    seed: int,
    confidence: float,
    offered: Iterable[Part] = (),
    n: int = 300,
    confident: bool | None = None,
) -> PrecisionOffer | None:
    """The one follow-up to offer now, or None.

    Offers run only while something is uncertain: the gate is below `confident`, or a close call
    (or share < 0.70) is left that some rung could help with (§5.5).
    Among the evidence on offer, the rung with the largest expected gain in C wins: the same
    value-of-information measure that ranks `missing` (§3.4). That can be a part that is not
    itself a close call: after Mikko's own-7i import, test-club shots for lie raise C most.
    Each ladder is offered at most once per session; material and purchase use the flex and lie
    ladders and are named after them (LADDER_OWNER).
    """
    qualifying = {ladder_part(p) for p in qualifying_parts(per_part, close_calls)}
    is_confident = confidence >= 0.70 if confident is None else confident
    done = {ladder_part(p) for p in offered}

    def importance(p: Part) -> float:
        return pack.WEIGHTS[p] * (1 - per_part[p].share)

    seen: set[str] = set()
    candidates: list[tuple[Part, Rung]] = []
    for p in sorted(per_part, key=importance, reverse=True):
        part = ladder_part(p)
        if part in done or part not in LADDERS:
            continue
        rung = LADDERS[part](est)
        if rung is None or rung.estimates is None or rung.code in seen:
            continue
        seen.add(rung.code)
        candidates.append((part, rung))

    # Stop when confident and no close call is left that an offer could help with (a head close
    # call driven by the self-reported score has no rung, so it does not keep offers running).
    if is_confident and not any(part in qualifying for part, _ in candidates):
        return None
    top: PrecisionOffer | None = None
    for part, rung in candidates:
        assert rung.estimates is not None
        after = simulate(rung.estimates, answers, best, np.random.default_rng(seed), n)
        gain = after.confidence - confidence
        if gain >= MIN_GAIN and (top is None or gain > top.expected_gain):
            top = PrecisionOffer(part, rung, round(gain, 4))
    return top

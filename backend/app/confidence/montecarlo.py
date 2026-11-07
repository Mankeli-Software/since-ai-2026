"""Monte Carlo over "possible truths" (plan §3.4 v1).

Draw N possible golfers around what we know (each input at its σ, unmeasured fields from their
priors, discrete self-reports with their measured error rates), run Takomo's rules on each, and
count how often each spec part agrees with our recommendation. C is the WEIGHTS-weighted mean of
those shares: a strict exact-agreement estimate.

Pure: no I/O, no LLM. The rules are reached through `app.pack`; per-sample calls are cached on
the inputs that can change the answer (swing bucket, flight, tempo, glove, length band), so 300
samples cost a handful of real `recommend` calls.
"""

from __future__ import annotations

import bisect
import hashlib
from collections import Counter
from dataclasses import dataclass
from functools import lru_cache
from typing import cast

import numpy as np

from app import pack
from app.fitting import priors
from app.fitting.mapping import InputEstimates
from app.schemas.common import GripSize, HeadSlug, Part
from app.schemas.fit import MappedAnswers, Recommendation
from app.schemas.state.confidence import PartConfidence

N_SAMPLES = 300
PARTS: tuple[Part, ...] = (
    "head",
    "flex",
    "material",
    "shaft_model",
    "length",
    "lie",
    "grip",
    "purchase",
    "handedness",
)
GLOVES = pack.GLOVE_ORDER
FLIGHTS = ("low", "mid", "high")


def seed_for(session_id: str, evidence_version: int) -> int:
    """Reproducible per session and evidence version. Never the built-in, per-process `hash()`."""
    digest = hashlib.sha256(f"{session_id}:{evidence_version}".encode()).digest()
    return int.from_bytes(digest[:8], "little")


@dataclass(frozen=True)
class SampleResult:
    confidence: float
    per_part: dict[Part, PartConfidence]


# --------------------------------------------------------------------------- the rules, cached


def _band_height(band: int) -> float:
    """A height inside length band `band` (the rules give every height in a band one length)."""
    edges = pack.length_height_edges_cm()
    return edges[band] - 1.0 if band < len(edges) else edges[-1] + 1.0


@lru_cache(maxsize=8192)
def _spec(
    static: tuple, score_bucket: int, swing: int, flight: str, tempo: str, glove: str, band: int
) -> tuple[str, ...]:
    """(head, shaft, flex, material, shaft_model, length, grip, handedness) from the rules.
    `static` = (age, sex, characteristics, handedness). The lie is not part of the key: the
    sampler sets it from the sampled lie need."""
    age, sex, chars, handedness = static
    a = MappedAnswers.model_validate(
        {
            "age": age,
            "sex": sex,
            "score_bucket": score_bucket,
            "swing_bucket": swing,
            "characteristics": list(chars),
            "flight": flight,
            "tempo": tempo,
            "height_cm": _band_height(band),
            "wrist_to_floor_cm": 87.0,
            "glove": glove,
            "handedness": handedness,
        }
    )
    r = pack.get_engine().recommend(a, top_n=1)[0]
    return (
        r.head,
        r.shaft,
        r.flex,
        r.material,
        r.shaft_model or "",
        str(r.length_in),
        r.grip,
        r.handedness,
    )


@lru_cache(maxsize=8192)
def _purchase(head: str, shaft: str, length: str, lie: int, grip: str) -> str:
    engine = pack.get_engine()
    return engine.purchase_for(
        cast(HeadSlug, head), shaft, float(length), lie, cast(GripSize, grip)
    )


# --------------------------------------------------------------------------- discrete draws


def _draw_choice(rng: np.random.Generator, shares: dict[str, float], n: int) -> list[str]:
    keys = list(shares)
    p = np.array([shares[k] for k in keys], float)
    return [keys[i] for i in rng.choice(len(keys), size=n, p=p / p.sum())]


def _draw_flight(rng: np.random.Generator, value: str, wrong: float, n: int) -> list[str]:
    """Reported/measured flight, wrong at rate `wrong`, and then one step off (simulator: "otherwise
    one step off"). From mid, high vs low follows the population shares."""
    out = []
    flips = rng.random(n) < wrong
    side = rng.random(n)
    hi = priors.FLIGHT["high"] / (priors.FLIGHT["high"] + priors.FLIGHT["low"])
    for flip, u in zip(flips, side, strict=True):
        if not flip:
            out.append(value)
        elif value == "mid":
            out.append("high" if u < hi else "low")
        else:
            out.append("mid")
    return out


def _draw_glove(rng: np.random.Generator, value: str, n: int) -> list[str]:
    """A questionnaire glove: exact / one size off / two or more off, at the train rates."""
    i0 = GLOVES.index(value)
    off = rng.choice(3, size=n, p=np.array(priors.GLOVE_OFF_BY) / sum(priors.GLOVE_OFF_BY))
    up = rng.random(n) < 0.5
    out = []
    for k, u in zip(off, up, strict=True):
        cands = [i for i in ((i0 + k, i0 - k) if u else (i0 - k, i0 + k)) if 0 <= i < len(GLOVES)]
        if not cands:  # two off is impossible from here: one off instead
            cands = [i for i in (i0 + 1, i0 - 1) if 0 <= i < len(GLOVES)]
        out.append(GLOVES[cands[0]])
    return out


# --------------------------------------------------------------------------- the simulation


def simulate(
    est: InputEstimates,
    answers: MappedAnswers,
    ours: Recommendation,
    rng: np.random.Generator,
    n: int = N_SAMPLES,
) -> SampleResult:
    """Agreement of `ours` with the rules over `n` possible truths drawn around `est`."""
    assert est.height and est.wrist_to_floor and est.flight and est.tempo and est.glove

    # continuous inputs
    if est.speed is not None:
        swing = pack.swing_buckets_from_speeds(rng.normal(est.speed.value, est.speed.sd, n))
    else:
        swing = [int(est.swing_bucket or answers.swing_bucket)] * n
    height = rng.normal(est.height.value, est.height.sd, n)
    wtf = rng.normal(est.wrist_to_floor.value, est.wrist_to_floor.sd, n)

    # discrete inputs
    if est.hand is not None:
        gloves = pack.gloves_from_hand_lengths(rng.normal(est.hand.value, est.hand.sd, n))
    else:
        gloves = _draw_glove(rng, str(est.glove.value), n)
    if "flight" in est.at_prior:
        flights = _draw_choice(rng, priors.FLIGHT, n)
    else:
        measured = est.flight.prov.source in ("trackman", "radar")
        wrong = priors.FLIGHT_WRONG["landing_angle" if measured else "questionnaire"]
        flights = _draw_flight(rng, str(est.flight.value), wrong, n)
    if "tempo" in est.at_prior:
        tempos = _draw_choice(rng, priors.TEMPO, n)
    elif est.tempo.prov.source == "questionnaire":
        tempos = _draw_choice(rng, priors.TEMPO_GIVEN_REPORTED[str(est.tempo.value)], n)
    else:
        tempos = [str(est.tempo.value)] * n
    reported = int(answers.score_bucket)
    if est.score_bucket is not None and est.score_bucket.prov.source == "questionnaire":
        given = {str(k): v for k, v in priors.SCORE_BUCKET_GIVEN_REPORTED[reported].items()}
        scores = [int(x) for x in _draw_choice(rng, given, n)]
    else:
        scores = [reported] * n

    # lie need: the chart on the sampled body plus the delivery spread, unless evidence says more
    chart = pack.static_lie_deg_many(height, wtf) + rng.normal(0.0, priors.LIE_DELIVERY_SD, n)
    lie_ev = est.lie
    if lie_ev is None:
        need = chart
    else:
        reading = rng.normal(lie_ev.reading, lie_ev.reading_sd, n)
        need = (
            reading
            if lie_ev.kind == "test_club"
            else (lie_ev.weight * reading + (1 - lie_ev.weight) * chart)
        )
    lies = np.clip(np.round(need), -3, 3).astype(int)  # np.round is round-half-even, like round()

    edges = pack.length_height_edges_cm()
    static = (answers.age, answers.sex, tuple(answers.characteristics), answers.handedness)
    values: dict[Part, list[object]] = {p: [] for p in PARTS}
    for i in range(n):
        band = bisect.bisect_right(edges, float(height[i]))
        head, shaft, flex, material, model, length, grip, hand = _spec(
            static, scores[i], swing[i], flights[i], tempos[i], gloves[i], band
        )
        lie = int(lies[i])
        values["head"].append(head)
        values["flex"].append(flex)
        values["material"].append(material)
        values["shaft_model"].append(model)
        values["length"].append(float(length))
        values["lie"].append(lie)
        values["grip"].append(grip)
        values["purchase"].append(_purchase(head, shaft, length, lie, grip))
        values["handedness"].append(hand)

    ours_values: dict[Part, object] = {
        "head": ours.head,
        "flex": ours.flex,
        "material": ours.material,
        "shaft_model": ours.shaft_model or "",
        "length": float(ours.length_in),
        "lie": int(ours.lie_deg),
        "grip": ours.grip,
        "purchase": ours.purchase,
        "handedness": ours.handedness,
    }
    per_part: dict[Part, PartConfidence] = {}
    for part in PARTS:
        counts = Counter(values[part])
        mine = ours_values[part]
        others = [(c, v) for v, c in counts.items() if v != mine]
        alt = max(others, key=lambda t: t[0])[1] if others else None
        per_part[part] = PartConfidence.model_validate(
            {"share": counts.get(mine, 0) / n, "ours": mine, "alt": alt}
        )
    total_w = sum(pack.WEIGHTS[p] for p in PARTS)
    c = sum(pack.WEIGHTS[p] * per_part[p].share for p in PARTS) / total_w
    return SampleResult(confidence=float(c), per_part=per_part)

"""`assess`: the confidence meter, gate and ranked `missing` list for one session (plan §3.4).

    a = assess(intake, evidence, session_id=sid, evidence_version=v)
    a.state       # ConfidenceStatePart: confidence, gate, strength, per_part, missing
    a.answers     # the MappedAnswers the result uses (unmeasured fields at their priors)
    a.best        # our recommendation, the spec C is measured against

Pure: no I/O, no LLM. Deterministic for a given (session_id, evidence_version).
"""

from __future__ import annotations

import dataclasses
from dataclasses import dataclass

import numpy as np

from app.confidence.gate import gate_for
from app.confidence.montecarlo import N_SAMPLES, SampleResult, seed_for, simulate
from app.fitting.mapping import (
    DEFAULT_OPTIONS,
    Choice,
    Estimate,
    InputEstimates,
    MappingOptions,
    answers_from_estimates,
    estimate_inputs,
    missing_minimum,
)
from app.fitting.recommend import recommend_fit
from app.schemas.common import Provenance
from app.schemas.fit import FitEvidence, IntakeAnswers, MappedAnswers, Recommendation
from app.schemas.state.confidence import ConfidenceStatePart


@dataclass(frozen=True)
class Assessment:
    state: ConfidenceStatePart
    answers: MappedAnswers | None = None
    best: Recommendation | None = None
    estimates: InputEstimates | None = None
    seed: int | None = None


def _as_measured(est: InputEstimates, name: str, o: MappingOptions) -> InputEstimates:
    """`est` with field `name` measured at its usual source's σ (value still the prior's):
    what asking for it would buy."""
    asked = Provenance(source="questionnaire")
    at_prior = tuple(f for f in est.at_prior if f != name)
    if name == "height_cm" and est.height:
        h = Estimate(est.height.value, o.height_self_sd_cm, asked)
        return dataclasses.replace(est, height=h, at_prior=at_prior)
    if name == "wrist_to_floor_cm" and est.wrist_to_floor:
        w = Estimate(est.wrist_to_floor.value, o.wtf_self_sd_cm, asked)
        return dataclasses.replace(est, wrist_to_floor=w, at_prior=at_prior)
    if name == "glove" and est.hand:
        hand = Estimate(est.hand.value, 0.35, Provenance(source="photo", sd=0.35))
        return dataclasses.replace(est, hand=hand, at_prior=at_prior)
    if name == "flight" and est.flight:
        return dataclasses.replace(est, flight=Choice(est.flight.value, asked), at_prior=at_prior)
    if name == "tempo" and est.tempo:
        return dataclasses.replace(est, tempo=Choice(est.tempo.value, asked), at_prior=at_prior)
    return est


def assess(
    intake: IntakeAnswers,
    evidence: FitEvidence | None = None,
    *,
    session_id: str,
    evidence_version: int = 0,
    options: MappingOptions = DEFAULT_OPTIONS,
    n: int = N_SAMPLES,
    rank_missing: bool = True,
) -> Assessment:
    """Confidence C, gate and `missing` (fields still at their prior, best gain in C first)."""
    ev = evidence or FitEvidence()
    if minimum := missing_minimum(intake, ev):
        return Assessment(ConfidenceStatePart(gate="needs_info", missing=minimum))

    est = estimate_inputs(intake, ev, options, fill_priors=True)
    answers = answers_from_estimates(intake, est)
    best = recommend_fit(answers, top_n=1).recs[0]
    seed = seed_for(session_id, evidence_version)

    def run(e: InputEstimates) -> SampleResult:
        # Same seed for every run: differences come from the inputs, not the draw.
        return simulate(e, answers, best, np.random.default_rng(seed), n)

    result = run(est)
    missing = list(est.at_prior)
    if rank_missing and missing:
        gains = {
            f: run(_as_measured(est, f, options)).confidence - result.confidence for f in missing
        }
        missing.sort(key=lambda f: -gains[f])

    gate, strength = gate_for(result.confidence)
    state = ConfidenceStatePart(
        confidence=round(result.confidence, 4),
        gate=gate,
        strength=strength,
        per_part=result.per_part,
        missing=missing,
    )
    return Assessment(state, answers, best, est, seed)

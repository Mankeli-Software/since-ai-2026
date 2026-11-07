"""One pass of the meter for a session: confidence, gate, close calls, best and runner-up
(plan §3.4, §3.5). `next_question` and the state refresh both read it, so the Monte Carlo runs
once per change. Pure: no I/O, no LLM.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from app.confidence.assess import assess
from app.confidence.close_calls import find_close_calls
from app.fitting.mapping import DEFAULT_OPTIONS, InputEstimates, MappingOptions
from app.fitting.recommend import recommend_fit
from app.schemas.common import Part
from app.schemas.confidence import NextQuestionResponse
from app.schemas.fit import CloseCall, FitEvidence, IntakeAnswers, MappedAnswers, Recommendation
from app.schemas.state import FittingState, NextQuestionHint
from app.schemas.state.confidence import ConfidenceStatePart, PartConfidence


@dataclass(frozen=True)
class Analysis:
    state: ConfidenceStatePart  # confidence, gate, strength, per_part (with close calls), missing
    answers: MappedAnswers | None = None
    best: Recommendation | None = None
    runner_up: Recommendation | None = None
    estimates: InputEstimates | None = None
    close_calls: list[CloseCall] = field(default_factory=list)
    seed: int = 0

    @property
    def per_part(self) -> dict[Part, PartConfidence]:
        return dict(self.state.per_part)

    @property
    def confidence(self) -> float:
        return self.state.confidence or 0.0


def analyze(
    intake: IntakeAnswers,
    evidence: FitEvidence | None = None,
    *,
    session_id: str,
    evidence_version: int = 0,
    options: MappingOptions = DEFAULT_OPTIONS,
) -> Analysis:
    a = assess(
        intake, evidence, session_id=session_id, evidence_version=evidence_version, options=options
    )
    if a.answers is None or a.best is None or a.estimates is None:
        return Analysis(state=a.state)
    fit = recommend_fit(a.answers, top_n=2)
    runner_up = fit.recs[1] if len(fit.recs) > 1 else None
    calls, per_part = find_close_calls(
        a.estimates, a.answers, a.best, fit.ranking, a.state.per_part
    )
    state = a.state.model_copy(update={"per_part": per_part})
    return Analysis(state, a.answers, a.best, runner_up, a.estimates, calls, a.seed or 0)


def refresh_state(
    state: FittingState, analysis: Analysis, next_q: NextQuestionResponse | None = None
) -> FittingState:
    """`state` with the meter's fields, the best and runner-up spec and the next-question hint
    replaced from `analysis`. The version is left alone: the store bumps it on save."""
    hint = None
    if next_q is not None and next_q.kind != "none" and next_q.field:
        hint = NextQuestionHint(
            field=next_q.field,
            kind="intake" if next_q.kind == "intake" else "precision",
            reason=getattr(next_q.component, "prompt", None),
            part=next_q.part,
            reason_code=next_q.reason_code,
            expected_gain=next_q.expected_gain,
        )
    s = analysis.state
    return state.model_copy(
        update={
            "confidence": s.confidence,
            "gate": s.gate,
            "strength": s.strength,
            "per_part": s.per_part,
            "missing": s.missing,
            "next_question": hint,
            "best": analysis.best,
            "runner_up": analysis.runner_up,
        }
    )

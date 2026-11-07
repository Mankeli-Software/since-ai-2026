"""`next_question`: what the studio asks next (plan §2.3, §5.5). Deterministic.

Order:
1. Intake, in a fixed order: cheap closed questions first (onboarding basics), the joint-pain
   question, body measurements late (plan §4.6 rule 5). A field counts as known when the intake
   or the evidence supplies it, or the golfer already answered it ("I don't know" included).
2. The ball-line offer, once, when there is no lie evidence at all (no test-club shots, no
   own-7i Dynamic Lie, no ball-line readings).
3. A precision offer (§5.5): the evidence that would firm the fit up most, once per part.
4. Nothing: the fit is as good as the evidence on offer makes it.

The model only phrases the question; the form fallback (#3) walks the same function.
Pure: no I/O, no LLM.
"""

from __future__ import annotations

from collections.abc import Iterable

from app.confidence.analysis import Analysis
from app.confidence.precision import best_offer
from app.fitting.mapping import missing_inputs
from app.schemas.common import Part
from app.schemas.confidence import NextQuestionResponse
from app.schemas.fit import FitEvidence, IntakeAnswers
from app.schemas.ui.body_measure import BodyMeasure
from app.schemas.ui.choice_chips import ChoiceChips, ChoiceOption
from app.schemas.ui.data_import import DataImport
from app.schemas.ui.slider import Slider

BALL_LINE_OFFER = "ball_line_offer"
HAPPY = ChoiceOption(id="happy", label="I'm happy with this")


def _chips(field: str, prompt: str, options: Iterable[tuple[str, str]], multi: bool = False):
    opts = [ChoiceOption(id=i, label=label) for i, label in options]
    return ChoiceChips(prompt=prompt, field=field, options=opts, multi=multi)


# (key in missing_inputs or the answered set, profile field, component). Fixed order. Body
# measurements use `body_measure` (unit switch + how-to diagram); its `field` is the block's own
# name ("height"), the profile field is `height_cm`.
INTAKE: tuple[tuple[str, str, ChoiceChips | Slider | BodyMeasure], ...] = (
    ("handedness", "handedness", _chips("handedness", "Which hand do you swing with?",
        [("right", "Right-handed"), ("left", "Left-handed")])),
    ("age", "age", Slider(prompt="How old are you?", field="age", unit="years", min=8, max=100)),
    ("sex", "sex", _chips("sex", "Which fits you best for club sizing?",
        [("male", "Male"), ("female", "Female")])),
    ("score_bucket", "score_bucket", _chips("score_bucket",
        "What do you usually shoot for 18? Your typical round, not your best one.",
        [("1", "Under 71"), ("2", "71-77"), ("3", "78-84"), ("4", "85-92"), ("5", "Over 92")])),
    ("swing", "reported_7i_carry_yd", Slider(prompt="How far do you carry your 7-iron?",
        field="reported_7i_carry_yd", unit="yd", min=60, max=220, step=5, allow_unknown=True)),
    ("characteristics", "characteristics", _chips("characteristics",
        "What matters most in your irons? Pick up to three.",
        [("forgiveness", "Forgiveness"), ("distance", "Distance"), ("forged feel", "Forged feel"),
         ("distance control", "Distance control"), ("more offset", "More offset"),
         ("less offset", "Less offset")], multi=True)),
    ("flight", "flight", _chips("flight", "How high do you hit your irons?",
        [("low", "Low"), ("mid", "Medium"), ("high", "High")])),
    ("tempo", "tempo", _chips("tempo",
        "How would you describe your swing tempo? This is the rhythm of your swing, "
        "not how fast it is.",
        [("smooth", "Smooth"), ("moderate", "Moderate"), ("quick", "Quick")])),
    ("joint_pain", "joint_pain", _chips("joint_pain", "Any joint pain when you play?",
        [("none", "None"), ("hands", "Hands"), ("wrists", "Wrists"), ("elbows", "Elbows"),
         ("shoulders", "Shoulders")], multi=True)),
    ("glove", "glove", _chips("glove", "Which glove size do you wear?",
        [(g, g) for g in ("XS", "S", "M", "M/L", "L", "XL")])),
    ("height_cm", "height_cm", BodyMeasure(field="height", diagram_id="height",
        prompt="How tall are you, in golf shoes?")),
    ("wrist_to_floor_cm", "wrist_to_floor_cm", BodyMeasure(field="wrist_to_floor",
        diagram_id="wrist_to_floor",
        prompt="Stand straight in golf shoes, arms relaxed. Measure from your wrist crease to "
        "the floor.")),
)  # fmt: skip

# Asked but optional: answering (or skipping) them is what counts, not having a value.
OPTIONAL = {"characteristics", "joint_pain"}


def _has_lie_evidence(ev: FitEvidence) -> bool:
    return bool(ev.ball_line_tilt_deg) or any(
        s.impact_toe_up_deg is not None and (s.club == "own_7i" or s.club.startswith("takomo_"))
        for s in ev.shots
    )


def next_question(
    intake: IntakeAnswers,
    evidence: FitEvidence | None,
    analysis: Analysis | None,
    *,
    answered: Iterable[str] = (),
    offered: Iterable[Part] = (),
) -> NextQuestionResponse:
    """The next thing to ask. `answered`: profile fields the golfer has already answered
    (including "I don't know"); `offered`: parts already given a precision offer."""
    ev = evidence or FitEvidence()
    asked = set(answered)
    missing = set(missing_inputs(intake, ev))
    for key, field, component in INTAKE:
        known = (key in asked or field in asked) if key in OPTIONAL else key not in missing
        if not known and field not in asked:
            return NextQuestionResponse(kind="intake", field=field, component=component)

    done = set(offered)
    if not _has_lie_evidence(ev) and BALL_LINE_OFFER not in asked and "lie" not in done:
        return NextQuestionResponse(
            kind="ball_line_offer",
            field=BALL_LINE_OFFER,
            part="lie",
            reason_code="lie_ball_line",
            component=DataImport(
                prompt="Your lie comes from a size chart. A 5-shot ball-line test on a mat shows "
                "which way to lean. Want to try it?",
                sources=["ball_line", "skip"],
                club_hint="own_7i",
                reason_code="lie_ball_line",
            ),
        )

    a = analysis
    if a is None or a.estimates is None or a.answers is None or a.best is None:
        return NextQuestionResponse(kind="none")
    offer = best_offer(
        a.estimates,
        a.answers,
        a.best,
        a.per_part,
        a.close_calls,
        seed=a.seed,
        confidence=a.confidence,
        offered=done,
    )
    if offer is None:
        return NextQuestionResponse(kind="none")
    rung = offer.rung
    options = [ChoiceOption(id=rung.code, label=rung.label)]
    if rung.needs_simulator:
        options.append(ChoiceOption(id="find_simulator", label="Find a simulator near me"))
    options.append(HAPPY)
    return NextQuestionResponse(
        kind="precision_offer",
        field="precision_offer",
        part=offer.part,
        reason_code=rung.code,
        expected_gain=offer.expected_gain,
        component=ChoiceChips(prompt=rung.reason, field="precision_offer", options=options[:4]),
    )

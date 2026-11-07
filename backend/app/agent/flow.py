"""The fitter's conversation order for the live engine (VISION §6, design K0). It wraps FIT's
deterministic `next_question` and changes only the order and the cards, never the fit:

1. Talk, "how's your game?" (VISION §6.4): how the irons fly, what the golfer would change and
   anything that hurts. Every talk card also takes free text, so one typed answer can fill all
   three. The first card after the opening is the `opener`: the model asks the open question.
2. Evidence (§6.5): "hit in a simulator lately?" as a fork. Yes: which one (own fittings), then
   the import. No: the fallback questions fill the gaps (score, carry as a guess, tempo).
3. Body last (§6.6): height, wrist to floor, then glove size.
4. Reveal (§6.7) as soon as the intake is complete. A precision offer comes right after an
   import and once after the reveal (plan §5.5), never as a gate in front of the result.

Flow markers live in `session.profile` as `flow_*` keys (source "derived"); no fit input reads
them. Pure: no I/O, no LLM.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal

from app.confidence.analysis import analyze
from app.confidence.next_question import INTAKE, SIMULATOR_QUESTION
from app.confidence.next_question import next_question as fit_next_question
from app.fitting.beginner import BEGINNER_SKIPS, is_beginner
from app.fitting.session_inputs import answered, evidence_of, intake_of
from app.schemas.common import Part, ProvenancedValue
from app.schemas.fit import IntakeAnswers
from app.schemas.session import FitSession
from app.schemas.ui import UIBlockBase
from app.schemas.ui.body_measure import BodyMeasure, MeasureOption
from app.schemas.ui.choice_chips import ChoiceChips, ChoiceOption
from app.schemas.ui.data_import import DataImport
from app.schemas.ui.slider import Slider
from app.schemas.ui.source_picker import SourceFallback, SourceOption, SourcePicker
from app.schemas.ui.yes_no_fork import ForkOption, YesNoFork

Phase = Literal["talk", "evidence", "questions", "body", "offer"]

TALKED = "flow_talk"  # the opener was asked
REVEALED = "flow_revealed"  # run_fit returned a fit (the card follows it)
OFFER = "flow_offer"  # "<part>|<reason_code>|<evidence_version>" of the last offer shown
LAST = "flow_last"  # field of the last step shown, or "import" right after an import
AFTER_REVEAL = "flow_after_reveal_offer"  # the one offer after the reveal was shown
SIM_BRAND = "sim_brand"
NO_FILE = "none"  # the simulator picker's fallback tile


def _chips(field: str, prompt: str, options: list[tuple[str, str, str | None]], multi=False):
    return ChoiceChips(
        field=field,
        prompt=prompt,
        multi=multi,
        allow_free_text=True,
        options=[ChoiceOption(id=i, label=label, hint=hint) for i, label, hint in options],
    )


# Talk cards, in order. Option ids are FIT's, so the answers save as they are.
TALK: tuple[tuple[str, ChoiceChips], ...] = (
    ("flight", _chips("flight", "How do your irons usually fly?", [
        ("low", "Low", "Hard to stop on the green"), ("mid", "Medium", None),
        ("high", "High", "They climb and float")])),
    ("characteristics", _chips("characteristics",
        "What would you change about your irons? Pick up to three.", [
        ("forgiveness", "Forgiveness", "Misses that still get there"),
        ("distance", "Distance", None),
        ("forged feel", "Forged feel", "Softer at impact"),
        ("distance control", "Distance control", "Same swing, same carry"),
        ("more offset", "More offset", "Helps a slice"),
        ("less offset", "Less offset", "Cleaner look at address")], multi=True)),
    ("joint_pain", _chips("joint_pain", "Anything ache when you play?", [
        ("none", "Nothing, all good", None), ("hands", "Hands", None), ("wrists", "Wrists", None),
        ("elbows", "Elbows", None), ("shoulders", "Shoulders", None)], multi=True)),
)  # fmt: skip

SIM_FORK = YesNoFork(
    prompt="Have you hit in a simulator lately?",
    options=[
        ForkOption(
            id="yes",
            title="Yes, I have sim data",
            body="Bring real shots in. It's the biggest upgrade to your fit, and you'll see "
            "confidence jump.",
            illustration="sim_data",
        ),
        ForkOption(
            id="no",
            title="I'll answer myself",
            body="No problem. A few more questions instead. Guesses are marked as guesses, and "
            "you can add shots later.",
            illustration="by_hand",
        ),
    ],
)
SIMS = {
    "trackman": ("TrackMan", "Export a CSV from the app"),
    "foresight": ("Foresight", "GCQuad, GC3: CSV export"),
    "garmin": ("Garmin", "Approach R10: CSV export"),
    "uneekor": ("Uneekor", "EYE XO, QED: CSV export"),
    "other_csv": ("Something else", "Any launch monitor CSV"),
}
SIM_PICKER = SourcePicker(
    prompt="Which simulator was it?",
    options=[SourceOption(id=i, name=n, hint=h) for i, (n, h) in SIMS.items()],
    fallback=SourceFallback(
        id=NO_FILE, title="No file handy", body="Skip it for now. Add data works any time."
    ),
)
GLOVE = BodyMeasure(
    field="glove",
    prompt="What glove size do you wear? It sets your grip.",
    unit_options=["cm"],
    diagram_id="hand_length",
    options=[
        MeasureOption(id="XS", label="XS"),
        MeasureOption(id="S", label="S", sub="17 cm"),
        MeasureOption(id="M", label="M", sub="18 cm"),
        MeasureOption(id="M/L", label="ML", sub="18.5 cm"),
        MeasureOption(id="L", label="L", sub="19 cm"),
        MeasureOption(id="XL", label="XL", sub="20 cm"),
    ],
)
BODY = ("height_cm", "wrist_to_floor_cm", "glove")
_FIT_CARD = {field: component for _key, field, component in INTAKE}
_MISSING_KEY = {field: key for key, field, _component in INTAKE}


@dataclass
class Step:
    status: Literal["ask", "complete"]
    field: str | None = None
    kind: Literal["intake", "precision"] = "intake"
    phase: Phase | None = None
    component: UIBlockBase | None = None
    part: Part | None = None
    reason_code: str | None = None
    expected_gain: float | None = None
    opener: bool = False
    missing: tuple[str, ...] = ()


def _value(s: FitSession, key: str) -> Any:
    pv = s.profile.get(key)
    return pv.value if pv is not None else None


def mark(s: FitSession, **values: Any) -> None:
    for k, v in values.items():
        s.profile[k] = ProvenancedValue(source="derived", value=v)


def _import_card(s: FitSession) -> DataImport:
    fallback = "TrackMan" if s.demo_golfer_id else "launch monitor"  # persona samples: TrackMan
    name = SIMS.get(str(_value(s, SIM_BRAND)), (fallback, ""))[0]
    if name == "Something else":
        name = "launch monitor"
    return DataImport(
        prompt=f"Bring in your 7-iron shots from your {name} session.",
        sources=["csv", "skip"],
        club_hint="own_7i",
        reason_code="swing_speed",
    )


def _ask(s: FitSession, step: Step) -> Step:
    """The first card after the opening is the opener, whatever it asks."""
    if TALKED not in s.profile:
        step.opener = True
    return step


def next_step(s: FitSession) -> Step:
    intake = intake_of(s)  # beginner defaults applied
    ev = evidence_of(s)
    a = analyze(intake, ev, session_id=s.id, evidence_version=s.evidence_version)
    asked = answered(s)
    missing = set(a.state.missing)
    beginner = is_beginner(intake)
    out = tuple(a.state.missing)

    # 0. The opening card's basics, when the golfer typed instead of tapping it
    for field in ("handedness", "age", "sex"):
        if field in missing and field not in asked:
            card = _FIT_CARD[field]
            return _ask(s, Step("ask", field, phase="questions", component=card, missing=out))

    # 1. Talk
    for field, card in TALK:
        if beginner and field in BEGINNER_SKIPS or field in asked or getattr(intake, field):
            continue
        return _ask(s, Step("ask", field, phase="talk", component=card, missing=out))

    # 2. Evidence: measured shots beat any guess. New golfers get the gentle path (no fork).
    if not beginner and not ev.shots:
        if SIMULATOR_QUESTION not in asked:
            return _ask(
                s,
                Step("ask", SIMULATOR_QUESTION, phase="evidence", component=SIM_FORK, missing=out),
            )
        if intake.hit_on_simulator == "yes":
            if not s.demo_golfer_id and SIM_BRAND not in asked:
                return _ask(
                    s, Step("ask", SIM_BRAND, phase="evidence", component=SIM_PICKER, missing=out)
                )
            return _ask(
                s,
                Step(
                    "ask",
                    SIMULATOR_QUESTION,
                    phase="evidence",
                    component=_import_card(s),
                    reason_code="swing_speed",
                    missing=out,
                ),
            )

    # 3. FIT's order for the remaining gaps, body last and glove after height and wrist.
    fq = fit_next_question(intake, ev, a, answered=asked, offered=s.state.precision_offered)
    if fq.kind == "intake" and fq.field:
        field = fq.field
        if field in BODY:
            field = next(
                f for f in BODY if f == field or (_MISSING_KEY[f] in missing and f not in asked)
            )
        card = fq.component if field == fq.field else _FIT_CARD[field]
        if field == "glove":
            card = GLOVE
        elif isinstance(card, Slider) and field == "reported_7i_carry_yd":
            card = card.model_copy(update={"measured_or_guessed_toggle": True})
        phase: Phase = "body" if field in BODY else "questions"
        return _ask(s, Step("ask", field, phase=phase, component=card, missing=out))

    # 4. Offers: right after an import, and once after the reveal. Otherwise reveal first.
    if fq.kind in ("ball_line_offer", "precision_offer") and fq.component is not None:
        key = f"{fq.part}|{fq.reason_code}|{s.evidence_version}"
        # The offer after the reveal waits for the next turn, so the reveal ends with words.
        revealed = _value(s, REVEALED) not in (None, s.active_turn_id)
        after_import = _value(s, LAST) == "import"
        if _value(s, OFFER) == key or after_import or (revealed and AFTER_REVEAL not in s.profile):
            return Step(
                "ask",
                fq.field,
                kind="precision",
                phase="offer",
                component=fq.component,
                part=fq.part,
                reason_code=fq.reason_code,
                expected_gain=fq.expected_gain,
                missing=out,
            )
    return Step("complete", missing=out)


def least_certain(s: FitSession) -> dict[str, str] | None:
    """The part FIT would offer more precision for next, and why: the reveal names it."""
    intake = intake_of(s)
    ev = evidence_of(s)
    a = analyze(intake, ev, session_id=s.id, evidence_version=s.evidence_version)
    fq = fit_next_question(intake, ev, a, answered=answered(s), offered=s.state.precision_offered)
    if fq.kind not in ("ball_line_offer", "precision_offer") or fq.part is None:
        return None
    return {"part": fq.part, "why": getattr(fq.component, "prompt", "")}


def shown(s: FitSession, step: Step) -> None:
    """Record that `step` goes on screen, so the opener and each offer happen once."""
    mark(s, **{LAST: step.field})
    if step.opener:
        mark(s, **{TALKED: True})
    if step.phase == "offer":
        mark(s, **{OFFER: f"{step.part}|{step.reason_code}|{s.evidence_version}"})
        if REVEALED in s.profile:
            mark(s, **{AFTER_REVEAL: True})


# Card field -> profile field, where they differ.
_PROFILE_FIELD = {"height": "height_cm", "wrist_to_floor": "wrist_to_floor_cm"}


def answer_fields(tool: str, block: dict[str, Any], value: Any, s: FitSession) -> dict | None:
    """The profile fields a tapped answer saves, {} when it saves nothing, None when the model
    must handle it (free text, "Not sure", anything unexpected)."""
    if tool == "ui_yes_no_fork":
        return {SIMULATOR_QUESTION: value} if value in ("yes", "no") else None
    if tool == "ui_source_picker":
        if value == NO_FILE:
            return {SIM_BRAND: value, SIMULATOR_QUESTION: "skip"}
        return {SIM_BRAND: value} if value in SIMS else None
    if tool == "ui_data_import":
        if (
            isinstance(value, dict)
            and value.get("skipped")
            and block.get("reason_code") == ("swing_speed")
        ):
            return {SIMULATOR_QUESTION: "skip"}
        return None
    field = block.get("field")
    if not isinstance(field, str):
        return None
    if isinstance(value, dict):  # slider with toggle, body_measure
        value = value["value_cm"] if "value_cm" in value else value.get("value")
    if value is None or value == "":
        return None
    if isinstance(value, str) and value.isdigit():
        value = int(value)  # bucket chips send "1".."5"
    name = _PROFILE_FIELD.get(field, field)
    if name not in IntakeAnswers.model_fields and name != "reported_7i_carry_m":
        return None  # an offer or anything else that is not a profile answer
    return {name: value}

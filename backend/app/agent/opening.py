"""The live engine's fixed opening: the design's greeting and the C2 background card, shown at once
with no model call (the same copy as turn 1 of `mock/scripts/own.yaml` and the web's instant
opening, `web/src/store/opening.ts`; keep the three in step).
Persona sessions get the card prefilled from their questionnaire. The engine saves the answer,
so the model's first turn starts from the next question."""

from typing import Any

from app.schemas.ui.sentence_builder import SentenceBuilder, SentenceToken, SentenceTokenOption

OPENING_ID = "opening"  # the card's component id; one per session
GREETING = (
    "Hey, welcome to the studio. Pull up a chair, this takes about as long as a slow par 3.",
    "Let's start with you. How long have you been at this game?",
)
TEMPLATE = "I've played golf for {years}, about {often}, and I'm a {hand} handed {sex} aged {age}"
TOKENS: dict[str, tuple[str, tuple[tuple[str, str], ...]]] = {
    "years": ("how long", (
        ("new", "Just started"), ("1_3", "1–3 years"), ("3_10", "3–10 years"),
        ("10_plus", "10+ years"))),
    "often": ("how often", (
        ("weekly", "every week"), ("2_3_month", "2–3 rounds a month"),
        ("season", "a few a season"), ("starting", "just starting"))),
    "hand": ("right or left", (("right", "right"), ("left", "left"))),
    "sex": ("man or woman", (("male", "man"), ("female", "woman"))),
    "age": ("age", (
        ("u25", "under 25"), ("25_34", "25–34"), ("35_44", "35–44"), ("45_54", "45–54"),
        ("55_64", "55–64"), ("65_plus", "65+"))),
}  # fmt: skip

# Option id -> saved profile value, as in own.yaml. An age band saves its middle.
AGES = {"u25": 21, "25_34": 30, "35_44": 40, "45_54": 50, "55_64": 60, "65_plus": 68}
ROUNDS = {"weekly": "31-50", "2_3_month": "10-30", "season": "Under 10", "starting": "Under 10"}
SAVES = {"hand": ("handedness", None), "sex": ("sex", None), "age": ("age", AGES),
         "often": ("rounds_per_year", ROUNDS)}  # fmt: skip
OFTEN_OF = {"Over 50": "weekly", "31-50": "weekly", "10-30": "2_3_month", "Under 10": "season"}


def _age_band(age: Any) -> str | None:
    if not isinstance(age, int | float):
        return None
    for band, top in (("u25", 25), ("25_34", 35), ("35_44", 45), ("45_54", 55), ("55_64", 65)):
        if age < top:
            return band
    return "65_plus"


def _prefill(profile: dict[str, Any]) -> dict[str, str | None]:
    """Token id -> option id the profile already answers (persona questionnaire), else None."""
    return {
        "years": None,  # not a profile field
        "often": OFTEN_OF.get(profile.get("rounds_per_year")),
        "hand": profile.get("handedness"),
        "sex": profile.get("sex"),
        "age": _age_band(profile.get("age")),
    }


def card(profile: dict[str, Any]) -> SentenceBuilder:
    known = _prefill(profile)
    return SentenceBuilder(
        prompt="Tap the words to change them",
        template=TEMPLATE,
        tokens=[
            SentenceToken(
                id=tid,
                placeholder=placeholder,
                options=[SentenceTokenOption(id=i, label=label) for i, label in options],
                value=known[tid] if known[tid] in dict(options) else None,
            )
            for tid, (placeholder, options) in TOKENS.items()
        ],
    )


def picked(value: Any) -> dict[str, str]:
    """The known token id -> option id pairs of a card answer; anything else is dropped."""
    if not isinstance(value, dict):
        return {}
    return {t: o for t, o in value.items() if t in TOKENS and o in dict(TOKENS[t][1])}


def profile_fields(choice: dict[str, str], profile: dict[str, Any]) -> dict[str, Any]:
    """The profile fields to save for a card answer. A pick that matches what the profile already
    holds is skipped, so a persona's exact age (46) is not replaced by its band's middle (50)."""
    known = _prefill(profile)
    fields: dict[str, Any] = {}
    for tid, (field, values) in SAVES.items():
        if (opt := choice.get(tid)) is not None and opt != known[tid]:
            fields[field] = values[opt] if values else opt
    return fields

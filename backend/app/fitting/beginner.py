"""Beginner skips (plan L26): who counts as a new golfer, and the "Not sure" defaults they get.

One shared place, applied by `session_inputs.intake_of`, so `next_question`, `analyze`, `run_fit`
and `recommend` all see the same intake. Pure: returns a copy, never mutates the caller's.
"""

from __future__ import annotations

from app.schemas.fit import IntakeAnswers

# The questions a new golfer skips; they get these defaults instead (L26).
BEGINNER_SKIPS = ("characteristics", "flight", "tempo", "joint_pain")


def is_beginner(intake: IntakeAnswers) -> bool:
    """New to golf: "Just started" on the opening card. Several years in is never a beginner,
    however few rounds a season or however high the score. Otherwise (1-3 years, or not said)
    a typical round over 92 counts as new."""
    if intake.years_playing == "new":
        return True
    if intake.years_playing in ("3_10", "10_plus"):
        return False
    return intake.score_bucket == 5


def with_beginner_defaults(intake: IntakeAnswers) -> IntakeAnswers:
    """A copy of `intake` with the beginner defaults filled in (mid flight, moderate tempo,
    forgiveness) where the golfer gave nothing. Anyone else: returned unchanged."""
    if not is_beginner(intake):
        return intake
    update: dict[str, object] = {}
    if intake.flight is None:
        update["flight"] = "mid"
    if intake.tempo is None:
        update["tempo"] = "moderate"
    if not intake.characteristics:
        update["characteristics"] = ["forgiveness"]
    return intake.model_copy(update=update) if update else intake

from typing import ClassVar, Literal

from pydantic import Field

from app.schemas.common import Bucket, Handedness, Sex
from app.schemas.ui._base import UIBlockBase, UIKind

RoundsPerYear = Literal["Under 10", "10-30", "31-50", "Over 50"]  # pack questionnaire values


class OnboardingCard(UIBlockBase):
    """Ask the basics in one card: age, sex, handedness, rounds per year, typical score.

    Prefill what the golfer already said.
    """

    kind: ClassVar[UIKind] = "ui_input"

    type: Literal["onboarding_card"] = "onboarding_card"
    prompt: str = Field(max_length=200)
    age: int | None = Field(default=None, ge=8, le=100)
    sex: Sex | None = None
    handedness: Handedness | None = None
    rounds_per_year: RoundsPerYear | None = None
    typical_score: Bucket | None = Field(
        default=None, description="Score bucket 1-5: <71, 71-77, 78-84, 85-92, over 92"
    )

from typing import ClassVar, Literal

from pydantic import Field

from app.schemas.common import Gate, Purchase, Spec
from app.schemas.ui._base import UIBlockBase, UIKind


class RecommendationCard(UIBlockBase):
    """Show the recommended iron spec with its confidence and gate. Spec comes from run_fit."""

    kind: ClassVar[UIKind] = "ui_display"

    type: Literal["recommendation_card"] = "recommendation_card"
    spec: Spec
    purchase: Purchase
    confidence: float = Field(ge=0, le=1)
    gate: Gate
    strength: Literal["low"] | None = None
    runner_up: Spec | None = None
    social_proof_id: str | None = Field(
        default=None, description="Id in fixtures/social_proof.json (always labelled example)"
    )

"""Confidence part of FittingState (plan §3.4). Owned by FIT after v0: add optional fields only."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import Gate, Part, SpecValue


class PartConfidence(BaseModel):
    model_config = ConfigDict(frozen=True)

    share: float = Field(ge=0, le=1)
    ours: SpecValue | None = None
    alt: SpecValue | None = None
    close_call: bool = False
    next_step: str | None = Field(
        default=None, description="What would settle a close call (plan §3.5), plain text"
    )


class NextQuestionHint(BaseModel):
    """What `confidence.next_question(state)` would ask next (plan §2.3, §5.5)."""

    model_config = ConfigDict(frozen=True)

    field: str
    kind: Literal["intake", "precision"] = "intake"
    reason: str | None = None
    part: Part | None = Field(default=None, description="Precision offers: the part it firms up")
    reason_code: str | None = Field(default=None, description="Stable id of the offer (§5.5)")
    expected_gain: float | None = Field(
        default=None, description="Expected rise in confidence C if the golfer adds it"
    )


class ConfidenceStatePart(BaseModel):
    model_config = ConfigDict(frozen=True)

    confidence: float | None = Field(default=None, ge=0, le=1)
    gate: Gate = "needs_info"
    strength: Literal["low"] | None = None
    per_part: dict[Part, PartConfidence] = Field(default_factory=dict)
    missing: list[str] = Field(default_factory=list)
    next_question: NextQuestionHint | None = None
    precision_offered: list[Part] = Field(
        default_factory=list, description="Parts already offered a precision follow-up (once each)"
    )
